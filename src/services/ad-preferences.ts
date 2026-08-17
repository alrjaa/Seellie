import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_AD_PREFERENCES,
  hideAdInPreferences,
  reportAdInPreferences,
  sanitizeAdPreferences,
  setPersonalizedAdsPreference,
  unhideAdInPreferences,
  type AdPreferences,
} from '@/services/ad-preferences-core';

const STORAGE_PREFIX = 'seellie.adPrefs.v1.';

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

const listeners = new Map<string, Set<(prefs: AdPreferences) => void>>();

function emit(userId: string, prefs: AdPreferences): void {
  listeners.get(userId)?.forEach((cb) => cb(prefs));
}

export function subscribeAdPreferences(
  userId: string,
  cb: (prefs: AdPreferences) => void
): () => void {
  const set = listeners.get(userId) ?? new Set();
  set.add(cb);
  listeners.set(userId, set);
  return () => {
    const current = listeners.get(userId);
    if (!current) return;
    current.delete(cb);
    if (!current.size) listeners.delete(userId);
  };
}

export async function loadAdPreferences(
  userId: string
): Promise<AdPreferences> {
  if (!userId) return { ...DEFAULT_AD_PREFERENCES };
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return { ...DEFAULT_AD_PREFERENCES };
    return sanitizeAdPreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_AD_PREFERENCES };
  }
}

async function persistAdPreferences(
  userId: string,
  prefs: AdPreferences
): Promise<AdPreferences> {
  const next = sanitizeAdPreferences(prefs);
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(next));
  emit(userId, next);
  return next;
}

export async function hideNativeAd(
  userId: string,
  adId: string
): Promise<AdPreferences> {
  const current = await loadAdPreferences(userId);
  return persistAdPreferences(userId, hideAdInPreferences(current, adId));
}

export async function unhideNativeAd(
  userId: string,
  adId: string
): Promise<AdPreferences> {
  const current = await loadAdPreferences(userId);
  return persistAdPreferences(userId, unhideAdInPreferences(current, adId));
}

export async function reportNativeAd(
  userId: string,
  adId: string
): Promise<AdPreferences> {
  const current = await loadAdPreferences(userId);
  return persistAdPreferences(userId, reportAdInPreferences(current, adId));
}

export async function setPersonalizedAds(
  userId: string,
  enabled: boolean
): Promise<AdPreferences> {
  const current = await loadAdPreferences(userId);
  return persistAdPreferences(
    userId,
    setPersonalizedAdsPreference(current, enabled)
  );
}

export type { AdPreferences };
