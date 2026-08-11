import { getJson, setJson } from '@/services/storage';

const STORAGE_KEY = 'seellie_content_item_comments_v1';

export type ContentItemComment = {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  timestamp: number;
};

type Store = Record<string, ContentItemComment[]>;

let cache: Store = {};
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore subscriber errors
    }
  });
}

function persist() {
  void setJson(STORAGE_KEY, cache);
}

export async function hydrateContentItemComments(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  const raw = await getJson<Store>(STORAGE_KEY);
  if (raw && typeof raw === 'object') {
    cache = raw;
    emit();
  }
}

export function subscribeContentItemComments(cb: () => void): () => void {
  listeners.add(cb);
  void hydrateContentItemComments();
  return () => {
    listeners.delete(cb);
  };
}

export function getContentItemComments(contentId: string): ContentItemComment[] {
  return cache[contentId] || [];
}

/** دمج تعليقات المصدر (وسائط/تحليل) مع المخزن المحلي دون تكرار المعرف */
export function seedContentItemComments(
  contentId: string,
  seed: ContentItemComment[]
): void {
  if (!contentId || !seed.length) return;
  const prev = cache[contentId] || [];
  const byId = new Map<string, ContentItemComment>();
  [...seed, ...prev].forEach((c) => {
    if (c?.id) byId.set(c.id, c);
  });
  const next = Array.from(byId.values()).sort(
    (a, b) => b.timestamp - a.timestamp
  );
  const same =
    next.length === prev.length &&
    next.every((c, i) => c.id === prev[i]?.id && c.text === prev[i]?.text);
  if (same) return;
  cache = { ...cache, [contentId]: next };
  persist();
  emit();
}

export function addContentItemComment(
  contentId: string,
  comment: ContentItemComment
): void {
  if (!contentId || !comment?.id || !comment.text?.trim()) return;
  const prev = cache[contentId] || [];
  if (prev.some((c) => c.id === comment.id)) return;
  cache = {
    ...cache,
    [contentId]: [comment, ...prev],
  };
  persist();
  emit();
}
