/**
 * حالة شفافية الواجهة العائمة أثناء التمرير — آلة حالات واحدة.
 *
 * idle ⇄ scrolling  (بعد توقف حقيقي + تأخير → idle)
 *
 * opacity + اتجاه التمرير (up/down) — الـ FAB يطبّق translateY محلياً.
 */

export type FloatingScrollPhase = 'idle' | 'scrolling';

type VisibilityListener = (visible: boolean) => void;
type PhaseListener = (phase: FloatingScrollPhase) => void;
type DirectionListener = (direction: FloatingScrollDirection) => void;

export type FloatingScrollDirection = 'up' | 'down';

const listeners = new Set<VisibilityListener>();
const phaseListeners = new Set<PhaseListener>();
const directionListeners = new Set<DirectionListener>();

export const FLOATING_SCROLL_DIM_OPACITY = 0.12;
export const FLOATING_SCROLL_PEEK_OPACITY = 0.92;
export const FLOATING_SCROLL_SLIDE_PX = 18;
export const FLOATING_FADE_OUT_MS = 200;
export const FLOATING_RESTORE_DELAY_MS = 520;
export const FLOATING_FADE_IN_MS = 250;
/** Wheel: لا settle قبل توقف التمرير الفعلي */
export const FLOATING_WHEEL_SETTLE_MS = 650;
/** بعد رفع الإصبع: انتظر قليلاً قبل settle إن لم يبدأ momentum */
export const FLOATING_DRAG_SETTLE_MS = 160;

const MOVE_EPS = 8;
const MAX_SCROLLING_MS = 4000;

let phase: FloatingScrollPhase = 'idle';
let scrollDirection: FloatingScrollDirection = 'down';
let suppressFloating = false;
let ownerId: string | null = null;
let lastY: number | null = null;
let restoreTimer: ReturnType<typeof setTimeout> | null = null;
let dragSettleTimer: ReturnType<typeof setTimeout> | null = null;
let scrollingFailsafeTimer: ReturnType<typeof setTimeout> | null = null;

function phaseToVisible(p: FloatingScrollPhase): boolean {
  return p !== 'scrolling';
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

function clearAllTimers() {
  clearRestoreTimer();
  clearDragSettleTimer();
  clearScrollingFailsafe();
}

function setPhase(next: FloatingScrollPhase) {
  if (phase === next) return;
  phase = next;
  notifyPhase();
}

function enterIdle() {
  lastY = null;
  clearAllTimers();
  setPhase('idle');
}

function enterScrolling() {
  clearRestoreTimer();
  clearDragSettleTimer();
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

function scheduleRestore() {
  clearRestoreTimer();
  clearDragSettleTimer();
  clearScrollingFailsafe();
  lastY = null;
  restoreTimer = setTimeout(() => {
    restoreTimer = null;
    if (phase === 'scrolling') {
      setPhase('idle');
    }
  }, FLOATING_RESTORE_DELAY_MS);
}

function internalSettle() {
  if (phase !== 'scrolling') return;
  scheduleRestore();
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
  lastY = null;
  enterScrolling();
}

export function noteFloatingScrollOffset(sourceId: string, y: number) {
  if (suppressFloating) return;
  if (ownerId != null && ownerId !== sourceId) return;
  if (ownerId == null) ownerId = sourceId;

  const offset = Math.max(0, y);

  if (phase === 'scrolling') {
    const prev = lastY ?? offset;
    lastY = offset;
    updateScrollDirection(prev, offset);
    notifyScrollLayoutListeners();
    return;
  }

  if (lastY == null) {
    lastY = offset;
    notifyScrollLayoutListeners();
    return;
  }

  const prev = lastY;
  const dy = Math.abs(offset - prev);
  lastY = offset;
  if (dy < MOVE_EPS) {
    notifyScrollLayoutListeners();
    return;
  }

  updateScrollDirection(prev, offset);
  enterScrolling();
  notifyScrollLayoutListeners();
}

/** بعد رفع الإصبع — settle مؤجّل فقط إن لم يبدأ momentum */
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
  enterScrolling();
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
