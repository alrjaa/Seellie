/**
 * يحفظ رابط الاستعادة القادم من البريد حتى تستهلكه شاشة reset-password.
 * (الـ hash/code يضيع إن مرّ عبر params فقط)
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

/** رابط استعادة كلمة المرور (وليس magic link العادي) */
export function isPasswordRecoveryUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  return (
    u.includes('/reset-password') ||
    u.includes('type=recovery') ||
    u.includes('type%3drecovery')
  );
}

/** أي رجوع من بريد Supabase (استعادة أو magic link) وفيه رموز */
export function isAuthCallbackUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  return (
    isPasswordRecoveryUrl(u) ||
    u.includes('access_token=') ||
    u.includes('refresh_token=') ||
    u.includes('token_hash=') ||
    u.includes('type=magiclink') ||
    u.includes('type%3dmagiclink') ||
    /[?&#]code=/.test(u)
  );
}
