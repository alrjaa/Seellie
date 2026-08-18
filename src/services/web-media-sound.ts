/**
 * فيديو الويب في الفيد:
 * الظهور = تشغيل صامت (autoplay).
 * الصوت = إلغاء كتم عنصر يعمل أصلاً — بدون play() غير صامت وبدون إعادة إنشاء العنصر.
 */

export type WebSoundSessionEvent = 'unlock' | 'item_change' | 'lock';

export function nextWebSoundSession(
  unlocked: boolean,
  event: WebSoundSessionEvent
): boolean {
  if (event === 'unlock') return true;
  if (event === 'lock') return false;
  return unlocked;
}

export type PlayableVideo = {
  muted: boolean;
  defaultMuted: boolean;
  volume: number;
  paused?: boolean;
  play: () => Promise<void> | void;
};

export async function startVisibleWebVideo(
  el: PlayableVideo
): Promise<'playing'> {
  el.volume = 1;
  el.muted = true;
  el.defaultMuted = true;
  await el.play();
  return 'playing';
}

export function attachSoundToPlayingVideo(
  el: PlayableVideo
): 'unmuted' | 'muted' {
  if (el.paused) return 'muted';
  el.volume = 1;
  el.muted = false;
  el.defaultMuted = false;
  if (el.paused) {
    el.muted = true;
    el.defaultMuted = true;
    void el.play();
    return 'muted';
  }
  return 'unmuted';
}

type ActiveWebVideo = {
  el: HTMLVideoElement;
  userPaused: () => boolean;
};

const listeners = new Set<() => void>();
let unlocked = false;
let active: ActiveWebVideo | null = null;
let installed = false;

export function isWebMediaSoundUnlocked(): boolean {
  return unlocked;
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

/** إيماءة الصفحة: صوت فقط إن كان الفيديو يعمل. لا تبدأ التشغيل من هنا. */
function applyUnlockFromUserGesture() {
  notifyUnlocked();
  const current = active;
  if (!current || current.userPaused()) return;
  if (current.el.paused) return;
  attachSoundToPlayingVideo(current.el);
}

export function markWebMediaSoundUnlocked(): void {
  notifyUnlocked();
}

export function resetWebMediaSoundForTests(): void {
  unlocked = false;
  active = null;
  listeners.clear();
}

export function installWebMediaSoundUnlock(): () => void {
  if (typeof window === 'undefined' || installed) {
    return () => undefined;
  }
  installed = true;
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
    installed = false;
  };
}
