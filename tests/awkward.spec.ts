import { test, expect } from './support/harness';
import { COLUMBIA, LIV_ST, metresBetween } from './support/world';

declare const S: any; declare const NAV: any;
declare function loadHistory(): any[];
declare function prop(s: any, key: string): number;

test.describe('Awkward trips', () => {
  test('T1 a docking station as the destination: return the bike there, no walk at the end', async ({ app, page }) => {
    await app.open();
    await app.waitForGpsStart();
    await app.search('to', 'Brick Lane', /Brick Lane Market/);
    await expect(page.locator('#start-nav-btn')).toBeVisible();
    const r = await app.state(() => ({ drop: S.dropoff?.id, walkOut: S.walkOut?.distance ?? 0, walkOnly: !!S.walkOnly }));
    expect(r.walkOnly, 'planned a bike trip').toBe(false);
    expect(r.drop, 'return dock').toBe('BikePoints_201');
    expect(r.walkOut, 'metres of walking after returning the bike').toBeLessThanOrEqual(25);
  });

  test('T2 no dock within 800 m: uses the nearest one and says how far the walk is', async ({ app, page }) => {
    await app.open();
    await app.planTo('Golden Lane', 'Golden Lane Estate');
    const walkOut = await app.state(() => S.walkOut?.distance ?? 0);
    expect(walkOut, 'test setup: the walk from the nearest dock is over 800 m').toBeGreaterThan(800);
    // The summary at the top of the sheet, not only the step list further down
    await expect(page.locator('#journey-summary'), 'summary gives the walk as a distance')
      .toContainText(/\d+(\.\d+)?\s?(km|m)\b[^·]*walk|walk[^·]*\b\d+(\.\d+)?\s?(km|m)\b/i);
  });

  test('T3 no e-bikes nearby: says so and offers Standard', async ({ app, page, world }) => {
    for (const s of world.stations) s.ebikes = 0;
    await app.open();
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await app.clearMessages();
    await page.locator('#filter-row [data-filter="ebike"]').click();
    await page.waitForTimeout(1500);
    const msgs = await app.messages();
    expect(await app.said(/e-?bike[\s\S]{0,80}standard|standard[\s\S]{0,80}e-?bike/i),
      `a message about no e-bikes that offers Standard (messages: ${msgs.join(' | ')})`).toBe(true);
    // Never a plan that quietly uses a standard bike
    if (await page.locator('#start-nav-btn').isVisible()) {
      const ebikes = await app.state(() => S.pickup ? prop(S.pickup, 'NbEBikes') : null);
      expect(ebikes, 'e-bikes at the pick-up dock of the plan on screen').toBeGreaterThan(0);
    }
  });

  test('T4 start and destination in the same place: says so, no plan', async ({ app, page }) => {
    await app.open();
    await app.waitForGpsStart();
    await app.clearMessages();
    await app.search('to', 'Bethnal Green Gardens');
    await page.waitForTimeout(2500);
    expect(await app.said(/already (there|here)|same place|you'?re (already )?there|start and destination are the same|same as (your )?start/i),
      `said you're already there (messages: ${(await app.messages()).join(' | ')})`).toBe(true);
    await expect(page.locator('#start-nav-btn')).toBeHidden();
  });
});

test.describe('Impatient user', () => {
  test('U1 two quick taps on Start starts one trip', async ({ app, page }) => {
    await app.open();
    await app.planTo('Liverpool', 'Liverpool Street Station');
    // Both clicks of a double tap land before the screen changes
    await page.evaluate(() => { const b = document.getElementById('start-nav-btn')!; b.click(); b.click(); });
    await expect(page.locator('#nav-overlay')).toHaveClass(/active/);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => loadHistory().length), 'trips in Activity').toBe(1);
    expect(await page.evaluate(() => (window as any).__geo.watching()), 'GPS watches running').toBe(1);
  });

  test('U2 a new destination while the last plan is loading: only the newest plan shows', async ({ app, page, world }) => {
    await app.open();
    await app.waitForGpsStart();
    world.delay.valhallaTo = { lat: LIV_ST.lat, lon: LIV_ST.lon, ms: 4000 };   // the Liverpool Street plan is slow
    await app.search('to', 'Liverpool', 'Liverpool Street Station');
    await page.waitForTimeout(300);
    await app.search('to', 'Columbia', COLUMBIA.name);
    await page.waitForTimeout(6000);                                         // long enough for the slow plan to land
    await expect(page.locator('#start-nav-btn')).toBeVisible();
    expect(await app.state(() => S.end.label), 'destination').toContain('Columbia');
    // What's on screen belongs to the Columbia Road plan, not the late Liverpool Street one
    await expect(page.locator('#steps-list'), 'step list has no Liverpool Street docks').not.toContainText(/Liverpool Street,|Bishopsgate|Wormwood/);
    const drop = await app.state(() => S.dropoff ? { lat: S.dropoff.lat, lon: S.dropoff.lon } : null);
    if (drop) expect(Math.round(metresBetween(drop, COLUMBIA)), 'metres from the return dock to Columbia Road').toBeLessThan(800);
    const legs = await app.routeLegs();
    const last = legs.filter(l => (l.coords as any[]).length).at(-1)!.coords.at(-1) as [number, number];
    expect(Math.round(metresBetween({ lat: last[1], lon: last[0] }, COLUMBIA)), 'metres from the end of the route to Columbia Road').toBeLessThan(150);
  });

  test('U3 location refused at Start: says so and stays on the plan', async ({ app, page }) => {
    await app.open();
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await page.evaluate(() => (window as any).__geo.deny(true));
    await app.clearMessages();
    await page.locator('#start-nav-btn').click();
    await page.waitForTimeout(1500);
    expect(await app.said(/location/i), 'said navigation needs your location').toBe(true);
    await expect(page.locator('#nav-overlay'), 'not in the navigation view').not.toHaveClass(/active/);
    await expect(page.locator('#start-nav-btn')).toBeVisible();
  });

  // The test needs a way in: a button during navigation named like "Change destination"
  // that brings up the destination box (#to-input).
  test('U4 changing the destination mid-trip re-plans and keeps navigating', async ({ app, page }) => {
    await app.open();
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await app.startNav();
    await app.travel({ stepMs: 20, legs: [0] });                              // walked to the dock: bike picked up
    const cyc = (await app.routeLegs())[1].coords as [number, number][];
    for (const [lon, lat] of cyc.slice(0, 6)) { await app.moveTo(lat, lon, { speed: 4.5 }); await page.waitForTimeout(40); }
    const change = page.getByRole('button', { name: /change (the )?destination|new destination|change where|go somewhere else/i });
    await expect(change, 'a "Change destination" button during navigation').toBeVisible({ timeout: 3000 });
    await change.click();
    await app.search('to', 'Columbia', COLUMBIA.name);
    await expect.poll(() => app.state(() => S.end?.label), { timeout: 10_000 }).toContain('Columbia');
    await expect(page.locator('#nav-overlay')).toHaveClass(/active/);
    const left = await app.state(() => NAV.steps.slice(NAV.current).map((s: any) => s.legType));
    expect(left, 'no second bike pick-up: you are already on one').not.toContain('pickup');
    expect(left, 'still has somewhere to return the bike').toContain('dropoff');
  });
});
