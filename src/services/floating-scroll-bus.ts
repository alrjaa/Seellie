/**
 * حالة شفافية الواجهة العائمة أثناء التمرير.
 *
 * visibility 0→1 يتبع حركة التمرير مباشرة (لا انتظار طويل).
 * idle ⇄ scrolling للتوافق مع المستمعين القديمين.
 */

export type FloatingScrollPhase = 'idle' | 'scrolling';
export type FloatingScrollDirection = 'up' | 'down';

type VisibilityListener = (visible: boolean) => void;
type PhaseListener = (phase: FloatingScrollPhase) => void;
type DirectionListener = (direction: FloatingScrollDirection) => void;
type ProgressListener = (visibility: number) => void;

const listeners = new Set<VisibilityListener>();
const phaseListeners = new Set<PhaseListener>();
const directionListeners = new Set<DirectionListener>();
const progressListeners = new Set<ProgressListener>();

/** مدى التمرير لإخفاء كامل */
export const FLOATING_HIDE_RANGE_PX = 52;
export const FLOATING_SCROLL_DIM_OPACITY = 0.22;
export const FLOATING_SCROLL_PEEK_OPACITY = 1;
export const FLOATING_SCROLL_SLIDE_PX = 22;
export const FLOATING_FADE_OUT_MS = 90;
export const FLOATING_FADE_IN_MS = 180;
export const FLOATING_RESTORE_DELAY_MS = 72;
export const FLOATING_WHEEL_SETTLE_MS = 140;
export const FLOATING_DRAG_SETTLE_MS = 36;

const MOVE_EPS = 2;
const MAX_SCROLLING_MS = 2800;
const VISIBILITY_EPS = 0.004;

let phase: FloatingScrollPhase = 'idle';
let scrollDirection: FloatingScrollDirection = 'down';
let visibility = 1;
let suppressFloating = false;
let ownerId: string | null = null;
let lastY: number | null = null;
let restoreTimer: ReturnType<typeof setTimeout> | null = null;
let dragSettleTimer: ReturnType<typeof setTimeout> | null = null;
let scrollingFailsafeTimer: ReturnType<typeof setTimeout> | null = null;
let restoreRaf: number | null = null;

function phaseToVisible(p: FloatingScrollPhase): boolean {
  return p !== 'scrolling';
}

