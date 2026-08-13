/**
 * Pure share-card merge/reconcile (no Supabase / RN).
 * FIX-04 P0-2: callers must only apply cloud catalogs after a successful fetch.
 */
import type { ShareCard } from '@/data/initial-data';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isCloudCardId(id: string): boolean {
  return UUID_RE.test(id);
}

/** Merge by id; prefer newer timestamp when both exist. */
export function mergeShareCardsById(
  incoming: ShareCard[],
  existing: ShareCard[]
): ShareCard[] {
  const map = new Map<string, ShareCard>();
  for (const c of existing) map.set(c.id, c);
  for (const c of incoming) {
    const prev = map.get(c.id);
    if (!prev) {
      map.set(c.id, c);
      continue;
    }
    const prevTs = prev.timestamp instanceof Date ? prev.timestamp.getTime() : 0;
    const nextTs = c.timestamp instanceof Date ? c.timestamp.getTime() : 0;
    map.set(c.id, nextTs >= prevTs ? { ...prev, ...c } : { ...c, ...prev });
  }
  return Array.from(map.values()).sort((a, b) => {
    const at = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
    const bt = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
    return bt - at;
  });
}

/**
 * Cloud is source of truth for UUID share cards.
 * Keeps optimistic local-only ids (createId('share') → share_…) until they sync.
 * SUCCESS_EMPTY → drops cloud-backed cards; local optimistic may remain.
 */
export function reconcileShareCardsWithCloud(
  local: ShareCard[],
  cloud: ShareCard[]
): ShareCard[] {
  const cloudIds = new Set(cloud.map((c) => c.id));
  const keepLocalOnly = local.filter(
    (c) => !isCloudCardId(c.id) && !cloudIds.has(c.id)
  );
  return mergeShareCardsById(cloud, keepLocalOnly);
}

/**
 * FIX-04 P0-2 — only apply cloud catalog when fetch succeeded.
 * ERROR / network / timeout / auth → keep local inbox.
 * SUCCESS_EMPTY (`ok: true`, cards: []) → reconcile allowed.
 */
export function shouldApplyShareCardsCloud(res: {
  ok?: boolean;
  error?: string;
  cards: ShareCard[];
}): boolean {
  return res.ok === true;
}

export function applyShareCardsCloudResult(
  local: ShareCard[],
  res: { ok?: boolean; error?: string; cards: ShareCard[] }
): ShareCard[] {
  if (!shouldApplyShareCardsCloud(res)) return local;
  return reconcileShareCardsWithCloud(local, res.cards);
}
