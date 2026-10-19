import { test, expect } from './support/harness';

declare const S: any;

// Services that answer, eventually. Down is covered in resilience.spec.ts; slow is
// the more common case on a phone and the easier one to get wrong.

test.describe('Slow services', () => {
  test('R4 main router too slow: the backup router plans with real directions', async ({ app, page, world }) => {
    await app.open();
    await app.waitForGpsStart();
    world.delay.valhalla = 30_000;                                         // Valhalla hangs
    await app.search('to', 'Liverpool', 'Liverpool Street Station');
    await expect(page.locator('#start-nav-btn'), 'a plan within 15 s').toBeVisible({ timeout: 15_000 });
    const r = await app.state(() => ({ walkOnly: !!S.walkOnly, cycleSteps: S.cycle?.legs?.[0]?.steps?.length ?? 0,
      walkIn: !!S.walkIn, walkOut: !!S.walkOut }));
    expect(r.cycleSteps, 'turn-by-turn steps on the cycle leg').toBeGreaterThan(1);
    expect(r.walkIn && r.walkOut, 'real walking legs, not estimates').toBe(true);
    expect(await app.said(/estimated/i), 'did not fall back to estimates').toBe(false);
  });

  test('R5 slow station data: says it is still loading, then explains the failure', async ({ app, page, world }) => {
    world.delay.tfl = 12_000; world.down.tfl = true;
    await app.open({ waitForStations: false });
    await page.waitForTimeout(9000);
    expect(await app.said(/loading|still loading|fetching|getting (the )?(station|dock)/i), 'says it is still loading').toBe(true);
    await expect.poll(() => app.said(/station data/i), { message: 'explains that station data failed', timeout: 8000 }).toBe(true);
  });

  test('R6 while a plan loads, the screen shows it is working and Start is not offered', async ({ app, page, world }) => {
    await app.open();
    await app.waitForGpsStart();
    world.delay.valhalla = 3000;
    await app.clearMessages();
    await app.search('to', 'Liverpool', 'Liverpool Street Station');
    await page.waitForTimeout(1200);
    expect(await app.said(/planning|loading|finding (a |the )?(route|bike)|working/i),
      `shows it is working (messages: ${(await app.messages()).join(' | ')})`).toBe(true);
    await expect(page.locator('#start-nav-btn'), 'no Start on a half-built plan').toBeHidden();
    await expect(page.locator('#start-nav-btn')).toBeVisible({ timeout: 10_000 });
  });
});
