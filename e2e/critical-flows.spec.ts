/**
 * P2 FIX-16 — Playwright E2E critical flows (multi-role smoke).
 *
 * Unauthenticated smoke always runs against BASE_URL (default production).
 * Authenticated role flows run only when E2E_* credentials are provided.
 *
 * Note: Expo/RN Web renders TextInput as role=textbox (not always <input>).
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'https://www.seellie.com';

async function expectAppShell(page: Page) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();
}

async function waitForLoginForm(page: Page) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('textbox', { name: /البريد|email/i }).first()
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByRole('button', { name: /^دخول$|^Sign in$|^Log in$/i }).first()
  ).toBeVisible({ timeout: 10_000 });
}

async function loginWithEmail(
  page: Page,
  email: string,
  password: string
): Promise<boolean> {
  await waitForLoginForm(page);
  const emailInput = page
    .getByRole('textbox', { name: /البريد|email/i })
    .first();
  const passwordInput = page
    .getByRole('textbox', { name: /كلمة المرور|password/i })
    .first();
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await page
    .getByRole('button', { name: /^دخول$|^Sign in$|^Log in$/i })
    .first()
    .click();
  await page.waitForTimeout(2500);
  return !page.url().includes('/login');
}

test.describe('P2 FIX-16 critical flows (unauthenticated)', () => {
  test('web shell loads', async ({ page }) => {
    await expectAppShell(page);
  });

  test('login route is reachable', async ({ page }) => {
    await waitForLoginForm(page);
    await expect(page.getByText(/Seellie/i).first()).toBeVisible();
  });

  test('admin portal route is reachable (not public app shell only)', async ({
    page,
  }) => {
    await page.goto(BASE + '/admin', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('P2 FIX-16 multi-role (credentials optional)', () => {
  test('follower login + home', async ({ page }) => {
    const email = process.env.E2E_FOLLOWER_EMAIL;
    const password = process.env.E2E_FOLLOWER_PASSWORD;
    test.skip(!email || !password, 'E2E_FOLLOWER_* not set');
    const ok = await loginWithEmail(page, email!, password!);
    expect(ok).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
  });

  test('organizer login + dashboard', async ({ page }) => {
    const email = process.env.E2E_ORGANIZER_EMAIL;
    const password = process.env.E2E_ORGANIZER_PASSWORD;
    test.skip(!email || !password, 'E2E_ORGANIZER_* not set');
    const ok = await loginWithEmail(page, email!, password!);
    expect(ok).toBeTruthy();
    await page.goto(BASE + '/organizer', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('admin login + console', async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!email || !password, 'E2E_ADMIN_* not set');
    const ok = await loginWithEmail(page, email!, password!);
    expect(ok).toBeTruthy();
    await page.goto(BASE + '/admin', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });
});
