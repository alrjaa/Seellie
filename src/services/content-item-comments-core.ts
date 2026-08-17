/**
 * F12-P2-05 — pure helpers for local content-item comments (no RN / storage).
 */
export const CONTENT_ITEM_COMMENTS_MAX = 50;

export type ContentItemCommentCore = {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  timestamp: number;
};

/** Newest-first; keep head when over max. */
export function trimContentItemComments<T extends { timestamp: number }>(
  list: T[]
): T[] {
  if (list.length <= CONTENT_ITEM_COMMENTS_MAX) return list;
  return list.slice(0, CONTENT_ITEM_COMMENTS_MAX);
}

export function mergeContentItemComments<T extends { id: string; timestamp: number; text: string }>(
  seed: T[],
  prev: T[]
): T[] {
  const byId = new Map<string, T>();
  [...seed, ...prev].forEach((c) => {
    if (c?.id) byId.set(c.id, c);
  });
  return trimContentItemComments(
    Array.from(byId.values()).sort((a, b) => b.timestamp - a.timestamp)
  );
}
