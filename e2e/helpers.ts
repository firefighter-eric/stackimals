import { expect, test as base, type Page } from '@playwright/test';
import type { TestSnapshot } from '../src/game/testApi';

export const test = base.extend<{ runtimeErrors: string[] }>({
  runtimeErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await use(errors);
    expect(errors, 'no unhandled runtime errors').toEqual([]);
  }, { auto: true }],
});
export { expect };
export const state = (page: Page): Promise<TestSnapshot> => page.evaluate(() => window.__STACKIMALS_TEST__!.snapshot());
export const stage = (page: Page) => page.locator('.game-stage');
export async function boot(page: Page) {
  await page.goto('/');
  await expect(stage(page)).toHaveAttribute('data-game-phase', 'humanAiming');
  await expect(page.getByRole('button', { name: '投放', exact: true })).toBeEnabled();
}
export async function waitForPhase(page: Page, phase: TestSnapshot['phase']) {
  await expect(stage(page)).toHaveAttribute('data-game-phase', phase);
}
