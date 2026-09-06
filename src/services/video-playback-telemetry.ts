/**
 * Lightweight in-memory video playback telemetry (P1).
 * No network I/O — safe for web/native unit tests and optional debug export.
 */

export type VideoMetricName =
  | 'startup_skew_ms'
  | 'unmute_latency_ms'
  | 'rebuffer_count'
  | 'rebuffer_ms'
  | 'seek_resync_ms'
  | 'muted_fallback'
  | 'late_unmute_blocked';

export type VideoMetricSample = {
  name: VideoMetricName;
  value: number;
  surface: string;
  at: number;
};

const MAX_SAMPLES = 200;
const samples: VideoMetricSample[] = [];

export function recordVideoMetric(
  name: VideoMetricName,
  value: number,
  surface = 'unknown'
): void {
  samples.push({
    name,
    value,
    surface,
    at: Date.now(),
  });
  if (samples.length > MAX_SAMPLES) {
    samples.splice(0, samples.length - MAX_SAMPLES);
  }
}

export function getVideoMetricSamples(): readonly VideoMetricSample[] {
  return samples;
}

export function clearVideoMetrics(): void {
  samples.length = 0;
}

export function summarizeVideoMetrics(name: VideoMetricName): {
  count: number;
  median: number | null;
  p95: number | null;
  last: number | null;
} {
  const values = samples
    .filter((s) => s.name === name)
    .map((s) => s.value)
    .sort((a, b) => a - b);
  if (!values.length) {
    return { count: 0, median: null, p95: null, last: null };
  }
  const mid = Math.floor(values.length / 2);
  const median =
    values.length % 2 === 0
      ? (values[mid - 1] + values[mid]) / 2
      : values[mid];
  const p95 = values[Math.min(values.length - 1, Math.floor(values.length * 0.95))];
  return {
    count: values.length,
    median,
    p95,
    last: values[values.length - 1],
  };
}

/** Session timers keyed by element identity (web). */
const mutedFallbackStartedAt = new WeakMap<object, number>();
const playStartedAt = new WeakMap<object, number>();
const waitingStartedAt = new WeakMap<object, number>();

export function markPlayStarted(el: object): void {
  playStartedAt.set(el, performanceNow());
}

export function markMutedFallback(el: object, surface = 'web'): void {
  mutedFallbackStartedAt.set(el, performanceNow());
  recordVideoMetric('muted_fallback', 1, surface);
}

export function markPlayingAfterStart(el: object, surface = 'web'): void {
  const start = playStartedAt.get(el);
  if (start == null) return;
  const skew = Math.max(0, performanceNow() - start);
  recordVideoMetric('startup_skew_ms', skew, surface);
}

export function markUnmuteLatency(el: object, surface = 'web'): void {
  const mutedAt = mutedFallbackStartedAt.get(el);
  const start = mutedAt ?? playStartedAt.get(el);
  if (start == null) return;
  const ms = Math.max(0, performanceNow() - start);
  recordVideoMetric('unmute_latency_ms', ms, surface);
  mutedFallbackStartedAt.delete(el);
}

export function getMutedFallbackAgeMs(el: object): number | null {
  const at = mutedFallbackStartedAt.get(el);
  if (at == null) return null;
  return Math.max(0, performanceNow() - at);
}

/** Test-only: backdate muted-fallback marker for late-unmute guard coverage. */
export function __testBackdateMutedFallback(el: object, ageMs: number): void {
  mutedFallbackStartedAt.set(el, performanceNow() - Math.max(0, ageMs));
}

export function markWaiting(el: object): void {
  waitingStartedAt.set(el, performanceNow());
}

export function markPlayingAfterWait(el: object, surface = 'web'): void {
  const at = waitingStartedAt.get(el);
  if (at == null) return;
  const ms = Math.max(0, performanceNow() - at);
  waitingStartedAt.delete(el);
  recordVideoMetric('rebuffer_ms', ms, surface);
  recordVideoMetric('rebuffer_count', 1, surface);
}

function performanceNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}
