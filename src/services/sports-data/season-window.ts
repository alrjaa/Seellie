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
 * من المواسم التي فيها بيانات حقيقية: أحدث = حالي، الذي يليه = سابق.
 */
export function windowFromAvailableSeasons(
  seasonsWithData: number[]
): SeasonWindow | null {
  const cleaned = [
    ...new Set(
      seasonsWithData.filter((y) => Number.isFinite(y) && y >= 1990 && y <= 2100)
    ),
  ].sort((a, b) => b - a);
  if (!cleaned.length) return null;
  return {
    current: cleaned[0],
    previous: cleaned[1] ?? null,
  };
}

/**
 * عند اكتشاف موسم أحدث متاح فعلياً:
 * الجديد → الحالي، الحالي → السابق، السابق القديم → يُحذف.
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
 * دمج المخزن الحالي مع المواسم المكتشفة من المزود.
 */
export function mergeWindowWithDiscovery(
  existing: SeasonWindow | null | undefined,
  seasonsWithData: number[]
): SeasonRotation {
  const discovered = windowFromAvailableSeasons(seasonsWithData);
  if (!discovered) {
    return {
      window: existing ?? { current: 0, previous: null },
      purgeSeason: null,
      rotated: false,
    };
  }

  if (!existing || !existing.current) {
    return { window: discovered, purgeSeason: null, rotated: false };
  }

  if (discovered.current > existing.current) {
    return rotateToNewSeason(existing, discovered.current);
  }

  if (existing.previous == null && discovered.previous != null) {
    return {
      window: {
        current: existing.current,
        previous: discovered.previous,
      },
      purgeSeason: null,
      rotated: false,
    };
  }

  return { window: existing, purgeSeason: null, rotated: false };
}

export function pickLatestAvailableSeason(
  seasonsWithData: number[]
): number | null {
  return windowFromAvailableSeasons(seasonsWithData)?.current ?? null;
}

/** مرشحو المواسم للفحص من API — حول الموسم الرياضي الحالي (+ سنة قادمة) */
export function seasonProbeList(referenceYear?: number): number[] {
  const now = new Date();
  const y = referenceYear ?? now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  // موسم كروي يبدأ عادة من يوليو/أغسطس — سنة البداية = base
  const base = m >= 7 ? y : y - 1;
  return [
    ...new Set([base + 1, base, base - 1, base - 2, base - 3, base - 4]),
  ].filter((s) => s >= 2018 && s <= 2100);
}

/** سنة بداية الموسم الرياضي المتوقع حسب التقويم */
export function expectedSeasonBase(referenceDate?: Date): number {
  const now = referenceDate ?? new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  return m >= 7 ? y : y - 1;
}
