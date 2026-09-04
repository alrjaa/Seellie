import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import type {
  AdminAppreciationReceipt,
  AdminCommerceUserDetail,
  AdminCommerceUserSummary,
} from './types';

function sb() {
  const client = getSupabase();
  if (!client) throw new Error('supabase_unavailable');
  return client;
}

export async function fetchAdminCommerceUsers(input?: {
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminCommerceUserSummary[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await sb().rpc('admin_list_commerce_users', {
    p_query: input?.query?.trim() || null,
    p_limit: input?.limit ?? 50,
    p_offset: input?.offset ?? 0,
  });
  if (error) throw error;
  const row = data as { users?: AdminCommerceUserSummary[] };
  return Array.isArray(row?.users) ? row.users : [];
}

export async function fetchAdminCommerceUserDetail(
  userId: string
): Promise<AdminCommerceUserDetail | null> {
  if (!isSupabaseConfigured() || !userId) return null;
  const { data, error } = await sb().rpc('admin_get_commerce_user_detail', {
    p_user_id: userId,
  });
  if (error) throw error;
  return data as AdminCommerceUserDetail;
}

export async function fetchAdminAppreciationReceipts(input?: {
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminAppreciationReceipt[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await sb().rpc('admin_list_appreciation_receipts', {
    p_query: input?.query?.trim() || null,
    p_limit: input?.limit ?? 100,
    p_offset: input?.offset ?? 0,
  });
  if (error) {
    // RPC may not be applied yet — caller can fall back to gift blob.
    if (
      /function|does not exist|schema cache|404|PGRST/i.test(
        error.message || ''
      )
    ) {
      return [];
    }
    throw error;
  }
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({
    ...(row as AdminAppreciationReceipt),
    source: 'digital' as const,
  }));
}
