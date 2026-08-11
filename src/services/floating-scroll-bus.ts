/**
 * ظهور/اختفاء الواجهة العائمة — اتجاه التمرير + إظهار عند السكون.
 *
 * قواعد بسيطة وموثوقة:
 * - تمرير للأسفل → إخفاء
 * - تمرير للأعلى / قمة القائمة / سكون / انتهاء الزخم → إظهار
 * - مؤقّت أمان يعيد الإظهار إن بقيت مخفية
 */

type VisibilityListener = (visible: boolean) => void;

const listeners = new Set<VisibilityListener>();

let visible = true;
let activeSourceId: string | null = null;
let lastY: number | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let failsafeTimer: ReturnType<typeof setTimeout> | null = null;

const HIDE_DY = 12;
const SHOW_DY = 4;
const TOP_EDGE = 20;
const IDLE_SHOW_MS = 360;
const FAILSAFE_SHOW_MS = 900;

/** إخفاء قسري (مساحة خاصة…) */
let suppressFloating = false;

function emit(next: boolean) {
  const effective = suppressFloating ? false : next;
  if (visible === effective) {
    if (effective) clearFailsafe();
    return;
  }
  visible = effective;
  if (effective) clearFailsafe();
  else armFailsafe();
  listeners.forEach((listener) => {
    try {
      listener(visible);
    } catch {
      // ignore
    }
  });
}

function clearIdle() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function clearFailsafe() {
  if (failsafeTimer) {
    clearTimeout(failsafeTimer);
    failsafeTimer = null;
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

/** إن بقيت مخفية لأي سبب — أعد الإظهار */
function armFailsafe() {
  clearFailsafe();
  failsafeTimer = setTimeout(() => {
    failsafeTimer = null;
    lastY = null;
    emit(true);
  }, FAILSAFE_SHOW_MS);
}

export function setFloatingSuppressed(suppressed: boolean) {
  suppressFloating = suppressed;
  clearIdle();
  clearFailsafe();
  lastY = null;
  emit(!suppressed);
}

export function isFloatingSuppressed() {
  return suppressFloating;
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

/**
 * لا نسرق المصدر من فيد نشط بسبب listChrome غير المستخدم.
 * المصدر الجديد يملك التحكم فقط إن لم يوجد مصدر، أو طابق الحالي، أو بعد تمرير فعلي واضح.
 */
export function noteFloatingScrollOffset(sourceId: string, y: number) {
  if (suppressFloating) return;

  const offset = Math.max(0, y);

  if (activeSourceId == null) {
    activeSourceId = sourceId;
    lastY = offset;
    armIdleShow();
    emit(true);
    return;
  }

  if (activeSourceId !== sourceId) {
    // تمرير حقيقي من مصدر آخر → يتملّك (فيد vs قائمة)
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
  if (Math.abs(dy) < 1.5) return;
  lastY = offset;

  if (dy >= HIDE_DY) emit(false);
  else if (dy <= -SHOW_DY) emit(true);
}

export function noteFloatingScrollSettle(sourceId: string) {
  if (suppressFloating) return;
  // اسمح بالتسوية من المصدر النشط أو إن لم يُحدَّد مصدر
  if (activeSourceId != null && activeSourceId !== sourceId) {
    // مصدر قديم توقّف — لا تمنع الإظهار
    armIdleShow(220);
    return;
  }
  lastY = null;
  armIdleShow(200);
  emit(true);
}

export function forceFloatingVisible() {
  lastY = null;
  clearIdle();
  clearFailsafe();
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
