/**
 * ظهور/إخفاء الواجهة العائمة — عقد ثابت وموثوق.
 *
 * السلوك:
 * 1) الافتراضي: ظاهرة
 * 2) بداية تمرير / حركة معتبرة → إخفاء
 * 3) نهاية التمرير (settle) → إظهار بعد تأخير قصير
 * 4) ضمان أقصى: لن تبقى مخفية أكثر من MAX_HIDDEN_MS
 * 5) suppressFloating: يخفي زر FAB فقط دون إخفاء topOverlay (نموذج النشر في الفريد / الخاصة)
 *
 * الخلل السابق: كل حدث onScroll كان يعيد جدولة مؤقّت الإظهار،
 * فأحداث الاهتزاز/الصفحات تمنع الظهور إلى الأبد. هنا أثناء الإخفاء
 * نتجاهل إزاحات التمرير ولا نؤجّل الظهور.
 */

type VisibilityListener = (visible: boolean) => void;

const listeners = new Set<VisibilityListener>();

let visible = true;
let suppressFloating = false;
let ownerId: string | null = null;
/** المستخدم في تفاعل تمرير حالياً */
let scrolling = false;
let lastY: number | null = null;
let settleTimer: ReturnType<typeof setTimeout> | null = null;
let failsafeTimer: ReturnType<typeof setTimeout> | null = null;

const MOVE_EPS = 8;
const SETTLE_SHOW_MS = 200;
/** ضمان قوي: إظهار حتى لو لم يصل settle من النظام */
const MAX_HIDDEN_MS = 850;

function notify() {
  listeners.forEach((listener) => {
    try {
      listener(visible);
    } catch {
      // ignore
    }
  });
}

function emit(next: boolean) {
  if (visible === next) return;
  visible = next;
  notify();
}

function clearSettleTimer() {
  if (settleTimer) {
    clearTimeout(settleTimer);
    settleTimer = null;
  }
}

function clearFailsafeTimer() {
  if (failsafeTimer) {
    clearTimeout(failsafeTimer);
    failsafeTimer = null;
  }
}

function showNow() {
  scrolling = false;
  lastY = null;
  clearSettleTimer();
  clearFailsafeTimer();
  emit(true);
}

function hideForScroll() {
  emit(false);
  // يُفعَّل مرة واحدة لكل فترة إخفاء — لا يُعاد ضبطه بأحداث التمرير
  if (!failsafeTimer) {
    failsafeTimer = setTimeout(() => {
      failsafeTimer = null;
      showNow();
    }, MAX_HIDDEN_MS);
  }
}

function scheduleSettleShow() {
  clearSettleTimer();
  settleTimer = setTimeout(() => {
    settleTimer = null;
    showNow();
  }, SETTLE_SHOW_MS);
}

function acceptsSource(sourceId: string) {
  return ownerId == null || ownerId === sourceId;
}

/**
 * إخفاء عمود الأزرار العائمة فقط (FAB).
 * لا يخفي topOverlay في FullScreenFeed — حتى يبقى نموذج نشر الفريد ظاهراً.
 */
export function setFloatingSuppressed(suppressed: boolean) {
  suppressFloating = suppressed;
  scrolling = false;
  lastY = null;
  clearSettleTimer();
  clearFailsafeTimer();
  if (suppressed) {
    // أبقِ chrome/overlay كما هو؛ FAB يقرأ isFloatingSuppressed()
    notify();
  } else {
    emit(true);
  }
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

export function claimFloatingScrollSource(sourceId: string) {
  ownerId = sourceId;
  scrolling = false;
  lastY = null;
  clearSettleTimer();
  clearFailsafeTimer();
  emit(true);
}

export function releaseFloatingScrollSource(sourceId: string) {
  if (ownerId !== sourceId) return;
  ownerId = null;
  scrolling = false;
  lastY = null;
  clearSettleTimer();
  clearFailsafeTimer();
  emit(true);
}

export function noteFloatingScrollBegin(sourceId: string) {
  if (suppressFloating) return;
  if (!acceptsSource(sourceId)) return;
  if (ownerId == null) ownerId = sourceId;
  scrolling = true;
  lastY = null;
  clearSettleTimer();
  hideForScroll();
}

/**
 * أثناء الإخفاء/التمرير: نحدّث lastY فقط — بدون تأجيل الظهور.
 * إن كنا ظاهرين وحصلت حركة معتبرة: نبدأ الإخفاء مرة واحدة.
 */
export function noteFloatingScrollOffset(sourceId: string, y: number) {
  if (suppressFloating) return;
  if (!acceptsSource(sourceId)) return;
  if (ownerId == null) ownerId = sourceId;

  const offset = Math.max(0, y);

  if (scrolling || !visible) {
    lastY = offset;
    notifyScrollLayoutListeners();
    return;
  }

  if (lastY == null) {
    lastY = offset;
    notifyScrollLayoutListeners();
    return;
  }

  const dy = Math.abs(offset - lastY);
  lastY = offset;
  if (dy < MOVE_EPS) return;

  scrolling = true;
  clearSettleTimer();
  hideForScroll();
  notifyScrollLayoutListeners();
}

export function noteFloatingScrollSettle(sourceId: string) {
  if (suppressFloating) return;
  if (!acceptsSource(sourceId)) return;
  scrolling = false;
  lastY = null;
  scheduleSettleShow();
  notifyScrollLayoutListeners();
}

export function forceFloatingVisible() {
  showNow();
}

export function forceFloatingHidden() {
  clearSettleTimer();
  scrolling = false;
  emit(false);
  if (!suppressFloating && !failsafeTimer) {
    failsafeTimer = setTimeout(() => {
      failsafeTimer = null;
      showNow();
    }, MAX_HIDDEN_MS);
  }
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

/** Inline video visibility checks (measureInWindow) — event-driven on scroll. */
export function subscribeScrollLayoutChecks(listener: ScrollLayoutListener) {
  scrollLayoutListeners.add(listener);
  return () => {
    scrollLayoutListeners.delete(listener);
  };
}
