/**
 * Central autoplay policy for web video elements (audible-first → muted fallback).
 * General + Highlights (FullScreenFeed) and inline players share this logic.
 */

import { VIDEO_PLAYER_DEFAULTS } from '@/services/video-player-defaults';
import {
  getMutedFallbackAgeMs,
  markMutedFallback,
  markPlayStarted,
  markPlayingAfterStart,
  markUnmuteLatency,
  recordVideoMetric,
} from '@/services/video-playback-telemetry';

export type PlayableVideo = {
  muted: boolean;
  defaultMuted: boolean;
  volume: number;
  paused?: boolean;
  play: () => Promise<void> | void;
};

export type PlayErrorKind = 'none' | 'policy' | 'abort' | 'media';

export type MutedAutoplayResult =
  | 'playing'
  | 'policy_blocked'
  | 'aborted'
  | 'failed';

export type AudibleAutoplayResult =
  | 'playing_audible'
  | 'playing_muted'
  | 'policy_blocked'
  | 'aborted'
  | 'failed';

export type UnmuteResult = 'unmuted' | 'muted_still_playing' | 'not_playing';

export function classifyPlayError(error: unknown): PlayErrorKind {
  if (!error || typeof error !== 'object') return 'media';
  const name = 'name' in error ? String((error as { name?: string }).name) : '';
  const message =
    'message' in error ? String((error as { message?: string }).message) : '';
  const code =
    'code' in error ? Number((error as { code?: number }).code) : NaN;
  if (
    name === 'NotAllowedError' ||
    /not allowed|autoplay|user didn't interact/i.test(message)
  ) {
    return 'policy';
  }
  if (
    name === 'AbortError' ||
    code === 20 ||
    /aborted|interrupted|new load request/i.test(message)
  ) {
    return 'abort';
  }
  return 'media';
}

export function isRealMediaFailure(error: unknown): boolean {
  const kind = classifyPlayError(error);
  return kind === 'media';
}

type AutoplayGuard = {
  generation: number;
  getGeneration: () => number;
};

function isStale(guard: AutoplayGuard | undefined): boolean {
  if (!guard) return false;
  return guard.getGeneration() !== guard.generation;
}

/** Muted-first autoplay — never throws; classify policy/abort vs real media failure. */
export async function attemptMutedAutoplay(
  el: PlayableVideo,
  guard?: AutoplayGuard
): Promise<MutedAutoplayResult> {
  el.volume = 1;
  el.muted = true;
  el.defaultMuted = true;
  try {
    await el.play();
    if (isStale(guard)) return 'aborted';
    return 'playing';
  } catch (error) {
    if (isStale(guard)) return 'aborted';
    const kind = classifyPlayError(error);
    if (kind === 'policy') return 'policy_blocked';
    if (kind === 'abort') return 'aborted';
    return 'failed';
  }
}

/**
 * TikTok-style: try unmuted autoplay first; fall back to muted so video keeps moving.
 * Never treats policy block as media failure.
 */
export async function attemptAudibleAutoplay(
  el: PlayableVideo,
  guard?: AutoplayGuard,
  surface = 'web'
): Promise<AudibleAutoplayResult> {
  markPlayStarted(el as object);
  el.volume = VIDEO_PLAYER_DEFAULTS.volume;
  el.muted = false;
  el.defaultMuted = false;
  try {
    await el.play();
    if (isStale(guard)) return 'aborted';
    if (el.paused) return 'failed';
    markPlayingAfterStart(el as object, surface);
    if (el.muted) {
      markMutedFallback(el as object, surface);
      return 'playing_muted';
    }
    return 'playing_audible';
  } catch (error) {
    if (isStale(guard)) return 'aborted';
    const kind = classifyPlayError(error);
    if (kind === 'media') return 'failed';
    const muted = await attemptMutedAutoplay(el, guard);
    if (muted === 'playing') {
      markMutedFallback(el as object, surface);
      markPlayingAfterStart(el as object, surface);
      return 'playing_muted';
    }
    if (muted === 'policy_blocked') return 'policy_blocked';
    if (muted === 'aborted') return 'aborted';
    return 'failed';
  }
}

export type UnmuteOptions = { inGesture?: boolean };

function invokePlay(el: PlayableVideo): void {
  try {
    const result = el.play();
    if (result && typeof (result as Promise<void>).then === 'function') {
      void (result as Promise<void>).catch(() => undefined);
    }
  } catch {
    /* policy may reject outside gesture */
  }
}

/** After real user activation — unmute without stopping playback when possible. */
export function attemptUnmuteWhilePlaying(
  el: PlayableVideo,
  options?: UnmuteOptions,
  surface = 'web'
): UnmuteResult {
  const inGesture = options?.inGesture === true;

  // P1: block surprising late auto-unmute after long muted playback without a gesture.
  if (!inGesture) {
    const age = getMutedFallbackAgeMs(el as object);
    if (
      age != null &&
      age >= VIDEO_PLAYER_DEFAULTS.lateUnmuteGuardMs &&
      !el.paused
    ) {
      recordVideoMetric('late_unmute_blocked', age, surface);
      return 'muted_still_playing';
    }
  }

  if (el.paused) {
    if (!inGesture) return 'not_playing';
    el.volume = VIDEO_PLAYER_DEFAULTS.volume;
    el.muted = false;
    el.defaultMuted = false;
    invokePlay(el);
    if (el.paused) return 'not_playing';
    if (!el.muted) markUnmuteLatency(el as object, surface);
    return el.muted ? 'muted_still_playing' : 'unmuted';
  }

  el.volume = VIDEO_PLAYER_DEFAULTS.volume;
  try {
    el.muted = false;
    el.defaultMuted = false;
    if (el.paused) {
      if (inGesture) {
        invokePlay(el);
        if (!el.paused && !el.muted) {
          markUnmuteLatency(el as object, surface);
          return 'unmuted';
        }
        if (!el.paused) return 'muted_still_playing';
      }
      el.muted = true;
      el.defaultMuted = true;
      invokePlay(el);
      return 'muted_still_playing';
    }
    markUnmuteLatency(el as object, surface);
    return 'unmuted';
  } catch {
    el.muted = true;
    el.defaultMuted = true;
    if (!el.paused) return 'muted_still_playing';
    invokePlay(el);
    return 'muted_still_playing';
  }
}
