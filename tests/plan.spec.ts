import { test, expect } from './support/harness';
import { NEARBY } from './support/world';

declare const S: any; declare const map: any;

test.describe('Starting up', () => {
  test('B1 start box fills with your location without a tap', async ({ app, page }) => {
    await app.open();
    await expect(page.locator('#from-input')).toHaveValue('Your location');
  });

  test('B2 refused location is explained and you can still type a start', async ({ app, page }) => {
    await app.open({ deny: true });
    await expect(page.locator('#toast')).toContainText(/allow|location/i, { timeout: 10_000 });
    await app.search('from', 'Bethnal Green Lib', 'Bethnal Green Library');
    await expect(page.locator('#from-input')).toHaveValue('Bethnal Green Library');
  });

  test('B3 nearby docks are coloured by what they have', async ({ app, page }) => {
    await app.open();
    await app.waitForGpsStart();
    const colours = await page.locator('.maplibregl-marker div[style*="border-radius:50%"]').evaluateAll(els =>
      els.map(e => getComputedStyle(e).backgroundColor));
    expect(colours, 'green dock (standard bikes)').toContain('rgb(22, 163, 74)');
    expect(colours, 'blue dock (e-bike only)').toContain('rgb(37, 99, 235)');
    expect(colours, 'red dock (empty)').toContain('rgb(220, 38, 38)');
  });
});

test.describe('Search', () => {
  test('S1 suggestions after 2 letters', async ({ app, page }) => {
    await app.open();
    await page.locator('#to-input').click();
    await page.locator('#to-input').pressSequentially('Liv', { delay: 40 });
    await expect(page.locator('#to-ac .ac-item').filter({ hasText: 'Liverpool Street Station' })).toBeVisible();
  });

  test('S2 Enter picks the best match', async ({ app, page }) => {
    await app.open();
    await app.waitForGpsStart();
    await page.locator('#to-input').click();
    await page.locator('#to-input').fill('Liverpool Street Station');
    await page.locator('#to-input').press('Enter');
    await expect(page.locator('#to-input')).toHaveValue('Liverpool Street Station');
    await expect(page.locator('#start-nav-btn')).toBeVisible();
  });

  test('S3 postcodes are offered', async ({ app, page }) => {
    await app.open();
    await page.locator('#to-input').click();
    await page.locator('#to-input').pressSequentially('E2 0', { delay: 40 });
    await expect(page.locator('#to-ac .ac-item').filter({ hasText: 'E2 0ET' })).toBeVisible();
  });

  test('S4 recent places show when you tap into an empty box', async ({ app, page }) => {
    await app.open();
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await page.locator('#to-clear').click();
    await page.locator('#to-input').click();
    await expect(page.locator('#to-ac .ac-item').filter({ hasText: 'Liverpool Street Station' }).filter({ hasText: 'Recent' })).toBeVisible();
  });

  test('S5 docking stations come up by name', async ({ app, page }) => {
    await app.open();
    await page.locator('#to-input').click();
    await page.locator('#to-input').pressSequentially('Hollybush', { delay: 40 });
    await expect(page.locator('#to-ac .ac-item').filter({ hasText: 'Hollybush Gardens' }).filter({ hasText: 'Docking station' })).toBeVisible();
  });

  test('S6 search still offers stations when the address service is down', async ({ app, page, world }) => {
    world.down.photon = true;
    await app.open();
    await page.locator('#to-input').click();
    await page.locator('#to-input').pressSequentially('Bishops', { delay: 40 });
    await expect(page.locator('#to-ac .ac-item').filter({ hasText: 'Bishopsgate' })).toBeVisible();
  });
});

