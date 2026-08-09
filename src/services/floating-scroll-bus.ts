/**
 * ظهور/اختفاء الواجهة العائمة — اتجاه التمرير + إظهار عند السكون.
 *
 * - الشاشة المركّزة فقط ترسل أحداثاً (بوابة useIsFocused في المستهلكين).
 * - أول تمرير فعلي من مصدر يملّكه تلقائياً (يتفادى صراع listChrome vs FullScreenFeed).
 * - أسفل → إخفاء | أعلى / قمة القائمة / سكون → إظهار.
 */

type VisibilityListener = (visible: boolean) => void;

const listeners = new Set<VisibilityListener>();

let visible = true;
let activeSourceId: string | null = null;
let lastY: number | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

const HIDE_DY = 10;
const SHOW_DY = 8;
const TOP_EDGE = 16;
const IDLE_SHOW_MS = 650;

function emit(next: boolean) {
  const effective = suppressFloating ? false : next;
  if (visible === effective) return;
  visible = effective;
  listeners.forEach((listener) => {
    try {
      listener(visible);
    } catch {
      // ignore
    }
  });
}

/** إخفاء قسري للأزرار العائمة (مثلاً داخل محادثة الخاصة) حتى يُلغى */
let suppressFloating = false;

export function setFloatingSuppressed(suppressed: boolean) {
  suppressFloating = suppressed;
  clearIdle();
  lastY = null;
  emit(!suppressed);
}

export function isFloatingSuppressed() {
  return suppressFloating;
}

function clearIdle() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function armIdleShow(delay = IDLE_SHOW_MS) {
  clearIdle();
  idleTimer = setTimeout(() => {
    idleTimer = null;
    lastY = null;
    emit(true);
  }, delay);
}

export function subscribeFloatingVisibility(listener: VisibilityListener) {
  listeners.add(listener);
  listener(visible);
  return () => {
    listeners.delete(listener);
  };
}

export function isFloatingVisible() {
  return visible;
}

/** عند دخول شاشة مركّزة — أظهر فوراً */
export function claimFloatingScrollSource(sourceId: string) {
  activeSourceId = sourceId;
  lastY = null;
  clearIdle();
  emit(true);
}

export function releaseFloatingScrollSource(sourceId: string) {
  if (activeSourceId !== sourceId) return;
  activeSourceId = null;
  lastY = null;
  clearIdle();
  emit(true);
}

export function noteFloatingScrollOffset(sourceId: string, y: number) {
  const offset = Math.max(0, y);

  // تمرير فعلي من مصدر مركّز → يمتلك التحكم (حتى لو listChrome ادّعى المصدر بدون قائمة)
  if (activeSourceId !== sourceId) {
    activeSourceId = sourceId;
    lastY = offset;
    armIdleShow();
    if (offset <= TOP_EDGE) emit(true);
    return;
  }

  armIdleShow();

  if (offset <= TOP_EDGE) {
    lastY = offset;
    emit(true);
    return;
  }

  if (lastY == null) {
    lastY = offset;
    return;
  }

  const dy = offset - lastY;
  if (Math.abs(dy) < 2) return;
  lastY = offset;

  if (dy >= HIDE_DY) emit(false);
  else if (dy <= -SHOW_DY) emit(true);
}

export function noteFloatingScrollSettle(sourceId: string) {
  if (activeSourceId != null && activeSourceId !== sourceId) return;
  lastY = null;
  armIdleShow(280);
}

export function forceFloatingVisible() {
  lastY = null;
  clearIdle();
  if (suppressFloating) {
    emit(false);
    return;
  }
  emit(true);
}

export function forceFloatingHidden() {
  clearIdle();
  emit(false);
  if (!suppressFloating) armIdleShow(IDLE_SHOW_MS);
}
