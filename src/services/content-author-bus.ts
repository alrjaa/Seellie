/**
 * صاحب المحتوى الظاهر حالياً في اللقطات/عام/شخصية —
 * تقرأه الأزرار العائمة لعرض الأفاتار ومتابعته.
 * لا نمسحه عند مغادرة الشاشة حتى يبقى ظاهراً في الرئيسية.
 */

export type ContentAuthorFocus = {
  id: string;
  name: string;
  handle?: string;
  avatar?: string;
};

type Listener = (author: ContentAuthorFocus | null) => void;

const listeners = new Set<Listener>();
let current: ContentAuthorFocus | null = null;

function emit() {
  listeners.forEach((listener) => {
    try {
      listener(current);
    } catch {
      // ignore
    }
  });
}

function normalizeAvatar(value?: string) {
  const v = (value || '').trim();
  return v || undefined;
}

export function setContentAuthorFocus(author: ContentAuthorFocus | null) {
  if (!author?.id) return;

  const incomingAvatar = normalizeAvatar(author.avatar);
  const next = {
    id: author.id,
    name: author.name || author.handle || author.id,
    handle: author.handle || (current?.id === author.id ? current?.handle : undefined),
    // لا تفقد الأفاتار عند تحديث لاحق بلا صورة
    avatar:
      incomingAvatar ||
      (current?.id === author.id ? normalizeAvatar(current?.avatar) : undefined),
  };

  if (
    next.id === current?.id &&
    (next.avatar || '') === (current?.avatar || '') &&
    (next.handle || '') === (current?.handle || '') &&
    (next.name || '') === (current?.name || '')
  ) {
    return;
  }

  current = next;
  emit();
}

/** مسح صريح فقط (تسجيل خروج) — لا يُستدعى عند مغادرة تبويب اللقطات */
export function clearContentAuthorFocus() {
  if (!current) return;
  current = null;
  emit();
}

export function getContentAuthorFocus() {
  return current;
}

export function subscribeContentAuthorFocus(listener: Listener) {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}
