import { test, expect, App } from './support/harness';
import type { Page, Locator } from '@playwright/test';

// Other phone shapes. The checks here catch things cut off or overlapping;
// the screenshots are for the judgement part.

async function onScreen(page: Page, loc: Locator, what: string) {
  await expect(loc, `${what} visible`).toBeVisible();
  const b = (await loc.boundingBox())!;
  const v = page.viewportSize()!;
  expect.soft(b.x, `${what}: left edge on screen`).toBeGreaterThanOrEqual(-1);
  expect.soft(b.y, `${what}: top edge on screen`).toBeGreaterThanOrEqual(-1);
  expect.soft(b.x + b.width, `${what}: right edge on screen (screen is ${v.width})`).toBeLessThanOrEqual(v.width + 1);
  expect.soft(b.y + b.height, `${what}: bottom edge on screen (screen is ${v.height})`).toBeLessThanOrEqual(v.height + 1);
}

async function apart(a: Locator, b: Locator, what: string) {
  const x = (await a.boundingBox())!, y = (await b.boundingBox())!;
  const overlap = Math.max(0, Math.min(x.x + x.width, y.x + y.width) - Math.max(x.x, y.x))
                * Math.max(0, Math.min(x.y + x.height, y.y + y.height) - Math.max(x.y, y.y));
  expect.soft(Math.round(overlap), `${what}: overlapping area in px²`).toBe(0);
}

async function planAndNavigate(app: App, page: Page, name: string) {
  await app.open();
  await app.planTo('Liverpool', 'Liverpool Street Station');
  await app.shot(`${name}-plan`);
  await onScreen(page, page.locator('#start-nav-btn'), 'Start button');
  await onScreen(page, page.locator('#journey-summary'), 'trip summary');
  await app.startNav();
  await app.travel({ stepMs: 20, legs: [0] });
  await app.shot(`${name}-navigating`);
  await onScreen(page, page.locator('#nav-card'), 'turn card');
  await onScreen(page, page.locator('#nav-bottom'), 'trip bar');
  await onScreen(page, page.locator('#nav-stop'), 'End button');
  await apart(page.locator('#nav-card'), page.locator('#nav-bottom'), 'turn card and trip bar');
  // A message popping up mustn't sit on top of the instruction you're following.
  // Give the app a few seconds to show one (it warns about the compass after 5 s).
  await page.locator('#toast').waitFor({ state: 'visible', timeout: 7000 }).catch(() => {});
  if (await page.locator('#toast').isVisible())
    await apart(page.locator('#toast'), page.locator('#nav-primary'), `message "${await page.locator('#toast').innerText()}" and the turn instruction`);
}

test.describe('Small screen', () => {
  test.use({ viewport: { width: 375, height: 667 } });
  test('L4 iPhone SE: nothing important cut off or overlapping', async ({ app, page }) => {
    await planAndNavigate(app, page, 'l4-se');
  });
});

test.describe('Landscape', () => {
  test.use({ viewport: { width: 844, height: 390 } });
  test('L5 landscape: map, turn card and trip bar all fit', async ({ app, page }) => {
    await planAndNavigate(app, page, 'l5-landscape');
  });
});

test.describe('Long names', () => {
  test('L6 long road and station names never push a button off screen', async ({ app, page, world }) => {
    world.streetName = 'Shoreditch High Street Northbound Service Road and Great Eastern Street';
    for (const s of world.stations) s.commonName += ' (opposite the Old Truman Brewery loading bay entrance)';
    await planAndNavigate(app, page, 'l6-long-names');
    // Nothing on the turn card runs past its edge
    const spill = await page.evaluate(() => {
      const card = document.getElementById('nav-card')!.getBoundingClientRect();
      return [...document.querySelectorAll('#nav-card *')].map(e => {
        const r = e.getBoundingClientRect();
        return r.width && (r.right > card.right + 1 || r.left < card.left - 1) ? (e.id || e.className || e.tagName) : null;
      }).filter(Boolean);
    });
    expect.soft(spill, 'parts of the turn card running past its edge').toEqual([]);
  });
});
