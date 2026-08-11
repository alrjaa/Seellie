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
 * جلب حزمة الدوري العام (سعودي افتراضياً) بأمان.
 * عند الفشل: unavailable=true و bundle=null — لا يرمي ولا يوقف الشاشة.
 */
export function useNationalLeague(opts?: {
  leagueId?: number;
  season?: number;
  enabled?: boolean;
}) {
  const enabled = opts?.enabled !== false;
  const leagueId = opts?.leagueId ?? SAUDI_PRO_LEAGUE_ID;
  const season = opts?.season;
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
        season,
      });
      setState({
        loading: false,
        bundle,
        unavailable: !bundle,
      });
    } catch {
      setState({ loading: false, bundle: null, unavailable: true });
    }
  }, [enabled, leagueId, season]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}
