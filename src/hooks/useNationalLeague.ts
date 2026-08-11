import { useCallback, useEffect, useState } from 'react';
import {
  getSportsDataProvider,
  SAUDI_PRO_LEAGUE_ID,
  type SportsLeagueBundle,
} from '@/services/sports-data';

type State = {
  loading: boolean;
  bundle: SportsLeagueBundle | null;
  unavailable: boolean;
};

/**
 * جلب حزمة الدوري (سعودي افتراضياً) من المخزن التشغيلي لآخر موسمين.
 * forceSync في كل فتح لضمان بيانات حديثة من Edge Function.
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

  const refresh = useCallback(async () => {
    if (!enabled) {
      setState({ loading: false, bundle: null, unavailable: false });
      return;
    }
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const bundle = await getSportsDataProvider().getNationalLeagueBundle({
        leagueId,
        forceSync: false,
      });
      const empty =
        !bundle ||
        (!bundle.standings?.length && !bundle.lastFixtures?.length);
      setState({
        loading: false,
        bundle: empty ? null : bundle,
        unavailable: empty,
      });
    } catch {
      setState({ loading: false, bundle: null, unavailable: true });
    }
  }, [enabled, leagueId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}
