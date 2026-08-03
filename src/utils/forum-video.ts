/** حد فيديو الساحات: 30 ثانية */
export const FORUM_VIDEO_MAX_SEC = 30;
export const FORUM_VIDEO_MAX_MS = FORUM_VIDEO_MAX_SEC * 1000;

/**
 * مدة أصل ImagePicker تكون بالميلي ثانية.
 * إن كانت القيمة صغيرة جداً نفترض أنها بالثواني (توافق بعض المنصات).
 */
export function videoDurationSecFromPicker(durationMsOrSec?: number | null): number | null {
  if (durationMsOrSec == null || !Number.isFinite(durationMsOrSec) || durationMsOrSec <= 0) {
    return null;
  }
  // قيم ImagePicker الحديثة بالميلي ثانية؛ إن < 1000 غالباً ثوانٍ
  if (durationMsOrSec < 1000) return durationMsOrSec;
  return durationMsOrSec / 1000;
}

export function isForumVideoWithinLimit(durationSec: number | null): boolean {
  if (durationSec == null) return true; // لا نمنع إن تعذر قراءة المدة
  return durationSec <= FORUM_VIDEO_MAX_SEC + 0.5;
}
