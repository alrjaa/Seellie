import { getJson, removeJson, setJson } from '@/services/storage';
import type { SeasonWindow } from './season-window';
import { isSeasonInWindow } from './season-window';

type CacheBox<T> = { expires: number; value: T; leagueId?: number; season?: number };

const PREFIX = 'sports_ops_v2:';

export async function readSportsCache<T>(key: string): Promise<T | null> {
  try {
    const box = await getJson<CacheBox<T>>(PREFIX + key);
    if (!box || typeof box.expires !== 'number') return null;
    if (Date.now() > box.expires) {
      await removeJson(PREFIX + key);
      return null;
    }
    return box.value;
  } catch {
    return null;
  }
}

export async function writeSportsCache<T>(
  key: string,
  value: T,
  ttlMs: number,
  meta?: { leagueId: number; season: number }
): Promise<void> {
  try {
    await setJson(PREFIX + key, {
      expires: Date.now() + ttlMs,
      value,
      leagueId: meta?.leagueId,
      season: meta?.season,
    } satisfies CacheBox<T>);
  } catch {
    // ignore
  }
}

/**
 * يحذف كاش المواسم خارج نافذة (حالي+سابق) لنفس الدوري.
 * لا يمس أي مفاتيح أخرى للتطبيق.
 */
export async function purgeSportsCacheOutsideWindow(
  leagueId: number,
  window: SeasonWindow
): Promise<void> {
  try {
    // AsyncStorage لا يدعم list دائماً بنفس الشكل على كل المنصات —
    // نحذف المفاتيح المعروفة لمرشحي المواسم حول النافذة.
    const around = [
      window.current,
      window.previous,
      window.current - 1,
      window.current - 2,
      window.current - 3,
      window.current + 1,
    ].filter((s): s is number => typeof s === 'number' && Number.isFinite(s));

    for (const season of [...new Set(around)]) {
      if (isSeasonInWindow(season, window)) continue;
      await removeJson(PREFIX + `bundle:${leagueId}:${season}`);
      await removeJson(PREFIX + `league:${leagueId}:season:${season}`);
    }
  } catch {
    // ignore
  }
}
