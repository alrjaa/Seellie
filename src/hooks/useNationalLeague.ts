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
 * عند الفشل: unavailable=true — لا يرمي ولا يوقف الشاشة.
 */
export function useNationalLeague(opts?: {
  leagueId?: number;
  enabled?: boolean;
  forceSync?: boolean;
}) {
  const enabled = opts?.enabled !== false;
  const leagueId = opts?.leagueId ?? SAUDI_PRO_LEAGUE_ID;
  const forceSync = !!opts?.forceSync;
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
        forceSync,
      });
      setState({
        loading: false,
        bundle,
        unavailable: !bundle,
      });
    } catch {
      setState({ loading: false, bundle: null, unavailable: true });
    }
  }, [enabled, leagueId, forceSync]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}
