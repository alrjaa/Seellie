/**
 * تشغيل فيديو الويب عند الظهور، ثم إلحاق الصوت دون إيقاف الصورة.
 *
 * عقد ثابت:
 * 1) الظهور = play صامت دائماً (autoplay مسموح).
 * 2) React لا يضع muted=false على عنصر <video> — ذلك يلغي autoplay في الجوال.
 * 3) الصوت يُضاف على نفس العنصر بعد أن يكون يعمل. إن أوقف إلغاء الكتم التشغيل، نعيد الكتم فوراً.
 * 4) أول تفاعل مع الصفحة يفتح الصوت للجلسة دون إعادة إنشاء المشغّل.
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

export function shouldResumeVideoOnGesture(opts: {
  userPaused: boolean;
}): boolean {
  return !opts.userPaused;
}

export type PlayableVideo = {
  muted: boolean;
  defaultMuted: boolean;
  volume: number;
  paused?: boolean;
  play: () => Promise<void> | void;
};

/** التشغيل عند الظهور: صامت فقط. لا تُمرَّر preferSound هنا. */
export async function startVisibleWebVideo(
  el: PlayableVideo
): Promise<'playing'> {
  el.volume = 1;
  el.muted = true;
  el.defaultMuted = true;
  await el.play();
  return 'playing';
}

/**
 * إلغاء الكتم لعنصر يعمل الآن. إن توقف الفيديو نرجع للكتم ونشغّل صامتاً.
 * لا تستدعِ play() غير صامت كخطوة أولى.
 */
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

function applyUnlockFromUserGesture() {
  notifyUnlocked();
  const current = active;
  if (!current || current.userPaused()) return;
  const { el } = current;
  el.volume = 1;
  if (!el.paused) {
    attachSoundToPlayingVideo(el);
    return;
  }
  el.muted = false;
  el.defaultMuted = false;
  const run = el.play();
  if (run && typeof run.catch === 'function') {
    void run.catch(() => {
      el.muted = true;
      el.defaultMuted = true;
      void el.play();
    });
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
