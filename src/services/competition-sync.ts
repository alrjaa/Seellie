import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import type { Competition, CompetitionRequest } from '@/data/initial-data';
import { getDb } from '@/services/firebase';
import { getJson, setJson } from '@/services/storage';
import { isSupabaseConfigured } from '@/services/supabase';
import { isSeedCompetitionId } from '@/utils/seed-data';

export const COMPETITION_REQUESTS_KEY = 'seellie.competitionRequests';
export const COMPETITIONS_KEY = 'seellie.competitions';

const REQUESTS_DOC_PATH = ['appState', 'competitionRequests'] as const;
const COMPETITIONS_DOC_PATH = ['appState', 'competitions'] as const;

function toIso(value: Date | string | undefined): string | undefined {
  if (value == null) return undefined;
  return value instanceof Date ? value.toISOString() : String(value);
}

export function reviveCompetitionRequest(
  request: CompetitionRequest
): CompetitionRequest {
  return {
    ...request,
    termsAcceptedAt: new Date(request.termsAcceptedAt),
    requestedAt: new Date(request.requestedAt),
    reviewedAt: request.reviewedAt
      ? new Date(request.reviewedAt)
      : undefined,
  };
}

function serializeRequest(request: CompetitionRequest): CompetitionRequest {
  return {
    ...request,
    termsAcceptedAt: toIso(request.termsAcceptedAt)!,
    requestedAt: toIso(request.requestedAt)!,
    reviewedAt: toIso(request.reviewedAt),
  };
}

export async function loadCompetitionRequests(): Promise<CompetitionRequest[]> {
  const local =
    (await getJson<CompetitionRequest[]>(COMPETITION_REQUESTS_KEY)) ?? [];
  // Supabase is source of truth — do not block boot on legacy Firestore reads
  if (isSupabaseConfigured()) {
    return local.map(reviveCompetitionRequest);
  }
  const db = getDb();
  if (!db) {
    return local.map(reviveCompetitionRequest);
  }

  try {
    const snap = await getDoc(doc(db, ...REQUESTS_DOC_PATH));
    if (snap.exists()) {
      const items = (snap.data()?.items ?? []) as CompetitionRequest[];
      await setJson(COMPETITION_REQUESTS_KEY, items);
      return items.map(reviveCompetitionRequest);
    }
  } catch (error) {
    console.warn('[competition-sync] load requests failed', error);
  }

  return local.map(reviveCompetitionRequest);
}

