import { useCallback, useEffect, useState } from 'react';
import {
  getSportsDataProvider,
  SAUDI_PRO_LEAGUE_ID,
  type SportsLeagueBundle,
} from '@/services/sports-data';
import { readSportsCache } from '@/services/sports-data/cache';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase';

type State = {
  loading: boolean;
  bundle: SportsLeagueBundle | null;
  unavailable: boolean;
};

const BUNDLE_STALE_MS = 2 * 60 * 1000;

function bundleHasRows(bundle: SportsLeagueBundle | null | undefined): boolean {
  if (!bundle) return false;
  return !!(
    bundle.standings?.length ||
    bundle.lastFixtures?.length ||
    bundle.nextFixtures?.length ||
    bundle.liveFixtures?.length
  );
}

function isBundleStale(bundle: SportsLeagueBundle | null | undefined): boolean {
  if (!bundleHasRows(bundle)) return true;
  const at = bundle?.fetchedAt ? Date.parse(bundle.fetchedAt) : NaN;
  if (!Number.isFinite(at)) return true;
  return Date.now() - at > BUNDLE_STALE_MS;
}

/**
 * جلب حزمة الدوري (سعودي افتراضياً):
 * 1) عرض فوري من الكاش المحلي إن وُجد
 * 2) إعادة تحقق مباشرة من مخزن Edge (بدون upstream للمجهول — F09-P1-01)
 * 3) إن وُجدت جلسة والحزمة فارغة/قديمة → مزامنة مصادق عليها ثم تحديث الواجهة فور توفر البيانات
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

  const refresh = useCallback(async () => {
    if (!enabled) {
      setState({ loading: false, bundle: null, unavailable: false });
      return;
    }

    const cacheKey = `bundle:${leagueId}:active`;
    const cached = await readSportsCache<SportsLeagueBundle>(cacheKey);
    if (bundleHasRows(cached)) {
      // عرض فوري — ثم نحدّث من الشبكة
      applyBundle(cached);
    } else {
      setState((prev) => ({ ...prev, loading: true }));
    }

    try {
      const provider = getSportsDataProvider();
      // قراءة المخزن التشغيلي مباشرة (لا forceSync → لا حرق حصة API للعامة)
      let bundle = await provider.getNationalLeagueBundle({
        leagueId,
        forceSync: false,
      });
      applyBundle(bundle);

      // مزامنة جلسة فقط عند الفراغ/التقادم — نفس بوابات FIX-08 / F09-P1-01
      if (!isSupabaseConfigured()) return;
      const sb = getSupabase();
      if (!sb) return;
      const { data: sessionData } = await sb.auth.getSession();
      if (!sessionData.session?.access_token) return;
      if (!isBundleStale(bundle)) return;
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
  }, [applyBundle, enabled, leagueId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}
