import { useCallback, useEffect, useState } from 'react';
import {
  getSportsDataProvider,
  SAUDI_PRO_LEAGUE_ID,
  type SportsLeagueBundle,
} from '@/services/sports-data';
import { expectedSeasonBase } from '@/services/sports-data/season-window';
import { readSportsCache } from '@/services/sports-data/cache';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase';

type State = {
  loading: boolean;
  bundle: SportsLeagueBundle | null;
  unavailable: boolean;
};

function bundleHasRows(bundle: SportsLeagueBundle | null | undefined): boolean {
  if (!bundle) return false;
  return !!(
    bundle.standings?.length ||
    bundle.lastFixtures?.length ||
    bundle.nextFixtures?.length ||
    bundle.liveFixtures?.length
  );
}

/**
 * قديمة إذا:
 * - لا بيانات، أو
 * - نافذة المواسم خلف التقويم الرياضي المتوقع (مع تهدئة 30د)، أو
 * - عمر تحديث المخزن > دقيقتين
 */
function needsSessionSync(
  bundle: SportsLeagueBundle | null | undefined
): boolean {
  if (!bundleHasRows(bundle)) return true;
  const current = bundle?.window?.current ?? bundle?.season;
  const expected = expectedSeasonBase();
  const at = bundle?.fetchedAt ? Date.parse(bundle.fetchedAt) : NaN;
  const age = Number.isFinite(at) ? Date.now() - at : Number.POSITIVE_INFINITY;
  if (typeof current === 'number' && current < expected) {
    return age > 30 * 60 * 1000;
  }
  return age > 2 * 60 * 1000;
}

/**
 * جلب حزمة الدوري (سعودي افتراضياً):
 * 1) عرض فوري من الكاش المحلي إن وُجد
 * 2) إن كان الكاش طازجًا (<2د) تُتخطى شبكة Edge — P1-03
 * 3) وإلا إعادة تحقق من مخزن Edge (بدون upstream للمجهول — F09-P1-01)
 * 4) إن وُجدت جلسة والنافذة قديمة/خلف التقويم → مزامنة مصادق عليها ثم تحديث الواجهة
 */
export function useNationalLeague(opts?: {
  leagueId?: number;
  enabled?: boolean;
}) {
  const enabled = opts?.enabled !== false;
  const leagueId = opts?.leagueId ?? SAUDI_PRO_LEAGUE_ID;
  const [state, setState] = useState<State>({
    loading: enabled,
    bundle: null,
    unavailable: false,
  });

  const applyBundle = useCallback((bundle: SportsLeagueBundle | null) => {
    const empty = !bundleHasRows(bundle);
    setState({
      loading: false,
      bundle: empty ? null : bundle,
      unavailable: empty,
    });
  }, []);

  const refresh = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!enabled) {
        setState({ loading: false, bundle: null, unavailable: false });
        return;
      }

      const force = !!opts?.force;
      const cacheKey = `bundle:${leagueId}:active`;
      const cached = await readSportsCache<SportsLeagueBundle>(cacheKey);
      if (bundleHasRows(cached)) {
        applyBundle(cached);
        // P1-03: skip Edge round-trip while local cache is still fresh
        if (!force && !needsSessionSync(cached)) {
          return;
        }
      } else {
        setState((prev) => ({ ...prev, loading: true }));
      }

      try {
        const provider = getSportsDataProvider();
        const bundle = await provider.getNationalLeagueBundle({
          leagueId,
          forceSync: false,
        });
        applyBundle(bundle);

        if (!isSupabaseConfigured()) return;
        const sb = getSupabase();
        if (!sb) return;
        const { data: sessionData } = await sb.auth.getSession();
        if (!sessionData.session?.access_token) return;
        if (!needsSessionSync(bundle)) return;
        if (!provider.syncLeague) return;

        const synced = await provider.syncLeague(leagueId);
        if (bundleHasRows(synced)) {
          applyBundle(synced);
        }
      } catch {
        setState((prev) => ({
          loading: false,
          bundle: prev.bundle,
          unavailable: !bundleHasRows(prev.bundle),
        }));
      }
    },
    [applyBundle, enabled, leagueId]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}
