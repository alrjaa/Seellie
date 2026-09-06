import { test, expect } from '@playwright/test';
const BASE = process.env.E2E_BASE_URL || 'https://www.seellie.com';
test('forums route loads shell', async ({ page }) => {
  await page.goto(BASE + '/forums', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();
});
test('ads home route loads shell', async ({ page }) => {
  await page.goto(BASE + '/ads/home', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();
});
