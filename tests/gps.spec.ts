import { test, expect, App } from './support/harness';
import { HOME, offset } from './support/world';
import type { Page } from '@playwright/test';

declare const S: any; declare const NAV: any;

// Real phones jitter, drop out and point the wrong way. These rides use the same
// fake London as the rest, but feed the app the kind of GPS a real ride gets.

// Walk to the bike, then ride `points` fixes down the first stretch of the cycle leg
async function rideABit(app: App, page: Page, points: number) {
  await app.planTo('Liverpool', 'Liverpool Street Station');
  await app.startNav();
  await app.travel({ stepMs: 20, legs: [0] });
  const cyc = (await app.routeLegs())[1].coords as [number, number][];
  for (const [lon, lat] of cyc.slice(0, points)) { await app.moveTo(lat, lon, { speed: 4.5 }); await page.waitForTimeout(40); }
  await page.waitForTimeout(300);
  return cyc;
}

const OFF_ROUTE = /off (the )?route|rerouting|re-?planning|recalculating|finding a new route/i;

test.describe('Messy GPS', () => {
  test.beforeEach(async ({ app }) => { await app.open(); });

  test('G1 a very uncertain position does not skip steps or end the trip', async ({ app, page }) => {
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await app.startNav();
    await app.moveTo(HOME.lat, HOME.lon);
    await page.waitForTimeout(300);
    const before = await app.state(() => NAV.current);
    const drop = await app.state(() => ({ lat: S.dropoff.lat, lon: S.dropoff.lon }));
    // One fix that claims you're at the return dock, give or take 400 m
    await app.moveTo(drop.lat, drop.lon, { acc: 400 });
    await page.waitForTimeout(2500);
    expect(await app.state(() => NAV.active), 'trip still running').toBe(true);
    expect(await app.state(() => NAV.current), 'step after a ±400 m fix').toBe(before);
    await expect(page.locator('#nav-primary')).not.toContainText(/Return bike/);
  });

  test('G2 a 40 m jump that comes straight back changes nothing', async ({ app, page }) => {
    const cyc = await rideABit(app, page, 7);
    const before = await app.state(() => ({ step: NAV.current, text: document.getElementById('nav-primary')!.innerText }));
    const [lon, lat] = cyc[6];
    const jump = offset(lat, lon, 40, 0);
    await app.moveTo(jump.lat, jump.lon, { speed: 4.5 });
    await page.waitForTimeout(1000);
    await app.moveTo(cyc[7][1], cyc[7][0], { speed: 4.5 });
    await page.waitForTimeout(1000);
    const after = await app.state(() => ({ step: NAV.current, text: document.getElementById('nav-primary')!.innerText }));
    expect(after.step, 'step after the jump').toBe(before.step);
    expect(after.text, 'turn card after the jump').toBe(before.text);
    expect(await app.said(OFF_ROUTE), 'did not call a one-off jump "off route"').toBe(false);
  });

  test('G3 GPS going quiet is explained, and the trip picks up again', async ({ app, page }) => {
    const cyc = await rideABit(app, page, 10);
    const before = await app.state(() => NAV.current);
    await page.waitForTimeout(21_000);                       // no fixes at all for 21 s
    expect(await app.said(/lost (your )?(position|location|gps|signal)|searching for (gps|your location)|no gps|waiting for gps|gps signal/i),
      'said it has lost your position').toBe(true);
    for (const [lon, lat] of cyc.slice(25, 31)) { await app.moveTo(lat, lon, { speed: 4.5 }); await page.waitForTimeout(80); }
    await page.waitForTimeout(500);
    expect(await app.state(() => NAV.active), 'trip still running').toBe(true);
    expect(await app.state(() => NAV.current), 'step after GPS came back').toBeGreaterThanOrEqual(before);
    await expect(page.locator('#nav-overlay')).toHaveClass(/active/);
    await expect(page.locator('#resume-banner')).toBeHidden();
  });

  test('G4 a wrong compass reading changes the hint, not the directions', async ({ app, page }) => {
    await rideABit(app, page, 5);
    const ahead = await app.state(() => NAV.aheadBearing);
    expect(ahead, 'app knows which way the route goes').not.toBeNull();
    const before = await app.state(() => ({ step: NAV.current, text: document.getElementById('nav-primary')!.innerText,
      steps: NAV.steps.map((s: any) => s._label || s._instruction).join('|') }));
    for (let i = 0; i < 12; i++) { await app.compass((ahead + 180) % 360); await page.waitForTimeout(40); }
    await page.waitForTimeout(500);
    const after = await app.state(() => ({ step: NAV.current, text: document.getElementById('nav-primary')!.innerText,
      steps: NAV.steps.map((s: any) => s._label || s._instruction).join('|') }));
    expect(after, 'directions with the phone pointing backwards').toEqual(before);
  });
});

// Ride part of the way, then turn off down a street 80 m from the route and keep going
async function goOffRoute(app: App, page: Page) {
  const cyc = await rideABit(app, page, 8);
  const [lon, lat] = cyc[7];
  const off = offset(lat, lon, 80, 0);
  for (let i = 0; i < 9; i++) {                              // 18 s, drifting slowly away
    const p = offset(off.lat, off.lon, i * 3, 0);
    await app.moveTo(p.lat, p.lon, { speed: 4.5, heading: 90 });
    await page.waitForTimeout(2000);
  }
  return offset(off.lat, off.lon, 24, 0);
}

test.describe('Off route', () => {
  test.beforeEach(async ({ app }) => { await app.open(); });

  test('O1 more than 40 m off the route for 15 s is called out', async ({ app, page }) => {
    await goOffRoute(app, page);
    expect(await app.said(OFF_ROUTE), `said you're off route (messages: ${(await app.messages()).join(' | ')})`).toBe(true);
  });

  test('O2 going off route re-plans from where you are, without a tap', async ({ app, page, world }) => {
    const before = world.requests.length;
    const here = await goOffRoute(app, page);
    // A new route was asked for, starting where you are now
    await expect.poll(() => world.requests.slice(before).some(u => {
      const m = decodeURIComponent(u).match(/"locations":\[\{"lon":([-\d.]+),"lat":([-\d.]+)\}/)
             || decodeURIComponent(u).match(/\/(?:foot|bike)\/([-\d.]+),([-\d.]+);/);
      return !!m && Math.hypot((+m[1] - here.lon) * 69400, (+m[2] - here.lat) * 111000) < 60;
    }), { message: 'asked for a route from your new position', timeout: 10_000 }).toBe(true);
    expect(await app.state(() => NAV.active), 'still navigating').toBe(true);
    // And the route on screen now passes close to you
    await expect.poll(async () => {
      const legs = await app.routeLegs();
      let best = Infinity;
      for (const l of legs) for (const [lon, lat] of l.coords as [number, number][])
        best = Math.min(best, Math.hypot((lon - here.lon) * 69400, (lat - here.lat) * 111000));
      return best;
    }, { message: 'metres from you to the nearest point of the new route', timeout: 10_000 }).toBeLessThan(40);
  });
});
