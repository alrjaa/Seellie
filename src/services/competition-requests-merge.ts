/**
 * Pure competition-request merge/reconcile (no Supabase / RN).
 * FIX-04 P0-1: callers must only reconcile after a successful cloud fetch.
 */
import type { CompetitionRequest } from '@/data/initial-data';

export function mergeCompetitionRequestsById(
  ...lists: CompetitionRequest[][]
): CompetitionRequest[] {
  const map = new Map<string, CompetitionRequest>();
  for (const list of lists) {
    for (const item of list) {
      const prev = map.get(item.id);
      if (!prev) {
        map.set(item.id, item);
        continue;
      }
      const prevTime = new Date(prev.reviewedAt || prev.requestedAt).getTime();
      const nextTime = new Date(item.reviewedAt || item.requestedAt).getTime();
      if (item.status !== 'pending' && prev.status === 'pending') {
        map.set(item.id, item);
      } else if (nextTime >= prevTime) {
        map.set(item.id, item);
      }
    }
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
  );
}

/**
 * السحابة مصدر الحقيقة لطلبات التنظيم السحابية (creq_*).
 * يزيل محلياً ما حُذف من Supabase — فقط بعد SUCCESS fetch.
 */
export function reconcileCompetitionRequestsWithCloud(
  local: CompetitionRequest[],
  cloud: CompetitionRequest[]
): CompetitionRequest[] {
  const cloudIds = new Set(cloud.map((r) => r.id));
  const keepLocalOnly = local.filter(
    (r) => !String(r.id).startsWith('creq_') && !cloudIds.has(r.id)
  );
  return mergeCompetitionRequestsById(keepLocalOnly, cloud);
}

/**
 * FIX-04 P0-1 — only reconcile when the cloud fetch succeeded.
 * ERROR / no_session / network / malformed → keep local (do not drop creq_*).
 * SUCCESS_EMPTY (`ok: true`, items: []) → reconcile allowed.
 */
export function shouldApplyCompetitionRequestsCloud(res: {
  ok?: boolean;
  error?: string;
  items: CompetitionRequest[];
}): boolean {
  return res.ok === true;
}
