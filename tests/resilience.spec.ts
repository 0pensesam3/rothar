import { test, expect } from './support/harness';

// R3 (no uncaught errors) is checked after every test by the harness itself.

test.describe('When things go wrong', () => {
  test('R1 TfL down: says so, no crash', async ({ app, page, world }) => {
    world.down.tfl = true;
    await app.open({ waitForStations: false });
    await expect(page.locator('#toast')).toContainText(/Station data/i);
    await expect(page.locator('#header')).toBeVisible();
  });

  test('R2 routing down: still plans with estimates and says so', async ({ app, page, world }) => {
    world.down.valhalla = true; world.down.osrm = true;
    await app.open();
    await app.waitForGpsStart();
    await app.search('to', 'Liverpool', 'Liverpool Street Station');
    await expect(page.locator('#toast')).toContainText(/estimated/i);
    await expect(page.locator('#journey-panel')).toBeVisible();
  });
});

test.describe('Privacy', () => {
  test('V1 usage counts carry action names only', async ({ app, page }) => {
    await app.open();
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await page.locator('#route-row [data-rt="quietest"]').click();
    await expect(page.locator('#start-nav-btn')).toBeVisible();
    await app.startNav();
    await page.locator('#nav-stop').click(); await page.locator('#nav-stop').click();
    const sent: string[] = await page.evaluate(() => (window as any).__gc);
    expect(sent.length, 'some usage was counted').toBeGreaterThan(0);
    for (const p of sent) {
      expect.soft(p, 'looks like an action name').toMatch(/^event\/[a-z0-9\-\/ .:]+$/i);
      expect.soft(p, 'no coordinates').not.toMatch(/-?\d{1,2}\.\d{3,}/);
      expect.soft(p.toLowerCase(), 'no place or station names').not.toMatch(/liverpool|bethnal|cambridge heath|bishopsgate/);
    }
  });

  test('V2 TfL attribution is on the map screen', async ({ app, page }) => {
    await app.open();
    await expect(page.getByText('Powered by TfL Open Data').first()).toBeVisible();
  });
});
