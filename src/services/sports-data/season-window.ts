/**
 * منطق نافذة الموسمين التشغيلية فقط (حالي + سابق).
 * لا أرشفة — الحذف فقط بعد تأكيد موسم جديد متاح ومُدخل.
 */

export type SeasonWindow = {
  current: number;
  previous: number | null;
};

export type SeasonRotation = {
  window: SeasonWindow;
  /** موسم يُحذف فقط بعد نجاح إدخال الموسم الجديد */
  purgeSeason: number | null;
  rotated: boolean;
};

/** هل الموسم ضمن النافذة المسموحة؟ */
export function isSeasonInWindow(
  season: number,
  window: SeasonWindow | null | undefined
): boolean {
  if (!window) return false;
  if (season === window.current) return true;
  if (window.previous != null && season === window.previous) return true;
  return false;
}

/**
 * عند اكتشاف موسم أحدث متاح فعلياً:
 * الجديد → الحالي، الحالي → السابق، السابق القديم → يُحذف.
 * إن لم يكن أحدث: لا تدوير ولا حذف.
 */
export function rotateToNewSeason(
  existing: SeasonWindow | null | undefined,
  newlyAvailableSeason: number
): SeasonRotation {
  if (
    !Number.isFinite(newlyAvailableSeason) ||
    newlyAvailableSeason < 1990 ||
    newlyAvailableSeason > 2100
  ) {
    return {
      window: existing ?? { current: newlyAvailableSeason, previous: null },
      purgeSeason: null,
      rotated: false,
    };
  }

  if (!existing) {
    return {
      window: { current: newlyAvailableSeason, previous: null },
      purgeSeason: null,
      rotated: false,
    };
  }

  if (newlyAvailableSeason <= existing.current) {
    return { window: existing, purgeSeason: null, rotated: false };
  }

  return {
    window: {
      current: newlyAvailableSeason,
      previous: existing.current,
    },
    purgeSeason: existing.previous,
    rotated: true,
  };
}

/**
 * بعد معرفة المواسم التي فيها بيانات حقيقية من المزود،
 * اختر أحدث موسم كمرشح «حالي» محتمل.
 */
export function pickLatestAvailableSeason(seasonsWithData: number[]): number | null {
  const cleaned = [...new Set(seasonsWithData.filter((y) => Number.isFinite(y) && y >= 1990))]
    .sort((a, b) => b - a);
  return cleaned[0] ?? null;
}

/** مرشحو المواسم للفحص من API — بدون تاريخ طويل */
export function seasonProbeList(referenceYear?: number): number[] {
  const now = new Date();
  const y = referenceYear ?? now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const base = m >= 7 ? y : y - 1;
  return [...new Set([base, base - 1, base + 1, base - 2])].filter(
    (s) => s >= 2018 && s <= 2100
  );
}
