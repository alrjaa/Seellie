/**
 * Video quality gate thresholds + evaluator (P2).
 */
export type GateThresholds = {
  startup_skew_ms_p95: number;
  unmute_latency_ms_median: number;
  drift_ms_after_5min_max: number;
  rebuffer_ratio_max: number;
};

export const DEFAULT_THRESHOLDS: GateThresholds = {
  startup_skew_ms_p95: 150,
  unmute_latency_ms_median: 120,
  drift_ms_after_5min_max: 80,
  rebuffer_ratio_max: 0.15,
};

export type GateFixture = {
  platform: 'web' | 'ios' | 'android' | 'synthetic';
  startup_skew_ms_p95: number;
  unmute_latency_ms_median: number;
  drift_ms_after_5min: number;
  rebuffer_ratio: number;
};

export function evaluateGates(
  fixture: GateFixture,
  thresholds: GateThresholds = DEFAULT_THRESHOLDS
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  if (fixture.startup_skew_ms_p95 > thresholds.startup_skew_ms_p95) {
    failures.push(
      `startup_skew_ms_p95 ${fixture.startup_skew_ms_p95} > ${thresholds.startup_skew_ms_p95}`
    );
  }
  if (fixture.unmute_latency_ms_median > thresholds.unmute_latency_ms_median) {
    failures.push(
      `unmute_latency_ms_median ${fixture.unmute_latency_ms_median} > ${thresholds.unmute_latency_ms_median}`
    );
  }
  if (fixture.drift_ms_after_5min > thresholds.drift_ms_after_5min_max) {
    failures.push(
      `drift_ms_after_5min ${fixture.drift_ms_after_5min} > ${thresholds.drift_ms_after_5min_max}`
    );
  }
  if (fixture.rebuffer_ratio > thresholds.rebuffer_ratio_max) {
    failures.push(
      `rebuffer_ratio ${fixture.rebuffer_ratio} > ${thresholds.rebuffer_ratio_max}`
    );
  }
  return { ok: failures.length === 0, failures };
}
