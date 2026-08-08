/**
 * يحفظ رابط الاستعادة القادم من البريد حتى تستهلكه شاشة reset-password.
 */
let pendingAuthUrl: string | null = null;

export function setPendingAuthUrl(url: string | null) {
  pendingAuthUrl = url;
}

export function takePendingAuthUrl(): string | null {
  const url = pendingAuthUrl;
  pendingAuthUrl = null;
  return url;
}

export function peekPendingAuthUrl(): string | null {
  return pendingAuthUrl;
}

function hasAuthTokens(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes('access_token=') ||
    u.includes('refresh_token=') ||
    u.includes('token_hash=') ||
    u.includes('type=recovery') ||
    u.includes('type%3drecovery') ||
    /[?&#]code=/.test(u)
  );
}

/**
 * رابط استعادة حقيقي من البريد (فيه رموز) — وليس مجرد فتح /reset-password.
 */
export function isPasswordRecoveryUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  const recoveryType =
    u.includes('type=recovery') || u.includes('type%3drecovery');
  if (recoveryType) return true;
  // المسار Alone لا يكفي — كان يسبب ظهور الشاشة ثم اختفاءها
  if (u.includes('/reset-password') && hasAuthTokens(u)) return true;
  return false;
}

export function isAuthCallbackUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return isPasswordRecoveryUrl(url) || hasAuthTokens(url.toLowerCase());
}
