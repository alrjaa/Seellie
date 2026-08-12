/**
 * صاحب المحتوى الظاهر حالياً في اللقطات/عام/شخصية —
 * تقرأه الأزرار العائمة لعرض الأفاتار ومتابعته.
 * يتبدّل مع كل عنصر محتوى — ليس اختصاراً لصاحب الحساب.
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

  const sameId = current?.id === author.id;
  const incomingAvatar = normalizeAvatar(author.avatar);
  const next: ContentAuthorFocus = {
    id: author.id,
    name: author.name || author.handle || author.id,
    handle: author.handle || (sameId ? current?.handle : undefined),
    // عند تغيّر صاحب المحتوى لا نحتفظ بأفاتار السابق
    avatar: incomingAvatar || (sameId ? normalizeAvatar(current?.avatar) : undefined),
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

/** مسح صريح فقط (تسجيل خروج) — واجهة مقصودة حتى لو لم تُستدعَ بعد من كل المسارات */
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
