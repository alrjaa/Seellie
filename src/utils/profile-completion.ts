import type { User } from '@/data/initial-data';
import { isValidEmail, normalizeEmail } from '@/utils';

export const COMPLETE_PROFILE_HREF = '/complete-profile';

function digits(mobile?: string) {
  return (mobile || '').replace(/\D/g, '');
}

/** هل أكمل المستخدم البيانات الإلزامية قبل استخدام وظائف التطبيق */
export function isAppProfileComplete(
  user: User | null | undefined
): boolean {
  if (!user) return false;
  // بوابة المشرف منفصلة
  if (user.role === 'superadmin' || user.activeRole === 'superadmin') {
    return true;
  }

  const name = (user.name || '').trim();
  const email = normalizeEmail(user.email || '');
  const mobileOk = digits(user.mobile).length >= 8;
  const country = (user.country || '').trim();
  const region = (user.region || '').trim();
  const city = (user.city || '').trim();
  const privacyOk = !!user.privacyAcceptedAt;
  const termsOk = !!user.termsAcceptedAt;
  const notifOk =
    user.notificationsConsent === true ||
    user.notificationsConsent === false;

  return (
    name.length >= 2 &&
    isValidEmail(email) &&
    mobileOk &&
    !!country &&
    !!region &&
    !!city &&
    privacyOk &&
    termsOk &&
    notifOk
  );
}

export function missingAppProfileFields(
  user: User | null | undefined
): string[] {
  if (!user) return ['account'];
  const missing: string[] = [];
  if ((user.name || '').trim().length < 2) missing.push('name');
  if (!isValidEmail(normalizeEmail(user.email || ''))) missing.push('email');
  if (digits(user.mobile).length < 8) missing.push('mobile');
  if (!(user.country || '').trim()) missing.push('country');
  if (!(user.region || '').trim()) missing.push('region');
  if (!(user.city || '').trim()) missing.push('city');
  if (!user.privacyAcceptedAt) missing.push('privacy');
  if (!user.termsAcceptedAt) missing.push('terms');
  if (
    user.notificationsConsent !== true &&
    user.notificationsConsent !== false
  ) {
    missing.push('notifications');
  }
  return missing;
}
