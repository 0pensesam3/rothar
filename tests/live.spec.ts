import { test, expect } from './support/harness';

// Runs against the real TfL, routing and search services (project "live").
// Results depend on the day, so a failure here is a lead to look into, not proof of a bug.

test('LIVE plan Bethnal Green to Liverpool Street with real data', async ({ app, page, world }) => {
  test.setTimeout(60_000);
  await app.open();
  await app.waitForGpsStart();
  const stations = await page.evaluate(() => (globalThis as any).eval('S.stations.length'));
  expect(stations, 'TfL returned a realistic number of docks').toBeGreaterThan(500);
  await app.search('to', 'Liverpool Street', /Liverpool Street/);
  await expect(page.locator('#start-nav-btn')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#journey-summary')).toContainText(/min/);
  await app.shot('live-01-plan');
  test.info().annotations.push({ type: 'outside-requests', description: [...new Set(world.requests.map(u => new URL(u).host))].join(', ') });
});
