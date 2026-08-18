/**
 * صوت فيديوهات الويب — جلسة واحدة، لا كتم إجباري بعد أول تفاعل.
 *
 * الخلل السابق: التشغيل التلقائي كان يكتم دائماً، ثم يعيد الكتم عند كل فيديو.
 * بعد أول pointerdown/تمريرة نلغي الكتم للفيديو الحالي ونبقي الصوت للفيديوهات التالية.
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

export function shouldAutoplayMuted(unlocked: boolean): boolean {
  return !unlocked;
}

export function shouldResumeVideoOnGesture(opts: {
  userPaused: boolean;
}): boolean {
  return !opts.userPaused;
}

type PlayableVideo = {
  muted: boolean;
  defaultMuted: boolean;
  volume: number;
  play: () => Promise<void> | void;
};

export async function playWebVideoWithSoundPolicy(
  el: PlayableVideo,
  unlocked: boolean
): Promise<'unmuted' | 'muted'> {
  el.volume = 1;
  if (unlocked) {
    el.muted = false;
    el.defaultMuted = false;
    try {
      await el.play();
      return 'unmuted';
    } catch {
      el.muted = true;
      el.defaultMuted = true;
      await el.play();
      return 'muted';
    }
  }
  el.muted = true;
  el.defaultMuted = true;
  await el.play();
  return 'muted';
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
  if (unlocked) {
    el.muted = false;
    el.defaultMuted = false;
    el.volume = 1;
  }
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
  notifyUnlocked();
  const current = active;
  if (!current) return;
  const { el, userPaused } = current;
  el.muted = false;
  el.defaultMuted = false;
  el.volume = 1;
  if (shouldResumeVideoOnGesture({ userPaused: userPaused() })) {
    void el.play();
  }
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
  window.addEventListener('touchstart', onGesture, { capture: true, passive: true });
  window.addEventListener('keydown', onGesture, true);
  return () => {
    window.removeEventListener('pointerdown', onGesture, true);
    window.removeEventListener('touchstart', onGesture, true);
    window.removeEventListener('keydown', onGesture, true);
    installed = false;
  };
}
