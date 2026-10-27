import { test, expect } from './support/harness';
import { HOME } from './support/world';

declare const S: any; declare const NAV: any;
declare function showAvailAlert(st: any, type: string): void;

const PICKUP = 'BikePoints_101', RETURN = 'BikePoints_301';

test.describe('Dock availability', () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
    await app.planTo('Liverpool', 'Liverpool Street Station');
    expect(await app.state(() => [S.pickup.id, S.dropoff.id])).toEqual([PICKUP, RETURN]);
  });

  test('A1 live count at the next dock shows under the turn card', async ({ app, page }) => {
    await app.startNav();
    await app.moveTo(HOME.lat, HOME.lon);
    await expect(page.locator('#nav-station')).toBeVisible();
    await expect(page.locator('#nav-station')).toContainText('6');
    await expect(page.locator('#nav-station')).toContainText('Cambridge Heath Road');
  });

  test('A2 pick-up dock running low raises the popup', async ({ app, page }) => {
    app.setStation(PICKUP, { bikes: 1 });                 // someone took bikes after you planned
    await app.startNav();
    await app.moveTo(HOME.lat, HOME.lon);
    await expect(page.locator('#avail-popup')).toBeVisible();
    await expect(page.locator('#avail-popup-title')).toContainText('Only 1 bike left');
    await expect(page.locator('#avail-wait')).toBeVisible();
    await expect(page.locator('#avail-reroute')).toBeVisible();
  });

  test('A3 return dock is checked about 5 minutes out, not only on arrival', async ({ app, page, world }) => {
    await app.startNav();
    app.setStation(RETURN, { empty: 1 });                 // the dock fills up while you ride
    const cyc = (await app.routeLegs())[1].coords.length;
    let checkedAtSecsLeft: number | null = null, alertAtSecsLeft: number | null = null;
    await app.travel({ stepMs: 20, each: async (i, leg) => {
      if (leg !== 'cycle') return;
      const secsLeft = ((cyc - 1 - i) * 15) / 4.5;         // route points are 15 m apart, riding at 4.5 m/s
      if (checkedAtSecsLeft == null && world.requests.some(u => u.endsWith(`/BikePoint/${RETURN}`))) checkedAtSecsLeft = secsLeft;
      if (alertAtSecsLeft == null && await page.locator('#avail-popup').isVisible()) alertAtSecsLeft = secsLeft;
    } });
    expect(checkedAtSecsLeft, 'return dock was re-checked while still riding').not.toBeNull();
    expect(checkedAtSecsLeft!, 'seconds of riding left when the return dock was first re-checked').toBeGreaterThanOrEqual(120);
    expect(alertAtSecsLeft, 'popup about the full dock came while there was time to react').not.toBeNull();
  });

  test('A4 Reroute picks another dock and navigation carries on', async ({ app, page }) => {
    app.setStation(PICKUP, { bikes: 1 });
    await app.startNav();
    await app.moveTo(HOME.lat, HOME.lon);
    await expect(page.locator('#avail-popup')).toBeVisible();
    await page.locator('#avail-reroute').click();
    await expect(page.locator('#toast')).toContainText('Pick-up rerouted to');
    const id = await app.state(() => S.pickup.id);
    expect(id).not.toBe(PICKUP);
    await expect(page.locator('#nav-overlay')).toHaveClass(/active/);
    await expect(page.locator('#nav-station')).not.toContainText('Cambridge Heath Road');
  });

  test('A5 after Wait, a recovered dock clears the warning', async ({ app, page }) => {
    test.setTimeout(60_000);
    app.setStation(PICKUP, { bikes: 1 });
    await app.startNav();
    await app.moveTo(HOME.lat, HOME.lon);
    await expect(page.locator('#avail-popup')).toBeVisible();
    await page.locator('#avail-wait').click();
    await expect(page.locator('#avail-popup')).toBeHidden();
    app.setStation(PICKUP, { bikes: 5 });                 // bikes come back
    await expect(page.locator('#toast')).toContainText(/5 bikes at .* again/, { timeout: 25_000 });
    await expect(page.locator('#avail-popup')).toBeHidden();
  });
  // Walk to the pick-up dock, then ride `points` route points along the cycle leg
  async function rideOff(app: any, page: any, points: number) {
    await app.travel({ stepMs: 20, legs: [0] });
    const cyc = (await app.routeLegs())[1].coords as [number, number][];
    for (const [lon, lat] of cyc.slice(0, points)) { await app.moveTo(lat, lon, { speed: 4.5 }); await page.waitForTimeout(40); }
  }

  test('A6 once you ride off with the bike, the pick-up dock is no longer watched', async ({ app, page, world }) => {
    test.setTimeout(60_000);
    app.setStation(PICKUP, { bikes: 2 });
    await app.startNav();
    await app.travel({ stepMs: 20, legs: [0] });
    app.setStation(PICKUP, { bikes: 1 });                 // the bike you just took
    await rideOff(app, page, 12);
    await page.waitForTimeout(500);
    const before = world.requests.filter(u => u.endsWith(`/BikePoint/${PICKUP}`)).length;
    await page.waitForTimeout(17_000);                    // longer than one re-check interval
    const after = world.requests.filter(u => u.endsWith(`/BikePoint/${PICKUP}`)).length;
    expect(after, 'pick-up dock re-checked after riding off').toBe(before);
    await expect(page.locator('#avail-popup')).toBeHidden();
    await expect(page.locator('#nav-station')).toContainText('Liverpool Street');
  });

  test('A6 an ignored pick-up popup goes away once you ride off', async ({ app, page }) => {
    app.setStation(PICKUP, { bikes: 1 });
    await app.startNav();
    await app.moveTo(HOME.lat, HOME.lon);
    await expect(page.locator('#avail-popup')).toBeVisible();
    await rideOff(app, page, 10);
    await expect(page.locator('#avail-popup')).toBeHidden();
  });

  test('A7 Reroute mid-ride never adds a second pick-up', async ({ app, page }) => {
    await app.startNav();
    await rideOff(app, page, 10);
    expect(await app.state(() => NAV.hasBike), 'test setup: riding').toBe(true);
    await page.evaluate(() => showAvailAlert(S.pickup, 'bike'));   // a stale pick-up warning, however it got there
    await page.locator('#avail-reroute').click();
    await page.waitForTimeout(800);
    const r = await app.state(() => ({ pickup: S.pickup.id,
      ahead: NAV.steps.slice(NAV.current).map((s: any) => s.legType) }));
    expect(r.pickup).toBe(PICKUP);
    expect(r.ahead, 'steps still ahead').not.toContain('pickup');
    expect(r.ahead[0], 'next step').not.toBe('walk');
  });
});