export async function saveCompetitionRequests(
  items: CompetitionRequest[]
): Promise<void> {
  const plain = items.map(serializeRequest);
  await setJson(COMPETITION_REQUESTS_KEY, plain);

  // عندما تكون Supabase مهيأة فهي مصدر الحقيقة بين الأجهزة — لا تستبدل Firebase كامل المستند
  if (isSupabaseConfigured()) return;

  const db = getDb();
  if (!db) return;

  try {
    await setDoc(doc(db, ...REQUESTS_DOC_PATH), {
      items: plain,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[competition-sync] save requests failed', error);
  }
}

export function subscribeCompetitionRequests(
  onChange: (items: CompetitionRequest[]) => void
): Unsubscribe | null {
  const db = getDb();
  if (!db) return null;

  try {
    return onSnapshot(
      doc(db, ...REQUESTS_DOC_PATH),
      (snap) => {
        if (!snap.exists()) return;
        const items = (snap.data()?.items ?? []) as CompetitionRequest[];
        void setJson(COMPETITION_REQUESTS_KEY, items);
        onChange(items.map(reviveCompetitionRequest));
      },
      (error) => {
        console.warn('[competition-sync] subscribe requests failed', error);
      }
    );
  } catch (error) {
    console.warn('[competition-sync] subscribe requests failed', error);
    return null;
  }
}

export async function loadStoredCompetitions(): Promise<Competition[]> {
  const local = (await getJson<Competition[]>(COMPETITIONS_KEY)) ?? [];
  // Supabase is source of truth — do not block boot on legacy Firestore reads
  if (isSupabaseConfigured()) {
    return reviveCompetitions(local);
  }
  const db = getDb();
  let stored = local;
  if (db) {
    try {
      const snap = await getDoc(doc(db, ...COMPETITIONS_DOC_PATH));
      if (snap.exists()) {
        const items = (snap.data()?.items ?? []) as Competition[];
        await setJson(COMPETITIONS_KEY, items);
        stored = items;
      }
    } catch (error) {
      console.warn('[competition-sync] load competitions failed', error);
    }
  }
  return reviveCompetitions(stored);
}

function reviveMatchDates(competition: Competition): Competition {
  return {
    ...competition,
    matches: (competition.matches ?? []).map((match) => ({
      ...match,
      date:
        match.date != null
          ? new Date(match.date as Date | string)
          : new Date(),
    })),
  };
}

function reviveCompetitions(items: Competition[]): Competition[] {
  return items.map(reviveMatchDates);
}

export async function saveCompetitions(
  items: Competition[],
  options?: { fromCloud?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  await setJson(COMPETITIONS_KEY, items);

  if (isSupabaseConfigured()) {
    if (options?.fromCloud) {
      return { ok: true };
    }
    return pushCompetitionsToSupabase(items);
  }

  const db = getDb();
  if (!db) return { ok: true };

  try {
    await setDoc(doc(db, ...COMPETITIONS_DOC_PATH), {
      items,
      updatedAt: new Date().toISOString(),
    });
    return { ok: true };
  } catch (error) {
    console.warn('[competition-sync] save competitions failed', error);
    return { ok: false, error: String(error) };
  }
}

/** مسابقات البذرة التجريبية تبقى محلية؛ يُرفع فقط ما يملكه المستخدم (أو الكل للمشرف) */
async function pushCompetitionsToSupabase(
  items: Competition[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { getSupabase } = await import('@/services/supabase');
    const { upsertCompetitionCloud } = await import(
      '@/services/supabase-competitions'
    );
    const sb = getSupabase();
    if (!sb) return { ok: false, error: 'no_client' };

    const { data: sessionData } = await sb.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) return { ok: false, error: 'no_session' };

    let isAdmin = false;
    try {
      const { data: profile } = await sb
        .from('profiles')
        .select('role, active_role, roles')
        .eq('id', uid)
        .maybeSingle();
      const roles = Array.isArray(profile?.roles) ? profile!.roles : [];
      isAdmin =
        profile?.role === 'superadmin' ||
        profile?.active_role === 'superadmin' ||
        roles.includes('superadmin');
    } catch {
      isAdmin = false;
    }

    // لا تحاول upsert مسابقات الآخرين — RLS ترفضها وتظهر «اعتذار المزامنة» بالخطأ
    const targets = items.filter(
      (c) =>
        !!c?.id &&
        !isSeedCompetitionId(c.id) &&
        (isAdmin || c.organizerId === uid)
    );
    if (!targets.length) return { ok: true };

    const results = await Promise.all(
      targets.map(async (c) => {
        const res = await upsertCompetitionCloud(c);
        if (!res.ok && res.error && res.error !== 'no_session') {
          console.warn('[competition-sync] cloud upsert', c.id, res.error);
        }
        return res;
      })
    );
    const failed = results.find(
      (r) => !r.ok && r.error && r.error !== 'no_session'
    );
    if (failed) {
      return { ok: false, error: failed.error };
    }
    const noSession = results.every(
      (r) => !r.ok && r.error === 'no_session'
    );
    if (noSession && targets.length) {
      return { ok: false, error: 'no_session' };
    }
    return { ok: true };
  } catch (error) {
    console.warn('[competition-sync] push to supabase failed', error);
    return { ok: false, error: String(error) };
  }
}

export function subscribeCompetitions(
  onChange: (items: Competition[]) => void
): Unsubscribe | null {
  const db = getDb();
  if (!db) return null;

  try {
    return onSnapshot(
      doc(db, ...COMPETITIONS_DOC_PATH),
      (snap) => {
        if (!snap.exists()) return;
        const items = (snap.data()?.items ?? []) as Competition[];
        void setJson(COMPETITIONS_KEY, items);
        onChange(reviveCompetitions(items));
      },
      (error) => {
        console.warn('[competition-sync] subscribe competitions failed', error);
      }
    );
  } catch (error) {
    console.warn('[competition-sync] subscribe competitions failed', error);
    return null;
  }
}

export function mergeCompetitionsById(
  seed: Competition[],
  stored: Competition[]
): Competition[] {
  if (!stored.length) return seed;
  const map = new Map<string, Competition>();
  for (const item of seed) map.set(item.id, item);
  for (const item of stored) map.set(item.id, item);
  return Array.from(map.values());
}
