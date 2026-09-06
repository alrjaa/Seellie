/**
 * Video quality event schema (P2) for dashboards / log drains.
 * Keep payloads JSON-serializable and free of PII (no media URLs with tokens).
 */

export type VideoQualityEventName =
  | 'video_startup'
  | 'video_unmute'
  | 'video_rebuffer'
  | 'video_seek'
  | 'video_drift_sample'
  | 'video_gate_result';

export type VideoQualityEvent = {
  name: VideoQualityEventName;
  ts: number;
  platform: 'web' | 'ios' | 'android';
  surface:
    | 'fullscreen-feed'
    | 'inline'
    | 'forums'
    | 'private-lightbox'
    | 'ad-preview'
    | 'other';
  /** Milliseconds — interpretation depends on `name`. */
  value_ms?: number;
  /** Unitless ratios 0..1 */
  value_ratio?: number;
  ok?: boolean;
  meta?: Record<string, string | number | boolean | null>;
};

export function createVideoQualityEvent(
  partial: Omit<VideoQualityEvent, 'ts'> & { ts?: number }
): VideoQualityEvent {
  return {
    ts: partial.ts ?? Date.now(),
    ...partial,
  };
}
