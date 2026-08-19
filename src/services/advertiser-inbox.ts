export type AdvertiserNoticeKind = 'blocked' | 'deleted';

export type AdvertiserNotification = {
  id: string;
  advertiser_id: string;
  advertisement_id?: string | null;
  kind: AdvertiserNoticeKind;
  ad_title?: string | null;
  note?: string | null;
  read_at?: string | null;
  created_at: string;
};

function clipField(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

export function sanitizeAdvertiserNotification(
  raw: unknown
): AdvertiserNotification | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const id = clipField(row.id, 64);
  const advertiserId = clipField(row.advertiser_id, 64);
  const kindRaw = clipField(row.kind, 16);
  const kind: AdvertiserNoticeKind | null =
    kindRaw === 'blocked' || kindRaw === 'deleted' ? kindRaw : null;
  const createdAt = clipField(row.created_at, 40);
  if (!id || !advertiserId || !kind || !createdAt) return null;
  return {
    id,
    advertiser_id: advertiserId,
    advertisement_id: clipField(row.advertisement_id, 64) || null,
    kind,
    ad_title: clipField(row.ad_title, 80) || null,
    note: clipField(row.note, 240) || null,
    read_at: clipField(row.read_at, 40) || null,
    created_at: createdAt,
  };
}

export function sanitizeAdvertiserNotifications(
  raw: unknown
): AdvertiserNotification[] {
  if (!Array.isArray(raw)) return [];
  const out: AdvertiserNotification[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const notice = sanitizeAdvertiserNotification(item);
    if (!notice || seen.has(notice.id)) continue;
    seen.add(notice.id);
    out.push(notice);
    if (out.length >= 50) break;
  }
  return out;
}
