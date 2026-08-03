/** شروط الانضمام كمحلل في مساحة الفريد */
export const ANALYST_TERMS = [
  'أتعهد بنشر محتوى تحليلي رياضي موثوق ومحترم فقط.',
  'ألتزم بعدم نشر محتوى مسيء أو مضلل أو مخالف للقوانين.',
  'أوافق على مراجعة الإدارة لأي محتوى قبل أو بعد النشر.',
  'أفهم أن رمز الوصول يُرسل إلى بريدي الإلكتروني بعد الموافقة، وهو سري وغير قابل للمشاركة.',
  'أوافق على إيقاف حساب المحلل عند مخالفة الشروط دون إشعار مسبق.',
].join('\n\n');

const CODE_CHARS =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';

/** رمز وصول: أرقام + حروف + إشارات */
export function generateAnalystAccessCode(length = 10): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  const must = ['A', '7', '#'];
  must.forEach((ch, i) => {
    const idx = (i * 3) % out.length;
    out = `${out.slice(0, idx)}${ch}${out.slice(idx + 1)}`;
  });
  return out;
}

type AnalystLike = {
  status?: string;
  suspendFrom?: Date | string;
  suspendTo?: Date | string;
};

/** هل فترة الإيقاف المؤقت سارية الآن؟ */
export function isAnalystSuspendActive(analyst?: AnalystLike | null): boolean {
  if (!analyst || analyst.status !== 'suspended') return false;
  const now = Date.now();
  const from = analyst.suspendFrom
    ? new Date(analyst.suspendFrom).getTime()
    : Number.NEGATIVE_INFINITY;
  const to = analyst.suspendTo
    ? new Date(analyst.suspendTo).getTime()
    : Number.POSITIVE_INFINITY;
  if (Number.isNaN(from) || Number.isNaN(to)) return true;
  return now >= from && now <= to;
}

/** محلل يمكنه النشر (مفعّل أو منذر — وليس موقوفاً/محظوراً) */
export function isActiveAnalyst(user: {
  analyst?: AnalystLike | null;
} | null | undefined): boolean {
  const status = user?.analyst?.status;
  if (status === 'banned') return false;
  if (status === 'suspended') {
    // خارج فترة الإيقاف المؤقت يُسمح بالنشر مجدداً
    return !isAnalystSuspendActive(user?.analyst);
  }
  return status === 'active' || status === 'warned';
}
