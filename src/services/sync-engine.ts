/**
 * FIX-02 — AppState-aware fallback polling (React Native).
 */
import { AppState, type AppStateStatus } from 'react-native';

export {
  createGenerationGate,
  createInFlightLock,
  SYNC_FALLBACK_MS,
} from '@/services/sync-engine-core';

/**
 * Fallback poll that only runs while the app is in the foreground.
 * Realtime should remain the primary path; this is a safety net only.
 */
export function startForegroundInterval(
  intervalMs: number,
  tick: () => void,
  options?: { runImmediately?: boolean }
): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;

  const clear = () => {
    if (timer != null) {
      clearInterval(timer);
      timer = null;
    }
  };

  const start = () => {
    if (timer != null) return;
    if (options?.runImmediately) {
      try {
        tick();
      } catch {
        /* tick errors must not break the interval */
      }
    }
    timer = setInterval(() => {
      try {
        tick();
      } catch {
        /* ignore */
      }
    }, intervalMs);
  };

  const onChange = (state: AppStateStatus) => {
    if (state === 'active') start();
    else clear();
  };

  if (AppState.currentState === 'active') start();
  const sub = AppState.addEventListener('change', onChange);

  return () => {
    clear();
    sub.remove();
  };
}
