/**
 * FIX-02 — Shared sync helpers (no React Native imports).
 * AppState-aware polling lives in sync-engine-native.ts.
 */
/** Prevents overlapping identical work; later callers await the same promise. */
export function createInFlightLock<T = void>() {
  let pending: Promise<T> | null = null;
  return {
    get busy() {
      return pending != null;
    },
    async run(fn: () => Promise<T>): Promise<T> {
      if (pending) return pending;
      pending = (async () => {
        try {
          return await fn();
        } finally {
          pending = null;
        }
      })();
      return pending;
    },
  };
}

/** Monotonic generation so stale async responses cannot overwrite newer state. */
export function createGenerationGate() {
  let gen = 0;
  return {
    next(): number {
      gen += 1;
      return gen;
    },
    isCurrent(token: number): boolean {
      return token === gen;
    },
    get current() {
      return gen;
    },
  };
}

/** Sync policy constants (ms) — documented in FIX-02 baseline/after. */
export const SYNC_FALLBACK_MS = {
  /** Was 15s → 60s → 120s — Realtime is primary. */
  profiles: 120_000,
  /** Was 20s → 60s; screen-focus poll uses this when Forums is open. */
  forums: 90_000,
  /** Messages screen: only when focused. Was 2.5s → 15s → 30s. */
  messagesDegraded: 30_000,
  /** Private space: focus-scoped fallback. Was 5s → 30s → 45s. */
  privateSpace: 45_000,
  /** Share cards focus/fallback if Realtime unavailable. Was 20s → 45s. */
  shareCards: 45_000,
} as const;
