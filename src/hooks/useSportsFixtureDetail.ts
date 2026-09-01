import { useCallback, useEffect, useState } from 'react';
import {
  getSportsDataProvider,
  type SportsFixtureDetail,
} from '@/services/sports-data';

export function useSportsFixtureDetail(fixtureId?: string) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<SportsFixtureDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const id = String(fixtureId || '').trim();
    if (!id) {
      setDetail(null);
      setError('missing_id');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const provider = getSportsDataProvider();
      const data = provider.getFixtureDetail
        ? await provider.getFixtureDetail(id)
        : null;
      if (!data) {
        setDetail(null);
        setError('not_found');
        return;
      }
      setDetail(data);
    } catch {
      setDetail(null);
      setError('load_failed');
    } finally {
      setLoading(false);
    }
  }, [fixtureId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { loading, detail, error, reload };
}