test.describe('Planning', () => {
  test('P1 plans walk, cycle, walk straight away', async ({ app, page }) => {
    await app.open();
    await app.planTo('Liverpool', 'Liverpool Street Station');
    const legs = page.locator('#journey-summary .sum-legs');
    await expect(legs).toContainText(/walk.*cycle.*walk/);
  });

  test('P2 summary shows total, arrival time and legs, dock time included', async ({ app, page }) => {
    await app.open();
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await expect(page.locator('#journey-summary .sum-arrive')).toHaveText(/^Arrive \d{2}:\d{2}$/);
    const secs = await app.state(() => S.walkIn.duration + S.cycle.duration + S.walkOut.duration);
    const shown = await page.locator('#journey-summary .sum-total').innerText();
    expect(shown, 'total includes ~90 s for docking').toBe(`${Math.round((secs + 90) / 60)} min`);
  });

  test('P3 pick-up has a bike, return dock has space, never an empty dock', async ({ app }) => {
    await app.open();
    await app.planTo('Liverpool', 'Liverpool Street Station');
    const { pick, drop } = await app.state(() => {
      const p = (s: any, k: string) => +((s.additionalProperties || []).find((x: any) => x.key === k)?.value || 0);
      return { pick: { id: S.pickup.id, bikes: p(S.pickup, 'NbBikes') }, drop: { id: S.dropoff.id, empty: p(S.dropoff, 'NbEmptyDocks') } };
    });
    expect(pick.bikes).toBeGreaterThan(0);
    expect(pick.id).not.toBe('BikePoints_103');
    expect(drop.empty).toBeGreaterThan(0);
    expect(drop.id).not.toBe('BikePoints_303');
  });

  test('P4 E-bike filter re-plans to a dock with e-bikes', async ({ app, page }) => {
    await app.open();
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await page.locator('#filter-row [data-filter="ebike"]').click();
    await expect(page.locator('#steps-list .avail-row').first()).toContainText('e-bike');
    const ebikes = await app.state(() => +((S.pickup.additionalProperties || []).find((x: any) => x.key === 'NbEBikes')?.value || 0));
    expect(ebikes).toBeGreaterThan(0);
  });

  test('P5 short trips suggest walking', async ({ app, page }) => {
    await app.open();
    await app.planTo('Young V', NEARBY.name);
    await expect(page.locator('#journey-summary')).toContainText('Faster to walk');
    await expect(page.locator('#start-nav-btn')).toHaveText(/Start walking/);
  });

  test('P6 step list does not announce arrival partway through', async ({ app, page }) => {
    await app.open();
    await app.planTo('Liverpool', 'Liverpool Street Station');
    const text = await page.locator('#steps-list').innerText();
    const count = (text.match(/You have arrived at your destination/g) || []).length;
    expect(count, 'router "arrived" lines inside the step list').toBe(0);
  });

  test('P7 whole trip is in view after planning', async ({ app, page }) => {
    await app.open();
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const box = (id: string) => document.getElementById(id)!.getBoundingClientRect();
      const mapBox = box('map');
      const top = Math.max(box('search-panel').bottom, mapBox.top);
      const sheet = box('journey-panel');
      const bottom = Math.min(sheet.top, mapBox.bottom);
      const pts = [S.start, S.pickup, S.dropoff, S.end].map((p: any) => {
        const xy = map._ml.project([p.lon, p.lat]);
        const x = xy.x + mapBox.left, y = xy.y + mapBox.top;
        // What sits on top of that point: the map itself, or a panel, legend or control covering it
        const hit = document.elementFromPoint(x, y);
        const cover = hit?.closest('#map-legend, #search-panel, #journey-panel, #header, .maplibregl-ctrl');
        return { x, y, coveredBy: cover ? (cover.id || cover.className) : null };
      });
      return { top, bottom, width: innerWidth, pts };
    });
    for (const [i, p] of r.pts.entries()) {
      const name = ['start', 'pick-up', 'return dock', 'destination'][i];
      expect.soft(p.x, `${name} horizontally on screen`).toBeGreaterThanOrEqual(0);
      expect.soft(p.x, `${name} horizontally on screen`).toBeLessThanOrEqual(r.width);
      expect.soft(p.y, `${name} below the search panel`).toBeGreaterThanOrEqual(r.top);
      expect.soft(p.y, `${name} above the bottom sheet`).toBeLessThanOrEqual(r.bottom);
      expect.soft(p.coveredBy, `${name} not hidden under a panel, the legend or a map control`).toBeNull();
    }
  });

  test('P8 route type re-plans', async ({ app, page, world }) => {
    await app.open();
    await app.planTo('Liverpool', 'Liverpool Street Station');
    const before = world.requests.length;
    await page.locator('#route-row [data-rt="fastest"]').click();
    await expect.poll(() => world.requests.slice(before).some(u => decodeURIComponent(u).includes('"use_roads":0.9'))).toBe(true);
    await expect(page.locator('#start-nav-btn')).toBeVisible();
  });
});

