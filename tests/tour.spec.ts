import { test, expect } from './support/harness';
import { HOME, NEARBY } from './support/world';

// Not a pass/fail check. Walks through the app and saves a screenshot at each
// important moment into ux-run/screens, for the agents to judge L1 to L3 by eye.

test('TOUR screenshots of each screen', async ({ app, page }) => {
  test.setTimeout(120_000);
  await app.open();
  await app.waitForGpsStart();
  await app.shot('01-opened');

  await page.locator('#to-input').click();
  await page.locator('#to-input').pressSequentially('Liv', { delay: 40 });
  await expect(page.locator('#to-ac .ac-item').first()).toBeVisible();
  await app.shot('02-search-suggestions');
  await page.locator('#to-ac .ac-item').filter({ hasText: 'Liverpool Street Station' }).first().click();
  await expect(page.locator('#start-nav-btn')).toBeVisible();
  await app.shot('03-bike-plan');

  await app.startNav();
  await app.moveTo(HOME.lat, HOME.lon);
  await page.waitForTimeout(1200);
  await app.shot('04-nav-walking-to-dock');

  const box = (await page.locator('#nav-card').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 6 }); await page.mouse.up();
  await app.shot('05-nav-swiped-to-later-turn');
  await page.locator('#nav-card').click();

  await app.travel({ stepMs: 20, legs: [0] });
  const cyc = (await app.routeLegs())[1].coords as [number, number][];
  for (const [lon, lat] of cyc.slice(0, 20)) await app.moveTo(lat, lon, { speed: 4.5, heading: 180 });
  await page.waitForTimeout(1200);
  await app.shot('06-nav-cycling');

  app.setStation('BikePoints_301', { empty: 1 });
  await page.evaluate(() => (globalThis as any).eval('startProximityRefresh("dropoff")'));
  await expect(page.locator('#avail-popup')).toBeVisible();
  await app.shot('07-dock-alert');
  await page.locator('#avail-wait').click();

  await page.locator('#nav-stop').click();
  await app.shot('08-end-confirm');
  await page.locator('#nav-stop').click();
  await page.locator('#history-btn').click();
  await app.shot('09-activity');
  await page.locator('#history-close').click();

  await page.locator('#to-clear').click();
  await app.search('to', 'Young V', NEARBY.name);
  await expect(page.locator('#start-nav-btn')).toBeVisible();
  await app.shot('10-walk-plan');
});
