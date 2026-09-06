/**
 * Quick post-merge smoke: login UI, admin route, top follower screens.
 * Uses production BASE_URL; optional follower credentials for authenticated screens.
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'https://www.seellie.com';

test.describe('Post-merge smoke', () => {
  test('login page', async ({ page }) => {
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('textbox', { name: /البريد|email/i }).first()
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole('button', { name: /^دخول$|^Sign in$/i }).first()
    ).toBeVisible();
  });

  test('admin route', async ({ page }) => {
    await page.goto(BASE + '/admin', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('top screens: home / competitions / unique (auth optional)', async ({
    page,
  }) => {
    const email = process.env.E2E_FOLLOWER_EMAIL;
    const password = process.env.E2E_FOLLOWER_PASSWORD;
    test.skip(!email || !password, 'E2E_FOLLOWER_* required for screen smoke');

    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
    await page.getByRole('textbox', { name: /البريد|email/i }).first().fill(email!);
    await page
      .getByRole('textbox', { name: /كلمة المرور|password/i })
      .first()
      .fill(password!);
    await page.getByRole('button', { name: /^دخول$|^Sign in$/i }).first().click();
    await page.waitForTimeout(3000);

    for (const path of ['/', '/competitions', '/unique']) {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toBeVisible();
      await page.waitForTimeout(800);
    }
  });
});
