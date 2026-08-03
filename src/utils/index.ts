import { i18n } from '@/i18n';

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/** BCP-47 locale tag for APIs that honor it */
export function appLocaleTag() {
  return i18n.locale === 'en' ? 'en-US' : 'ar-SA';
}

export function isAppEnglish() {
  return i18n.locale === 'en';
}

const WEEKDAYS_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const WEEKDAYS_AR = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
] as const;

const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const MONTHS_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const;

function toDate(date: Date | string | number | null | undefined): Date | null {
  if (date == null || date === '') return null;
  if (date instanceof Date) {
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof date === 'number') {
    const d = new Date(date);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof date === 'string') {
    const d = new Date(date);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // Firestore Timestamp-like / plain serialized objects
  if (typeof date === 'object') {
    const anyDate = date as { toDate?: () => Date; seconds?: number };
    if (typeof anyDate.toDate === 'function') {
      try {
        const d = anyDate.toDate();
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
      } catch {
        return null;
      }
    }
    if (typeof anyDate.seconds === 'number') {
      const d = new Date(anyDate.seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * تنسيق تاريخ حسب لغة التطبيق — لا يعتمد على Intl الجهاز
 * (Hermes على iOS غالباً يتجاهل locale ويتبع لغة الهاتف).
 */
export function formatArabicDate(date: Date | string | number | null | undefined) {
  const d = toDate(date);
  if (!d) return '';

  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear();
  const weekday = d.getDay();

  if (isAppEnglish()) {
    return `${WEEKDAYS_EN[weekday]}, ${MONTHS_EN[month]} ${day}, ${year}`;
  }

  return `${WEEKDAYS_AR[weekday]}، ${day} ${MONTHS_AR[month]} ${year}`;
}

/** وقت حسب لغة التطبيق */
export function formatArabicTime(date: Date | string | number | null | undefined) {
  const d = toDate(date);
  if (!d) return '';

  let hours = d.getHours();
  const minutes = pad2(d.getMinutes());

  if (isAppEnglish()) {
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes} ${ampm}`;
  }

  return `${pad2(hours)}:${minutes}`;
}

export function formatAppNumber(value: number) {
  if (isAppEnglish()) {
    return String(value);
  }
  try {
    return value.toLocaleString('ar-SA');
  } catch {
    return String(value);
  }
}

export function initials(name: string) {
  return (name || '?').trim().slice(0, 2);
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export { createId } from './id';

export {
  allocateUniqueHandle,
  ensureAccountIdentity,
  formatRegistrationId,
  nextRegistrationId,
  normalizeHandle,
  registrationPrefix,
} from './account';

export {
  buildRoundRobinFixtures,
  computeStandings,
  formatVenueAddress,
  type StandingRow,
} from './competition';

export {
  COMPETITION_ORG_TERMS,
  MIN_COMPETITION_TEAMS,
  buildCompetitionVenueAddress,
  nextCompetitionVisibleId,
} from './competition-request';

export {
  FREELANCER_PATH_TERMS,
  ORGANIZER_PATH_TERMS,
  ROLE_LABEL,
  SECONDARY_ROLE_LABEL,
  getSecondaryRole,
  normalizeUserRoles,
  userHasRole,
  type SecondaryRole,
} from './roles';
