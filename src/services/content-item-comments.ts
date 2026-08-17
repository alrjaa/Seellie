import { getJson, setJson } from '@/services/storage';
import {
  CONTENT_ITEM_COMMENTS_MAX,
  mergeContentItemComments,
  trimContentItemComments,
} from '@/services/content-item-comments-core';

export { CONTENT_ITEM_COMMENTS_MAX } from '@/services/content-item-comments-core';

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
/** Per-contentId listeners — avoids re-rendering every mounted Slide. */
const listenersById = new Map<string, Set<() => void>>();

function emit(contentId: string) {
  const set = listenersById.get(contentId);
  if (!set?.size) return;
  set.forEach((cb) => {
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

function boundStore(raw: Store): Store {
  const next: Store = {};
  for (const [id, list] of Object.entries(raw)) {
    if (!Array.isArray(list) || !list.length) continue;
    next[id] = trimContentItemComments(
      [...list].sort((a, b) => b.timestamp - a.timestamp)
    );
  }
  return next;
}

export async function hydrateContentItemComments(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  const raw = await getJson<Store>(STORAGE_KEY);
  if (raw && typeof raw === 'object') {
    cache = boundStore(raw);
    Object.keys(cache).forEach((id) => emit(id));
  }
}

/**
 * Subscribe to comment updates for a single content item.
 * Cleanup removes this listener only (no global fan-out).
 */
export function subscribeContentItemComments(
  contentId: string,
  cb: () => void
): () => void {
  if (!contentId) {
    return () => undefined;
  }
  let set = listenersById.get(contentId);
  if (!set) {
    set = new Set();
    listenersById.set(contentId, set);
  }
  set.add(cb);
  void hydrateContentItemComments();
  return () => {
    const cur = listenersById.get(contentId);
    if (!cur) return;
    cur.delete(cb);
    if (cur.size === 0) listenersById.delete(contentId);
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
  const next = mergeContentItemComments(seed, prev);
  const same =
    next.length === prev.length &&
    next.every((c, i) => c.id === prev[i]?.id && c.text === prev[i]?.text);
  if (same) return;
  cache = { ...cache, [contentId]: next };
  persist();
  emit(contentId);
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
    [contentId]: trimContentItemComments([comment, ...prev]),
  };
  persist();
  emit(contentId);
}

/** Test helper — listener count for one content id (no network). */
export function __debugContentItemCommentListenerCount(
  contentId: string
): number {
  return listenersById.get(contentId)?.size ?? 0;
}
