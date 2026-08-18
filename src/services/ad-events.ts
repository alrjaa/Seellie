import { createId } from '@/utils/id';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import {
  AD_EVENT_FLUSH_MS,
  sanitizeAdEvent,
  shouldFlushAdEventQueue,
  impressionDedupeKey,
  type AdEventPayload,
} from '@/services/ad-events-core';

const queue: AdEventPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let lastFlushMs = Date.now();
let flushing = false;
const sessionId = createId('ads');
const seenImpressions = new Set<string>();

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushAdEvents();
  }, AD_EVENT_FLUSH_MS);
}

export function queueAdEvent(payload: AdEventPayload): void {
  const row = sanitizeAdEvent(payload);
  if (!row) return;
  if (row.event === 'impression') {
    const key = impressionDedupeKey(row.adId, sessionId);
    if (seenImpressions.has(key)) return;
    seenImpressions.add(key);
  }
  queue.push(row);
  if (shouldFlushAdEventQueue(queue.length, lastFlushMs)) {
    void flushAdEvents();
    return;
  }
  scheduleFlush();
}

export async function flushAdEvents(): Promise<void> {
  if (flushing || queue.length === 0) return;
  if (!isSupabaseConfigured()) {
    queue.length = 0;
    return;
  }
  const sb = getSupabase();
  if (!sb) return;

  flushing = true;
  const batch = queue.splice(0, 20);
  try {
    const { error } = await sb.rpc('append_ad_events', {
      p_events: batch.map((row) => ({
        adId: row.adId,
        event: row.event,
        placement: row.placement ?? null,
        meta: row.meta ?? {},
        at: row.at ?? Date.now(),
      })),
    });
    if (error) {
      queue.unshift(...batch);
      return;
    }
    lastFlushMs = Date.now();
  } catch {
    queue.unshift(...batch);
  } finally {
    flushing = false;
    if (queue.length > 0) scheduleFlush();
  }
}
