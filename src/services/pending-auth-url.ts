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

export function isPasswordRecoveryUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  // لوحة Supabase ترسل غالباً إلى Site URL (الجذر) بـ ?code= أو #access_token
  return (
    u.includes('reset-password') ||
    u.includes('type=recovery') ||
    u.includes('type%3drecovery') ||
    u.includes('access_token=') ||
    u.includes('refresh_token=') ||
    u.includes('token_hash=') ||
    // PKCE: أي صفحة فيها code= بعد رابط الاستعادة
    /[?&#]code=/.test(u)
  );
}
