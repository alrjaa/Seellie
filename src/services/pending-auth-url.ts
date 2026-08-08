/**
 * يحفظ رابط الاستعادة القادم من البريد حتى تستهلكه شاشة reset-password.
 * على الويب: نلتقط ?code= / #access_token فوراً قبل أن يمسحها الراوتر.
 */

const WEB_CAPTURE_KEY = 'seellie.authCallbackUrl';

let pendingAuthUrl: string | null = null;

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

export function getAuthCallbackError(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const hash = url.includes('#') ? url.split('#')[1] || '' : '';
    const query = url.includes('?')
      ? url.split('?')[1]?.split('#')[0] || ''
      : '';
    const params = new URLSearchParams(
      [query, hash].filter(Boolean).join('&')
    );
    const code = params.get('error_code') || params.get('error');
    const desc = params.get('error_description') || params.get('error');
    if (!code && !desc) return null;
    if (
      (code && /otp_expired|expired|access_denied/i.test(code)) ||
      (desc && /expired|invalid/i.test(desc))
    ) {
      return 'otp_expired';
    }
    return desc || code;
  } catch {
    return null;
  }
}

/** يُستدعى عند تحميل التطبيق على الويب بأسرع ما يمكن */
export function captureWebAuthUrlEarly(): void {
  if (typeof window === 'undefined') return;
  try {
    const href = window.location.href;
    if (!hasAuthTokens(href)) return;
    pendingAuthUrl = href;
    window.sessionStorage.setItem(WEB_CAPTURE_KEY, href);
  } catch {
    // ignore
  }
}

// التقاط فوري عند استيراد الوحدة في المتصفح
captureWebAuthUrlEarly();

export function setPendingAuthUrl(url: string | null) {
  pendingAuthUrl = url;
  if (typeof window !== 'undefined' && url && hasAuthTokens(url)) {
    try {
      window.sessionStorage.setItem(WEB_CAPTURE_KEY, url);
    } catch {
      // ignore
    }
  }
}

export function takePendingAuthUrl(): string | null {
  let url = pendingAuthUrl;
  pendingAuthUrl = null;
  if (!url && typeof window !== 'undefined') {
    try {
      url = window.sessionStorage.getItem(WEB_CAPTURE_KEY);
      window.sessionStorage.removeItem(WEB_CAPTURE_KEY);
    } catch {
      // ignore
    }
  }
  return url;
}

export function peekPendingAuthUrl(): string | null {
  if (pendingAuthUrl) return pendingAuthUrl;
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(WEB_CAPTURE_KEY);
  } catch {
    return null;
  }
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
  if (u.includes('/reset-password') && hasAuthTokens(u)) return true;
  return false;
}

export function isAuthCallbackUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return isPasswordRecoveryUrl(url) || hasAuthTokens(url.toLowerCase());
}
