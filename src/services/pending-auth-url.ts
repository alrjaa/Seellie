/**
 * يحفظ رابط الاستعادة القادم من البريد حتى تستهلكه شاشة reset-password.
 * على الويب: نلتقط ?code= / #access_token / أخطاء OTP فوراً قبل أن يمسحها الراوتر.
 */

const WEB_CAPTURE_KEY = 'seellie.authCallbackUrl';
const WEB_EMAIL_KEY = 'seellie.resetEmail';

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

function hasAuthCallbackPayload(url: string): boolean {
  if (hasAuthTokens(url)) return true;
  return !!getAuthCallbackError(url);
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

function persistCapturedUrl(href: string) {
  pendingAuthUrl = href;
  if (typeof window === 'undefined') return;
  try {
    // FIX-08 F08-S06: never persist token-bearing auth URLs in localStorage.
    // In-memory + sessionStorage (tab-scoped) is enough for SPA router races.
    window.sessionStorage.setItem(WEB_CAPTURE_KEY, href);
    window.localStorage.removeItem(WEB_CAPTURE_KEY);
  } catch {
    // ignore
  }
}

/** يُستدعى عند تحميل التطبيق على الويب بأسرع ما يمكن */
export function captureWebAuthUrlEarly(): void {
  if (typeof window === 'undefined') return;
  try {
    const href = window.location.href;
    if (!hasAuthCallbackPayload(href)) return;
    persistCapturedUrl(href);
  } catch {
    // ignore
  }
}

// التقاط فوري عند استيراد الوحدة في المتصفح
captureWebAuthUrlEarly();

export function setPendingAuthUrl(url: string | null) {
  if (!url) {
    pendingAuthUrl = null;
    return;
  }
  if (hasAuthCallbackPayload(url)) {
    persistCapturedUrl(url);
  } else {
    pendingAuthUrl = url;
  }
}

/** قراءة الرابط المحفوظ دون حذفه (حتى ينجح الاستهلاك) */
export function peekPendingAuthUrl(): string | null {
  if (pendingAuthUrl) return pendingAuthUrl;
  if (typeof window === 'undefined') return null;
  try {
    const fromSession = window.sessionStorage.getItem(WEB_CAPTURE_KEY);
    if (fromSession) return fromSession;
    // One-time migration: consume legacy localStorage then wipe it
    const legacy = window.localStorage.getItem(WEB_CAPTURE_KEY);
    if (legacy) {
      try {
        window.sessionStorage.setItem(WEB_CAPTURE_KEY, legacy);
      } catch {
        // ignore
      }
      window.localStorage.removeItem(WEB_CAPTURE_KEY);
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

/** حذف بعد نجاح تفعيل الجلسة فقط */
export function clearPendingAuthUrl(): void {
  pendingAuthUrl = null;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(WEB_CAPTURE_KEY);
    window.sessionStorage.removeItem(WEB_CAPTURE_KEY);
  } catch {
    // ignore
  }
}

export function setPendingResetEmail(email: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (email) {
      window.localStorage.setItem(WEB_EMAIL_KEY, email.trim().toLowerCase());
    } else {
      window.localStorage.removeItem(WEB_EMAIL_KEY);
    }
  } catch {
    // ignore
  }
}

export function peekPendingResetEmail(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(WEB_EMAIL_KEY);
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
  return (
    isPasswordRecoveryUrl(url) ||
    hasAuthTokens(url.toLowerCase()) ||
    !!getAuthCallbackError(url)
  );
}
