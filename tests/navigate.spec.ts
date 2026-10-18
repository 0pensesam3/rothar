import { test, expect } from './support/harness';
import { HOME, NEARBY } from './support/world';

declare const S: any; declare const NAV: any;

test.describe('Navigating', () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
  });

  test('N1 start switches to the navigation view', async ({ app, page }) => {
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await app.startNav();
    await expect(page.locator('#nav-card')).toBeVisible();
    await expect(page.locator('#nav-bottom')).toBeVisible();
    await expect(page.locator('#search-panel')).toBeHidden();
  });

  test('N2 turn card shows the next manoeuvre and the distance counts down', async ({ app, page }) => {
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await app.startNav();
    await app.moveTo(HOME.lat, HOME.lon);
    await expect(page.locator('#nav-primary')).toContainText(/Turn|Pick up/);
    const read = async () => {
      const t = await page.locator('#nav-dist').innerText();
      return { turn: await page.locator('#nav-primary').innerText(), m: parseFloat(t) * (/km/.test(t) ? 1000 : 1) };
    };
    // Walk to the bike, then ride the first long stretch and watch the distance to the next turn
    await app.travel({ stepMs: 20, legs: [0] });
    const cyc = (await app.routeLegs())[1].coords as [number, number][];
    const readings: { turn: string; m: number }[] = [];
    for (const [lon, lat] of cyc.slice(2, 12)) { await app.moveTo(lat, lon, { speed: 4.5 }); await page.waitForTimeout(80); readings.push(await read()); }
    const sameTurn = readings.filter(r => r.turn === readings[0].turn);
    expect(sameTurn.length, 'card kept showing the same upcoming turn on a straight stretch').toBeGreaterThan(3);
    expect(sameTurn.at(-1)!.m, `distance to "${readings[0].turn}"`).toBeLessThan(sameTurn[0].m);
  });

  test('N3 the arrow points the same way as the words', async ({ app, page }) => {
    await app.planTo('Liverpool', 'Liverpool Street Station');
    // The step list in the plan
    const rows = await page.locator('#steps-list .step-row').evaluateAll(rs => rs.map(r =>
      ({ icon: r.querySelector('.step-ic')?.textContent?.trim(), text: r.querySelector('.step-txt')?.textContent?.trim() })));
    for (const r of rows) {
      if (/^Turn right\b/.test(r.text || '')) expect.soft(r.icon, `step list arrow for "${r.text}"`).toBe('↱');
      if (/^Turn left\b/.test(r.text || '')) expect.soft(r.icon, `step list arrow for "${r.text}"`).toBe('↰');
    }
    // The live turn card
    await app.startNav();
    const seen: { icon: string; text: string }[] = [];
    await app.travel({ stepMs: 30, each: async () => {
      const text = await page.locator('#nav-primary').innerText();
      if (!seen.some(s => s.text === text)) seen.push({ text, icon: await page.locator('#nav-maneuver').innerText() });
    } });
    expect(seen.some(s => /^Turn (right|left)/.test(s.text)), 'saw at least one turn on the card').toBe(true);
    for (const s of seen) {
      if (/^Turn right\b/.test(s.text)) expect.soft(s.icon, `turn card arrow for "${s.text}"`).toBe('↱');
      if (/^Turn left\b/.test(s.text)) expect.soft(s.icon, `turn card arrow for "${s.text}"`).toBe('↰');
    }
  });

  test('N4 steps move on by themselves, including pick-up and return', async ({ app, page }) => {
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await app.startNav();
    const texts = new Set<string>();
    await app.travel({ stepMs: 30, each: async () => { texts.add(await page.locator('#nav-primary').innerText()); } });
    const all = [...texts].join(' | ');
    expect(all).toMatch(/Pick up bike at Cambridge Heath Road/);
    expect(all).toMatch(/Return bike at Liverpool Street Station/);
    expect(all).toMatch(/Arrived at Liverpool Street Station/);
  });

  test('N5 time and distance left go down as you travel', async ({ app, page }) => {
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await app.startNav();
    await app.moveTo(HOME.lat, HOME.lon);
    const read = async () => ({
      mins: parseInt(await page.locator('#nav-eta-time').innerText()),
      metres: (t => parseFloat(t) * (/km/.test(t) ? 1000 : 1))(await page.locator('#nav-eta-dist').innerText()),
    });
    await expect(page.locator('#nav-eta-arrive')).toHaveText(/Arrive \d{2}:\d{2}/);
    const start = await read();
    const legs = await app.routeLegs();
    await app.travel({ stepMs: 20, legs: [0] });
    const cyc = legs[1].coords as [number, number][];
    for (const [lon, lat] of cyc.slice(0, Math.floor(cyc.length * 0.6))) await app.moveTo(lat, lon, { speed: 4.5 });
    await page.waitForTimeout(300);
    const later = await read();
    expect(later.metres, 'distance to go').toBeLessThan(start.metres);
    expect(later.mins, 'minutes left').toBeLessThan(start.mins);
  });

  test('N6 compass says whether you face the right way', async ({ app, page }) => {
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await app.startNav();
    await app.moveTo(HOME.lat, HOME.lon);
    const ahead = await app.state(() => NAV.aheadBearing);
    expect(ahead, 'app knows which way the route goes').not.toBeNull();
    const face = async (h: number) => {
      for (let i = 0; i < 10; i++) { await app.compass(h); await page.waitForTimeout(40); }
      await page.waitForTimeout(300); await app.compass(h);
    };
    await face((ahead + 180) % 360);
    await expect(page.locator('#nav-facing')).toHaveText(/Turn around/);
    await face(ahead);
    await expect(page.locator('#nav-facing')).toHaveText(/Right way/);
  });

  test('N7 swipe shows later turns, tap comes back', async ({ app, page }) => {
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await app.startNav();
    await app.moveTo(HOME.lat, HOME.lon);
    await expect(page.locator('#nav-pager-l')).toHaveText('Next turn');
    const box = (await page.locator('#nav-card').boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.8, y); await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, y, { steps: 6 }); await page.mouse.up();
    await expect(page.locator('#nav-pager-l')).toHaveText(/Turn 2 of \d+ ahead/);
    await page.locator('#nav-card').click();
    await expect(page.locator('#nav-pager-l')).toHaveText('Next turn');
  });

  test('N8 End needs two taps', async ({ app, page }) => {
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await app.startNav();
    await page.locator('#nav-stop').click();
    await expect(page.locator('#nav-overlay')).toHaveClass(/active/);
    await expect(page.locator('#nav-stop')).toHaveText('Tap to end');
    await page.locator('#nav-stop').click();
    await expect(page.locator('#nav-overlay')).not.toHaveClass(/active/);
    await page.locator('#history-btn').click();
    await expect(page.locator('#history-list')).toContainText('ended early');
  });

  test('N9 arriving ends the trip and logs it in Activity', async ({ app, page }) => {
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await app.startNav();
    await app.travel({ stepMs: 25 });
    await expect(page.locator('#toast')).toContainText('You have arrived');
    await expect(page.locator('#nav-overlay')).not.toHaveClass(/active/);
    await page.locator('#history-btn').click();
    await expect(page.locator('#history-totals')).toContainText(/1\s*trips? completed/);
    await expect(page.locator('#history-totals')).not.toContainText('0.0 km');
  });

  test('N10 reloading mid-trip offers to resume', async ({ app, page }) => {
    await app.planTo('Liverpool', 'Liverpool Street Station');
    await app.startNav();
    await app.moveTo(HOME.lat, HOME.lon);
    await page.waitForTimeout(300);
    await page.reload();
    await expect(page.locator('#resume-banner')).toBeVisible();
    await expect(page.locator('#resume-text')).toContainText('Liverpool Street Station');
    await page.locator('#resume-go').click();
    await expect(page.locator('#nav-overlay')).toHaveClass(/active/);
  });

  test('N11 walking-only trips navigate too', async ({ app, page }) => {
    await app.planTo('Young V', NEARBY.name);
    await app.startNav();
    await expect(page.locator('#nav-stop')).toHaveText('End walk');
    await app.travel({ stepMs: 30 });
    await expect(page.locator('#toast')).toContainText('You have arrived');
  });
});
