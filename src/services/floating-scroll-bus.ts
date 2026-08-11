/**
 * ظهور/اختفاء الواجهة العائمة — آلة حالات بسيطة ومستقرة.
 *
 * المبدأ (مثل شريط كروم التطبيقات):
 * - أثناء التمرير النشط → إخفاء
 * - عند توقف التمرير (لا أحداث لمدة QUIET_MS، أو settle صريح) → إظهار
 * - المصدر المركّز فقط يتحكّم (لا سرقة من مصادر أخرى)
 * - suppress يفرض الإخفاء (المساحة الخاصة) حتى يُلغى
 *
 * لا نعتمد على عتبات dy معقّدة ولا على forceShow من كل مكان.
 */

type VisibilityListener = (visible: boolean) => void;

const listeners = new Set<VisibilityListener>();

let visible = true;
let suppressFloating = false;
/** الشاشة/القائمة المركّزة فقط */
let ownerId: string | null = null;
let showTimer: ReturnType<typeof setTimeout> | null = null;
/** آخر إزاحة للمصدر — لمعرفة أن هناك حركة حقيقية */
let lastY: number | null = null;

/** بعد آخر حدث تمرير — أظهر */
const QUIET_MS = 420;
/** بعد settle صريح — أظهر أسرع */
const SETTLE_MS = 160;

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

function clearShowTimer() {
  if (showTimer) {
    clearTimeout(showTimer);
    showTimer = null;
  }
}

function scheduleShow(delay: number) {
  clearShowTimer();
  if (suppressFloating) {
    emit(false);
    return;
  }
  showTimer = setTimeout(() => {
    showTimer = null;
    lastY = null;
    emit(true);
  }, delay);
}

function hideForActivity() {
  if (suppressFloating) {
    emit(false);
    return;
  }
  emit(false);
  scheduleShow(QUIET_MS);
}

function isOwner(sourceId: string) {
  return ownerId == null || ownerId === sourceId;
}

export function setFloatingSuppressed(suppressed: boolean) {
  suppressFloating = suppressed;
  clearShowTimer();
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

/** الشاشة المركّزة تملك التحكم وتُظهر فوراً */
export function claimFloatingScrollSource(sourceId: string) {
  ownerId = sourceId;
  lastY = null;
  clearShowTimer();
  emit(true);
}

export function releaseFloatingScrollSource(sourceId: string) {
  if (ownerId !== sourceId) return;
  ownerId = null;
  lastY = null;
  clearShowTimer();
  emit(true);
}

/**
 * بداية سحب/تمرير — إخفاء فوري.
 * يُستدعى من onScrollBeginDrag / onMomentumScrollBegin.
 */
export function noteFloatingScrollBegin(sourceId: string) {
  if (suppressFloating) return;
  if (!isOwner(sourceId)) return;
  if (ownerId == null) ownerId = sourceId;
  lastY = null;
  hideForActivity();
}

/**
 * إزاحة التمرير — أي حركة حقيقية = نشاط → إخفاء + إعادة جدولة الإظهار.
 * يتجاهل المصادر غير المالكة بالكامل.
 */
export function noteFloatingScrollOffset(sourceId: string, y: number) {
  if (suppressFloating) return;
  if (!isOwner(sourceId)) return;
  if (ownerId == null) ownerId = sourceId;

  const offset = Math.max(0, y);
  if (lastY == null) {
    lastY = offset;
    // أول إزاحة بعد claim لا تخفي — ننتظر حركة
    return;
  }

  const dy = offset - lastY;
  if (Math.abs(dy) < 2) return;
  lastY = offset;
  hideForActivity();
}

/**
 * نهاية السحب/الزخم — أظهر بعد تأخير قصير.
 */
export function noteFloatingScrollSettle(sourceId: string) {
  if (suppressFloating) return;
  if (!isOwner(sourceId)) return;
  lastY = null;
  scheduleShow(SETTLE_MS);
}

/** إظهار فوري (تغيير مسار / عودة للتطبيق) — ليس أثناء التمرير */
export function forceFloatingVisible() {
  lastY = null;
  clearShowTimer();
  if (suppressFloating) {
    emit(false);
    return;
  }
  emit(true);
}

export function forceFloatingHidden() {
  clearShowTimer();
  emit(false);
  if (!suppressFloating) scheduleShow(QUIET_MS);
}
