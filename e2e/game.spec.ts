import { test, expect, boot, state, stage, waitForPhase } from './helpers';
import type { Route } from '@playwright/test';

for (const actor of ['human', 'ai'] as const) {
  test(`${actor} drop excludes a long pause from its resolution deadline`, async ({ page }) => {
    await boot(page);
    await page.getByRole('button', { name: '投放', exact: true }).click();
    if (actor === 'ai') await waitForPhase(page, 'aiSettling');
    else await page.waitForTimeout(150);
    await page.keyboard.press('Escape');
    await waitForPhase(page, 'paused');
    const before = await state(page);
    // Exceed the real 8s timeout: the paused simulation must not consume it.
    await page.waitForTimeout(9100);
    expect((await state(page)).bodies).toEqual(before.bodies);
    await page.getByRole('button', { name: '继续游戏', exact: true }).click();
    await waitForPhase(page, 'humanAiming');
    expect(await state(page)).toMatchObject({ round: 2, bodyCount: 2, winner: null });
  });
}

test('pausing during the quiet window does not count as 850ms of stability', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: '投放', exact: true }).click();
  await page.waitForFunction(() => window.__STACKIMALS_TEST__!.snapshot().bodies[0]?.isSleeping);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.waitForTimeout(150);
  await waitForPhase(page, 'humanSettling');
  await waitForPhase(page, 'aiThinking');
});

test('focused buttons retain activation semantics and held controls support keyboards', async ({ page }) => {
  await boot(page);
  const pause = page.getByRole('button', { name: '暂停游戏', exact: true });
  await pause.focus();
  await page.keyboard.press('Enter');
  await waitForPhase(page, 'paused');
  expect((await state(page)).bodyCount).toBe(0);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await page.getByRole('button', { name: /换动物，还剩/ }).focus();
  await page.keyboard.press('Enter');
  expect(await state(page)).toMatchObject({ bodyCount: 0, swapsHuman: 2 });
  await page.getByRole('button', { name: '向右旋转', exact: true }).focus();
  await page.keyboard.down('Enter');
  await page.waitForTimeout(400);
  await page.keyboard.up('Enter');
  expect(Math.abs((await state(page)).previewAngle!)).toBeGreaterThan(20);
  await page.getByRole('button', { name: '向右移动', exact: true }).focus();
  const before = (await state(page)).previewPosition!.x;
  await page.keyboard.down('Space');
  await page.waitForTimeout(350);
  await page.keyboard.up('Space');
  expect((await state(page)).previewPosition!.x).toBeGreaterThan(before + 15);
  expect((await state(page)).bodyCount).toBe(0);
  await page.locator('#stackimals-game').focus();
  await page.keyboard.press('Space');
  expect((await state(page)).bodyCount).toBe(1);
});

test('held pointer controls release outside the button and on window blur', async ({ page }) => {
  await boot(page);
  const move = await page.getByRole('button', { name: '向左移动', exact: true }).boundingBox();
  const before = (await state(page)).previewPosition!.x;
  await page.mouse.move(move!.x + move!.width / 2, move!.y + move!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.mouse.move(5, 5);
  await page.mouse.up();
  const released = (await state(page)).previewPosition!.x;
  expect(released).toBeLessThan(before - 15);
  await page.waitForTimeout(250);
  expect((await state(page)).previewPosition!.x).toBe(released);
  await page.locator('#stackimals-game').focus();
  await page.keyboard.down('KeyE');
  await page.waitForTimeout(250);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const angle = (await state(page)).previewAngle;
  await page.waitForTimeout(250);
  expect((await state(page)).previewAngle).toBe(angle);
  await page.keyboard.up('KeyE');
});

test('roster P/Esc closes to settings without resuming AI', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: '投放', exact: true }).click();
  await waitForPhase(page, 'aiThinking');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /选择我的动物/ }).click();
  await page.keyboard.press('p');
  await expect(page.getByRole('dialog', { name: '游戏已暂停' })).toBeVisible();
  await expect(page.locator('#open-animal-roster')).toBeFocused();
  await page.waitForTimeout(1500);
  expect(await state(page)).toMatchObject({ phase: 'paused', bodyCount: 1, turn: 'ai' });
});

