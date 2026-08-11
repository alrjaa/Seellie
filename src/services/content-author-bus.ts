/**
 * صاحب المحتوى الظاهر حالياً في اللقطات/عام/شخصية —
 * تقرأه الأزرار العائمة لعرض الأفاتار ومتابعته.
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
  const nextId = author?.id || null;
  const prevId = current?.id || null;
  if (
    nextId === prevId &&
    (author?.avatar || '') === (current?.avatar || '') &&
    (author?.handle || '') === (current?.handle || '') &&
    (author?.name || '') === (current?.name || '')
  ) {
    return;
  }
  current = author;
  emit();
}

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
