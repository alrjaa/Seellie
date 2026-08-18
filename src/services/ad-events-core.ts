/** Pure ad event batching helpers — safe for unit tests. */

export type AdEventType =
  | 'impression'
  | 'video_start'
  | 'video_complete'
  | 'click'
  | 'skip'
  | 'hide'
  | 'report';

export type AdEventPayload = {
  adId: string;
  event: AdEventType;
  placement?: string;
  meta?: Record<string, string | number | boolean>;
  at?: number;
};

export const AD_EVENT_BATCH_MAX = 20;
export const AD_EVENT_FLUSH_MS = 30_000;

const ALLOWED: ReadonlySet<AdEventType> = new Set([
  'impression',
  'video_start',
  'video_complete',
  'click',
  'skip',
  'hide',
  'report',
]);

export function sanitizeAdEvent(raw: AdEventPayload): AdEventPayload | null {
  const adId = String(raw.adId ?? '')
    .trim()
    .slice(0, 80);
  if (!adId || !ALLOWED.has(raw.event)) return null;
  const placement = raw.placement
    ? String(raw.placement).trim().slice(0, 32)
    : undefined;
  const meta: Record<string, string | number | boolean> = {};
  if (raw.meta && typeof raw.meta === 'object') {
    for (const [key, value] of Object.entries(raw.meta)) {
      const k = key.slice(0, 32);
      if (!k) continue;
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        meta[k] =
          typeof value === 'string' ? value.slice(0, 200) : value;
      }
    }
  }
  return {
    adId,
    event: raw.event,
    placement,
    meta: Object.keys(meta).length ? meta : undefined,
    at: Number.isFinite(raw.at) ? Number(raw.at) : Date.now(),
  };
}

export function shouldFlushAdEventQueue(
  queueLength: number,
  lastFlushMs: number,
  nowMs: number = Date.now()
): boolean {
  if (queueLength <= 0) return false;
  if (queueLength >= AD_EVENT_BATCH_MAX) return true;
  return nowMs - lastFlushMs >= AD_EVENT_FLUSH_MS;
}

export function impressionDedupeKey(
  adId: string,
  sessionId: string,
  placement?: string
): string {
  const pl = String(placement ?? 'unknown')
    .trim()
    .slice(0, 32);
  return `${sessionId}:${adId}:${pl}:impression`;
}