test('all settings dialogs trap focus, restore triggers, and isolate the game', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: '暂停游戏', exact: true }).click();
  await expect(page.locator('.game-hud')).toHaveAttribute('inert', '');
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press(index % 2 ? 'Shift+Tab' : 'Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[aria-modal="true"]')))).toBe(true);
  }
  await page.locator('#request-restart').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#request-restart')).toBeFocused();
  await page.locator('#open-animal-roster').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#open-animal-roster')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause-game')).toBeFocused();
  await expect(page.locator('.game-hud')).not.toHaveAttribute('inert');
});

test('orientation freezes physics and preserves an existing user pause', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  await page.getByRole('button', { name: '投放', exact: true }).click();
  await page.setViewportSize({ width: 844, height: 390 });
  await waitForPhase(page, 'paused');
  await expect(page.getByRole('dialog', { name: '请竖屏游玩' })).toBeVisible();
  const before = await state(page);
  await page.keyboard.press('p');
  await page.waitForTimeout(1000);
  expect((await state(page)).bodies).toEqual(before.bodies);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(stage(page)).not.toHaveAttribute('data-game-phase', 'paused');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.setViewportSize({ width: 390, height: 844 });
  await waitForPhase(page, 'paused');
  await expect(page.getByRole('dialog', { name: '游戏已暂停' })).toBeVisible();
});

test('initial landscape boot is paused before input becomes available', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  await waitForPhase(page, 'paused');
  await page.keyboard.press('Space');
  expect((await state(page)).bodyCount).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await waitForPhase(page, 'humanAiming');
});

test('asset errors stop the match and retry recreates a usable engine', async ({ page }) => {
  await page.route('**/assets/game/animals/bird.webp', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await waitForPhase(page, 'error');
  await expect(page.getByRole('alertdialog')).toContainText('部分动物未能加载');
  await page.unroute('**/assets/game/animals/bird.webp');
  await page.getByRole('button', { name: '再试一次', exact: true }).click();
  await waitForPhase(page, 'humanAiming');
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: '投放', exact: true }).click();
  await waitForPhase(page, 'aiThinking');
});

test('a stalled image request reaches a recoverable error instead of loading forever', async ({ page }) => {
  const pending: Route[] = [];
  await page.route('**/assets/game/animals/bird.webp', (route) => { pending.push(route); });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(stage(page)).toHaveAttribute('data-game-phase', 'error', { timeout: 20_000 });
  await expect(page.getByRole('button', { name: '再试一次', exact: true })).toBeEnabled();
  await page.unroute('**/assets/game/animals/bird.webp');
  // The disposed engine may already have cancelled some of these requests.
  await Promise.allSettled(pending.map((route) => route.abort()));
  await page.getByRole('button', { name: '再试一次', exact: true }).click();
  await waitForPhase(page, 'humanAiming');
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('startup retry remounts after its underlying failure is removed', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.ResizeObserver;
    Object.assign(window, { __restoreResizeObserver: () => { window.ResizeObserver = original; } });
    window.ResizeObserver = class extends original { constructor() { super(() => {}); throw new Error('Simulated startup failure'); } };
  });
  await page.goto('/');
  await waitForPhase(page, 'error');
  await page.evaluate(() => (window as unknown as { __restoreResizeObserver(): void }).__restoreResizeObserver());
  await page.getByRole('button', { name: '再试一次', exact: true }).click();
  await waitForPhase(page, 'humanAiming');
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('a late fall is attributed to the previous releaser before the next drop', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: '投放', exact: true }).click();
  await waitForPhase(page, 'aiThinking');
  await waitForPhase(page, 'humanAiming');
  expect((await state(page)).round).toBe(2);
  // AI was the last releaser, but the fallen old bird belongs to the human.
  await page.evaluate(() => window.__STACKIMALS_TEST__!.forceFall('animal-1'));
  await waitForPhase(page, 'gameOver');
  expect((await state(page)).winner).toBe('human');
});

for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1024, height: 768 }]) {
  test(`layout and controls fit ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await boot(page);
    expect(await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }))).toEqual(size);
    const controls = await page.locator('.game-controls').boundingBox();
    expect(controls!.y + controls!.height).toBeLessThanOrEqual(size.height);
    const last = await page.getByRole('button', { name: '向右移动', exact: true }).boundingBox();
    expect(last!.x + last!.width).toBeLessThanOrEqual(size.width);
    await page.getByRole('button', { name: '暂停游戏', exact: true }).click();
    const modal = await page.getByRole('dialog').boundingBox();
    expect(modal!.y).toBeGreaterThanOrEqual(0);
    expect(modal!.y + modal!.height).toBeLessThanOrEqual(size.height);
  });
}
