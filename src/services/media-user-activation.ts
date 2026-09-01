/**
 * Real user-gesture unlock for web media sound (pointer / touch / key).
 * Does not synthesize clicks — browser policy compliant.
 */
import {
  attachSoundToPlayingVideo,
  getActiveWebVideo,
  markWebMediaSoundUnlocked,
} from '@/services/web-media-sound';

let installed = false;

function onUserActivation() {
  markWebMediaSoundUnlocked();
  const current = getActiveWebVideo();
  if (!current || current.userPaused()) return;
  if (current.el.paused) return;
  attachSoundToPlayingVideo(current.el);
}

/** Swiping the feed counts as user engagement for web sound (TikTok-style). */
export function noteWebFeedScrollGesture(): void {
  onUserActivation();
}

/** Install once at app root — returns teardown. */
export function installMediaUserActivation(): () => void {
  if (typeof window === 'undefined' || installed) {
    return () => undefined;
  }
  installed = true;
  window.addEventListener('pointerdown', onUserActivation, true);
  window.addEventListener('touchstart', onUserActivation, {
    capture: true,
    passive: true,
  });
  window.addEventListener('keydown', onUserActivation, true);
  return () => {
    window.removeEventListener('pointerdown', onUserActivation, true);
    window.removeEventListener('touchstart', onUserActivation, true);
    window.removeEventListener('keydown', onUserActivation, true);
    installed = false;
  };
}
