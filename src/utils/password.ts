/**
 * تجزئة محلية لكلمات المرور — أفضل من النص الواضح، وليست بديلاً عن Auth خادم.
 * تدعم التحقق من القيم القديمة (نص واضح) للترحيل التدريجي.
 */

const PREFIX = 'seellie$v1$';

/** تجزئة متزامنة مستقرة (FNV-1a متعدد الجولات + ملح ثابت محلي) */
export function hashPassword(password: string): string {
  const input = `seellie.local.v1:${password}`;
  let h1 = 2166136261;
  let h2 = 0x811c9dc5;
  for (let round = 0; round < 96; round++) {
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i) + round;
      h1 ^= c;
      h1 = Math.imul(h1, 16777619);
      h2 ^= c << (round % 7);
      h2 = Math.imul(h2, 0x01000193);
    }
  }
  const a = (h1 >>> 0).toString(16).padStart(8, '0');
  const b = (h2 >>> 0).toString(16).padStart(8, '0');
  let mix = '';
  for (let i = 0; i < input.length; i++) {
    mix += (input.charCodeAt(i) * (i + 17) + h1 + h2).toString(16);
  }
  return `${PREFIX}${a}${b}${mix.slice(0, 48)}`;
}

export function isHashedPassword(value: string | undefined | null): boolean {
  return !!value && value.startsWith(PREFIX);
}

export function verifyPassword(
  password: string,
  stored: string | undefined | null
): boolean {
  if (!stored) return false;
  if (isHashedPassword(stored)) {
    return hashPassword(password) === stored;
  }
  // ترحيل: حسابات البذرة القديمة بنص واضح
  return stored === password;
}

/** إن كانت القيمة نصاً واضحاً، أعد التجزئة؛ وإلا أعدها كما هي */
export function ensurePasswordHashed(stored: string): string {
  if (isHashedPassword(stored)) return stored;
  return hashPassword(stored);
}
