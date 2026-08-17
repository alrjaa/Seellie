/** Pure ad preference helpers — safe for unit tests (no AsyncStorage). */

export type AdPreferences = {
  hiddenAdIds: string[];
  reportedAdIds: string[];
  /** Reserved for future personalization — not a global ad kill switch. */
  personalizedAds: boolean;
};

export const DEFAULT_AD_PREFERENCES: AdPreferences = {
  hiddenAdIds: [],
  reportedAdIds: [],
  personalizedAds: true,
};

export function sanitizeAdPreferences(raw: unknown): AdPreferences {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_AD_PREFERENCES };
  }
  const row = raw as Record<string, unknown>;
  const hidden = Array.isArray(row.hiddenAdIds)
    ? row.hiddenAdIds
        .map((id) => String(id ?? '').trim().slice(0, 80))
        .filter(Boolean)
    : [];
  const reported = Array.isArray(row.reportedAdIds)
    ? row.reportedAdIds
        .map((id) => String(id ?? '').trim().slice(0, 80))
        .filter(Boolean)
    : [];
  return {
    hiddenAdIds: [...new Set(hidden)].slice(0, 80),
    reportedAdIds: [...new Set(reported)].slice(0, 80),
    personalizedAds: row.personalizedAds !== false,
  };
}

export function hideAdInPreferences(
  prefs: AdPreferences,
  adId: string
): AdPreferences {
  const id = adId.trim().slice(0, 80);
  if (!id || prefs.hiddenAdIds.includes(id)) return prefs;
  return {
    ...prefs,
    hiddenAdIds: [...prefs.hiddenAdIds, id].slice(-80),
  };
}

export function unhideAdInPreferences(
  prefs: AdPreferences,
  adId: string
): AdPreferences {
  const id = adId.trim().slice(0, 80);
  return {
    ...prefs,
    hiddenAdIds: prefs.hiddenAdIds.filter((x) => x !== id),
  };
}

export function reportAdInPreferences(
  prefs: AdPreferences,
  adId: string
): AdPreferences {
  const id = adId.trim().slice(0, 80);
  if (!id) return prefs;
  const hidden = prefs.hiddenAdIds.includes(id)
    ? prefs.hiddenAdIds
    : [...prefs.hiddenAdIds, id].slice(-80);
  const reported = prefs.reportedAdIds.includes(id)
    ? prefs.reportedAdIds
    : [...prefs.reportedAdIds, id].slice(-80);
  return { ...prefs, hiddenAdIds: hidden, reportedAdIds: reported };
}

export function setPersonalizedAdsPreference(
  prefs: AdPreferences,
  enabled: boolean
): AdPreferences {
  return { ...prefs, personalizedAds: enabled };
}
