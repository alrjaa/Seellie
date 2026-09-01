/**
 * Central muted-first autoplay policy for web video elements.
 * General + Highlights (FullScreenFeed) and inline players share this logic.
 */

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
  guard?: AutoplayGuard
): Promise<AudibleAutoplayResult> {
  el.volume = 1;
  el.muted = false;
  el.defaultMuted = false;
  try {
    await el.play();
    if (isStale(guard)) return 'aborted';
    if (el.paused) return 'failed';
    return el.muted ? 'playing_muted' : 'playing_audible';
  } catch (error) {
    if (isStale(guard)) return 'aborted';
    const kind = classifyPlayError(error);
    if (kind === 'media') return 'failed';
    const muted = await attemptMutedAutoplay(el, guard);
    if (muted === 'playing') return 'playing_muted';
    if (muted === 'policy_blocked') return 'policy_blocked';
    if (muted === 'aborted') return 'aborted';
    return 'failed';
  }
}

/** After real user activation — unmute without stopping playback when possible. */
export function attemptUnmuteWhilePlaying(el: PlayableVideo): UnmuteResult {
  if (el.paused) return 'not_playing';
  el.volume = 1;
  try {
    el.muted = false;
    el.defaultMuted = false;
    if (el.paused) {
      el.muted = true;
      el.defaultMuted = true;
      void el.play();
      return 'muted_still_playing';
    }
    return 'unmuted';
  } catch {
    el.muted = true;
    el.defaultMuted = true;
    if (!el.paused) return 'muted_still_playing';
    void el.play();
    return 'muted_still_playing';
  }
}
