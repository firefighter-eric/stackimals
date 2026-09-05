import { test, expect, boot, stage } from './helpers';

test('production plays a round and restarts without test hooks or missing images', async ({ page }) => {
  await boot(page);
  expect(await page.evaluate(() => typeof window.__STACKIMALS_TEST__)).toBe('undefined');
  await page.getByRole('button', { name: '投放', exact: true }).click();
  await expect(stage(page)).toHaveAttribute('data-game-phase', 'aiThinking');
  await page.keyboard.press('Escape');
  await page.locator('#request-restart').click();
  await page.getByRole('alertdialog').getByRole('button', { name: '重新开始', exact: true }).click();
  await expect(stage(page)).toHaveAttribute('data-game-phase', 'humanAiming');
  await expect(page.getByLabel('第 1 回合', { exact: true })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: '投放', exact: true }).click();
  await expect(page.getByLabel('第 2 回合', { exact: true })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(await page.evaluate(() => [...document.images].filter((image) => !image.complete || !image.naturalWidth).map((image) => image.src))).toEqual([]);
});

test('production pause does not cause an immediate timeout loss', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: '投放', exact: true }).click();
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(9100);
  await page.getByRole('button', { name: '继续游戏', exact: true }).click();
  await expect(page.getByLabel('第 2 回合', { exact: true })).toBeVisible();
  await expect(stage(page)).toHaveAttribute('data-game-phase', 'humanAiming');
});
