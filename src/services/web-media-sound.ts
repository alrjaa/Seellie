/**
 * Web feed video sound session — delegates autoplay policy to media-autoplay-engine.
 */
import {
  attemptAudibleAutoplay,
  attemptUnmuteWhilePlaying,
  type PlayableVideo,
} from '@/services/media-autoplay-engine';

export type { PlayableVideo } from '@/services/media-autoplay-engine';

export type WebSoundSessionEvent = 'unlock' | 'item_change' | 'lock';

export function nextWebSoundSession(
  unlocked: boolean,
  event: WebSoundSessionEvent
): boolean {
  if (event === 'unlock') return true;
  if (event === 'lock') return false;
  return unlocked;
}

export async function startVisibleWebVideo(
  el: PlayableVideo
): Promise<'playing' | 'policy_blocked' | 'aborted' | 'failed'> {
  const result = await attemptAudibleAutoplay(el);
  if (result === 'playing_audible' || result === 'playing_muted') return 'playing';
  return result;
}

/** After playback starts — promote to audible when allowed. */
export function promoteWebVideoSound(el: PlayableVideo): 'unmuted' | 'muted' {
  return attachSoundToPlayingVideo(el);
}

export function attachSoundToPlayingVideo(
  el: PlayableVideo,
  options?: { inGesture?: boolean }
): 'unmuted' | 'muted' {
  const result = attemptUnmuteWhilePlaying(el, options);
  if (result === 'unmuted') return 'unmuted';
  return 'muted';
}

/** Runs inside pointer/touch/scroll gesture — play + unmute active feed video. */
export function applyWebMediaSoundFromGesture(): void {
  markWebMediaSoundUnlocked();
  const current = getActiveWebVideo();
  if (!current || current.userPaused()) return;
  const el = current.el;
  if (el.paused) {
    el.volume = 1;
    el.muted = false;
    el.defaultMuted = false;
    try {
      const result = el.play();
      if (result && typeof (result as Promise<void>).then === 'function') {
        void (result as Promise<void>).catch(() => undefined);
      }
    } catch {
      /* fall through to attach */
    }
    if (!el.paused) {
      attachSoundToPlayingVideo(el, { inGesture: true });
    }
    return;
  }
  attachSoundToPlayingVideo(el, { inGesture: true });
}

type ActiveWebVideo = {
  el: HTMLVideoElement;
  userPaused: () => boolean;
};

const listeners = new Set<() => void>();
let unlocked = false;
let active: ActiveWebVideo | null = null;

export function isWebMediaSoundUnlocked(): boolean {
  return unlocked;
}

export function getActiveWebVideo(): ActiveWebVideo | null {
  return active;
}

export function subscribeWebMediaSound(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function registerActiveWebVideo(
  el: HTMLVideoElement | null,
  userPaused: () => boolean = () => false
): void {
  if (!el) {
    active = null;
    return;
  }
  active = { el, userPaused };
}

export function unregisterActiveWebVideo(el?: HTMLVideoElement | null): void {
  if (!el || active?.el === el) {
    active = null;
  }
}

function notifyUnlocked() {
  unlocked = true;
  for (const listener of listeners) listener();
}

function applyUnlockFromUserGesture() {
  applyWebMediaSoundFromGesture();
}

export function markWebMediaSoundUnlocked(): void {
  notifyUnlocked();
}

export function resetWebMediaSoundForTests(): void {
  unlocked = false;
  active = null;
  listeners.clear();
}

/** @deprecated Prefer installMediaUserActivation from media-user-activation.ts */
export function installWebMediaSoundUnlock(): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  const onGesture = () => {
    applyUnlockFromUserGesture();
  };
  window.addEventListener('pointerdown', onGesture, true);
  window.addEventListener('touchstart', onGesture, {
    capture: true,
    passive: true,
  });
  window.addEventListener('keydown', onGesture, true);
  return () => {
    window.removeEventListener('pointerdown', onGesture, true);
    window.removeEventListener('touchstart', onGesture, true);
    window.removeEventListener('keydown', onGesture, true);
  };
}
