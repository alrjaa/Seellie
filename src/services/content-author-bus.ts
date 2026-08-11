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

export function setContentAuthorFocus(author: ContentAuthorFocus | null) {
  if (!author?.id) return;
  if (
    author.id === current?.id &&
    (author.avatar || '') === (current?.avatar || '') &&
    (author.handle || '') === (current?.handle || '') &&
    (author.name || '') === (current?.name || '')
  ) {
    return;
  }
  current = {
    id: author.id,
    name: author.name || author.handle || author.id,
    handle: author.handle,
    avatar: author.avatar,
  };
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