test.describe('Low pick-up docks', () => {
  const ebikesAt = () => +((S.pickup?.additionalProperties || []).find((x: any) => x.key === 'NbEBikes')?.value || 0);

  test('P9 a dock with 2+ of your bike type wins over one with a single bike nearby', async ({ app, page }) => {
    await app.open();
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await page.locator('#filter-row [data-filter="ebike"]').click();
    await expect.poll(() => app.state(ebikesAt), { message: 'e-bikes at the chosen pick-up' }).toBeGreaterThanOrEqual(2);
    expect(await app.state(() => S.pickup.id), 'not the dock with 1 e-bike').not.toBe('BikePoints_105');
    await app.startNav();
    await app.moveTo(51.5270, -0.0549);
    await page.waitForTimeout(1500);
    await expect(page.locator('#avail-popup'), 'no low-bikes popup straight after Start').toBeHidden();
  });

  test('P9 when only a low dock is near, the plan says so before you start', async ({ app, page, world }) => {
    for (const s of world.stations) if (s.id !== 'BikePoints_105') { s.bikes -= s.ebikes; s.ebikes = 0; }
    await app.open();
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await page.locator('#filter-row [data-filter="ebike"]').click();
    await expect(page.locator('#journey-summary')).toContainText(/Only 1 e-bike at Hollybush Gardens/);
    // It then runs out: the popup names the bike type you asked for
    app.setStation('BikePoints_105', { ebikes: 0, bikes: 4 });
    await app.startNav();
    await app.moveTo(51.5270, -0.0549);
    await expect(page.locator('#avail-popup-title')).toContainText('No e-bikes available');
  });
});

test.describe('Boxes match the trip', () => {
  const leave = (page: any) => page.locator('#map-wrap').click({ position: { x: 200, y: 260 } });

  test('S7 edit the destination box without picking: the box goes back to the planned place', async ({ app, page }) => {
    await app.open();
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await page.locator('#to-input').click();
    await page.locator('#to-input').fill('Columbia Road');
    await leave(page);
    await expect(page.locator('#to-input')).toHaveValue(await app.state(() => S.end.label));
    await expect(page.locator('#to-input')).toHaveValue('Liverpool Street Station');
  });

  test('S7 edit the start box without picking: the box goes back to your location', async ({ app, page }) => {
    await app.open();
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await page.locator('#from-input').click();
    await page.locator('#from-input').fill('Columbia');
    await leave(page);
    await expect(page.locator('#from-input')).toHaveValue('Your location');
  });

  test('S7 empty the destination box and leave it: the plan goes', async ({ app, page }) => {
    await app.open();
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await page.locator('#to-input').click();
    await page.locator('#to-input').fill('');
    await leave(page);
    await expect(page.locator('#start-nav-btn')).toBeHidden();
    expect(await app.state(() => S.end)).toBeNull();
  });
});

test.describe('Coming back to a plan', () => {
  test('P10 back after 25 minutes: the docks are re-checked and the arrival time moves on', async ({ app, page, world }) => {
    await page.clock.install();
    await app.open();
    await app.planTo('Liverpool', 'Liverpool Street Station');
    const arrive = await page.locator('.sum-arrive').innerText();
    const before = world.requests.filter(u => u.endsWith('/BikePoint/')).length;
    await app.moveTo(51.5262, -0.0569);                  // you walked a little while away
    await page.clock.fastForward('25:00');
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(() => world.requests.filter(u => u.endsWith('/BikePoint/')).length, { message: 'docks re-checked' }).toBeGreaterThan(before);
    await expect(page.locator('.sum-arrive')).not.toHaveText(arrive);
    await expect.poll(() => app.state(() => S.start.lat), { message: 'planned from where you are now' }).toBeCloseTo(51.5262, 4);
  });
});
