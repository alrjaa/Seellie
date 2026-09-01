/**
 * Pure native feed autoplay policy — no React Native / expo (unit-testable in Node).
 */

/** Start inline autoplay when >= 50% visible. */
export const INLINE_VISIBILITY_PLAY_RATIO = 0.5;
/** Stop inline autoplay when <= 20% visible (hysteresis). */
export const INLINE_VISIBILITY_STOP_RATIO = 0.2;

export function isNativePlaybackMediaFailure(error: unknown): boolean {
  if (!error) return false;
  const msg = String(
    (error as { message?: string })?.message || error
  ).toLowerCase();
  if (!msg) return true;
  if (/abort|cancel|interrupted|interruption/.test(msg)) return false;
  if (/not allowed|notallowederror|autoplay|permission denied/.test(msg)) return false;
  return true;
}

export function shouldMarkNativePlaybackFailed(
  error: unknown
): boolean {
  return isNativePlaybackMediaFailure(error);
}

export type NativePlaybackStatus = {
  isLoaded: boolean;
  error?: string;
};

export function isNativePlaybackStatusMediaFailure(
  status: NativePlaybackStatus
): boolean {
  if (!status.isLoaded) return false;
  if (status.error) return true;
  return false;
}

export function shouldAttemptNativeFeedAutoplay(input: {
  active: boolean;
  playable: boolean;
  ready: boolean;
  userPaused: boolean;
  loadError: boolean;
}): boolean {
  return (
    input.active &&
    input.playable &&
    input.ready &&
    !input.userPaused &&
    !input.loadError
  );
}

/** Active before ready — retain intent; execute when markReady fires. */
export function hasPendingNativeAutoplayRequest(input: {
  active: boolean;
  playable: boolean;
  ready: boolean;
  userPaused: boolean;
  loadError: boolean;
}): boolean {
  return (
    input.active &&
    input.playable &&
    !input.ready &&
    !input.userPaused &&
    !input.loadError
  );
}

/**
 * Hysteresis for inline visibility: play at >=50%, stop at <=20%.
 */
export function nextInlineVisibilityAutoplay(
  currentlyVisible: boolean,
  visibleRatio: number,
  playRatio: number = INLINE_VISIBILITY_PLAY_RATIO,
  stopRatio: number = INLINE_VISIBILITY_STOP_RATIO
): boolean {
  const ratio = Math.max(0, Math.min(1, visibleRatio));
  if (currentlyVisible) {
    return ratio > stopRatio;
  }
  return ratio >= playRatio;
}

export function computeVisibleHeightRatio(
  elementY: number,
  elementHeight: number,
  windowHeight: number
): number {
  if (elementHeight <= 0 || windowHeight <= 0) return 0;
  const top = Math.max(0, elementY);
  const bottom = Math.min(windowHeight, elementY + elementHeight);
  const visibleHeight = Math.max(0, bottom - top);
  return visibleHeight / elementHeight;
}

export function isStalePlayGeneration(
  requestGeneration: number,
  currentGeneration: number
): boolean {
  return requestGeneration !== currentGeneration;
}

export function shouldPauseOnDeactivate(active: boolean): boolean {
  return !active;
}