function clampVisibility(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function setScrollDirection(next: FloatingScrollDirection) {
  if (scrollDirection === next) return;
  scrollDirection = next;
  directionListeners.forEach((listener) => {
    try {
      listener(scrollDirection);
    } catch {
      // ignore
    }
  });
}

function updateScrollDirection(prevY: number, nextY: number) {
  if (nextY > prevY + MOVE_EPS) setScrollDirection('down');
  else if (nextY < prevY - MOVE_EPS) setScrollDirection('up');
}

function notifyPhase() {
  phaseListeners.forEach((listener) => {
    try {
      listener(phase);
    } catch {
      // ignore
    }
  });
  const visible = phaseToVisible(phase);
  listeners.forEach((listener) => {
    try {
      listener(visible);
    } catch {
      // ignore
    }
  });
}

function setVisibility(next: number) {
  const clamped = clampVisibility(next);
  if (Math.abs(clamped - visibility) < VISIBILITY_EPS) return;
  visibility = clamped;
  progressListeners.forEach((listener) => {
    try {
      listener(visibility);
    } catch {
      // ignore
    }
  });
  const nextPhase: FloatingScrollPhase =
    visibility >= 0.98 ? 'idle' : 'scrolling';
  if (phase !== nextPhase) {
    phase = nextPhase;
    notifyPhase();
  }
}

function clearRestoreTimer() {
  if (restoreTimer) {
    clearTimeout(restoreTimer);
    restoreTimer = null;
  }
}

function clearDragSettleTimer() {
  if (dragSettleTimer) {
    clearTimeout(dragSettleTimer);
    dragSettleTimer = null;
  }
}

function clearScrollingFailsafe() {
  if (scrollingFailsafeTimer) {
    clearTimeout(scrollingFailsafeTimer);
    scrollingFailsafeTimer = null;
  }
}

function clearRestoreRaf() {
  if (restoreRaf != null && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(restoreRaf);
  }
  restoreRaf = null;
}

function clearAllTimers() {
  clearRestoreTimer();
  clearDragSettleTimer();
  clearScrollingFailsafe();
  clearRestoreRaf();
}

function setPhase(next: FloatingScrollPhase) {
  if (phase === next) return;
  phase = next;
  notifyPhase();
}

function enterIdle() {
  lastY = null;
  clearAllTimers();
  setVisibility(1);
  setPhase('idle');
}

function enterScrolling() {
  clearRestoreTimer();
  clearDragSettleTimer();
  clearRestoreRaf();
  if (phase !== 'scrolling') {
    setPhase('scrolling');
  }
  clearScrollingFailsafe();
  scrollingFailsafeTimer = setTimeout(() => {
    scrollingFailsafeTimer = null;
    if (phase === 'scrolling') {
      scheduleRestore();
    }
  }, MAX_SCROLLING_MS);
}

function animateVisibilityRestore() {
  clearRestoreRaf();
  const start = visibility;
  if (start >= 0.995) {
    enterIdle();
    return;
  }
  const startAt =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  const duration = FLOATING_FADE_IN_MS;

  const tick = (now: number) => {
    const t = Math.min(1, (now - startAt) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    setVisibility(start + (1 - start) * eased);
    if (t < 1) {
      restoreRaf = requestAnimationFrame(tick);
      return;
    }
    restoreRaf = null;
    enterIdle();
  };

  if (typeof requestAnimationFrame === 'function') {
    restoreRaf = requestAnimationFrame(tick);
    return;
  }
  enterIdle();
}

function scheduleRestore() {
  clearRestoreTimer();
  clearDragSettleTimer();
  clearScrollingFailsafe();
  lastY = null;
  restoreTimer = setTimeout(() => {
    restoreTimer = null;
    animateVisibilityRestore();
  }, FLOATING_RESTORE_DELAY_MS);
}

function internalSettle() {
  if (visibility >= 0.995 && phase === 'idle') return;
  scheduleRestore();
}

function applyScrollDelta(dy: number) {
  if (dy > 0) {
    setScrollDirection('down');
    setVisibility(visibility - dy / FLOATING_HIDE_RANGE_PX);
  } else if (dy < 0) {
    setScrollDirection('up');
    setVisibility(visibility - dy / (FLOATING_HIDE_RANGE_PX * 0.62));
  }
}

export function getFloatingVisibilityProgress(): number {
  return visibility;
}

export function subscribeFloatingVisibilityProgress(listener: ProgressListener) {
  progressListeners.add(listener);
  listener(visibility);
  return () => {
    progressListeners.delete(listener);
  };
}

export function setFloatingSuppressed(suppressed: boolean) {
  suppressFloating = suppressed;
  lastY = null;
  clearAllTimers();
  if (!suppressed) {
    enterIdle();
  } else {
    notifyPhase();
  }
}

export function isFloatingSuppressed() {
  return suppressFloating;
}

export function getFloatingScrollPhase(): FloatingScrollPhase {
  return phase;
}

export function getFloatingScrollDirection(): FloatingScrollDirection {
  return scrollDirection;
}

export function subscribeFloatingScrollDirection(listener: DirectionListener) {
  directionListeners.add(listener);
  listener(scrollDirection);
  return () => {
    directionListeners.delete(listener);
  };
}

export function subscribeFloatingScrollPhase(listener: PhaseListener) {
  phaseListeners.add(listener);
  listener(phase);
  return () => {
    phaseListeners.delete(listener);
  };
}

export function subscribeFloatingVisibility(listener: VisibilityListener) {
  listeners.add(listener);
  listener(phaseToVisible(phase));
  return () => {
    listeners.delete(listener);
  };
}

export function claimFloatingScrollSource(sourceId: string) {
  ownerId = sourceId;
  enterIdle();
}

export function releaseFloatingScrollSource(sourceId: string) {
  if (ownerId !== sourceId) return;
  ownerId = null;
  enterIdle();
}

export function noteFloatingScrollBegin(sourceId: string) {
  if (suppressFloating) return;
  if (ownerId == null) ownerId = sourceId;
  clearRestoreTimer();
  clearDragSettleTimer();
  clearRestoreRaf();
}

export function noteFloatingScrollOffset(sourceId: string, y: number) {
  if (suppressFloating) return;
  if (ownerId != null && ownerId !== sourceId) return;
  if (ownerId == null) ownerId = sourceId;

  const offset = Math.max(0, y);

  if (lastY == null) {
    lastY = offset;
    notifyScrollLayoutListeners();
    return;
  }

  const prev = lastY;
  const dy = offset - prev;
  lastY = offset;

  if (Math.abs(dy) < MOVE_EPS) {
    notifyScrollLayoutListeners();
    return;
  }

  updateScrollDirection(prev, offset);
  applyScrollDelta(dy);
  enterScrolling();
  notifyScrollLayoutListeners();
}

export function noteFloatingScrollEndDrag(sourceId: string) {
  if (suppressFloating) return;
  clearDragSettleTimer();
  dragSettleTimer = setTimeout(() => {
    dragSettleTimer = null;
    internalSettle();
  }, FLOATING_DRAG_SETTLE_MS);
}

export function noteFloatingMomentumScrollBegin(sourceId: string) {
  if (suppressFloating) return;
  clearDragSettleTimer();
  clearRestoreRaf();
  noteFloatingScrollBegin(sourceId);
}

export function noteFloatingMomentumScrollEnd(sourceId: string) {
  if (suppressFloating) return;
  clearDragSettleTimer();
  internalSettle();
}

/** @deprecated استخدم noteFloatingMomentumScrollEnd أو noteFloatingScrollEndDrag */
export function noteFloatingScrollSettle(_sourceId: string) {
  internalSettle();
}

export function forceFloatingVisible() {
  enterIdle();
}

export function forceFloatingHidden() {
  clearAllTimers();
  setVisibility(0);
  setPhase('scrolling');
}

type ScrollLayoutListener = () => void;
const scrollLayoutListeners = new Set<ScrollLayoutListener>();

function notifyScrollLayoutListeners() {
  scrollLayoutListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore
    }
  });
}

export function subscribeScrollLayoutChecks(listener: ScrollLayoutListener) {
  scrollLayoutListeners.add(listener);
  return () => {
    scrollLayoutListeners.delete(listener);
  };
}
