/**
 * Analyst access codes — server-side only (FIX-01).
 * Never read accessCode from profiles.content for authorization.
 */
import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import { isUuid } from '@/services/supabase-messages';

export { stripAnalystAccessCode } from '@/services/analyst-strip';

export async function setAnalystAccessCodeCloud(
  userId: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured() || !isUuid(userId)) {
    return { ok: false, error: 'not_cloud_user' };
  }
  const trimmed = code.trim();
  if (trimmed.length < 6) return { ok: false, error: 'invalid_code' };
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };
  const { error } = await sb.rpc('set_analyst_access_code', {
    p_id: userId,
    p_code: trimmed,
  });
  if (error) {
    console.warn('[analyst-secrets] set', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function fetchOwnAnalystAccessCode(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('get_own_analyst_access_code');
  if (error) {
    console.warn('[analyst-secrets] get own', error.message);
    return null;
  }
  const code = typeof data === 'string' ? data.trim() : '';
  return code || null;
}

export async function adminFetchAnalystAccessCode(
  userId: string
): Promise<string | null> {
  if (!isSupabaseConfigured() || !isUuid(userId)) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('admin_get_analyst_access_code', {
    p_id: userId,
  });
  if (error) {
    console.warn('[analyst-secrets] admin get', error.message);
    return null;
  }
  const code = typeof data === 'string' ? data.trim() : '';
  return code || null;
}

export async function verifyAndActivateAnalystCloud(
  code: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'not_configured' };
  }
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };
  const { data, error } = await sb.rpc('verify_and_activate_analyst', {
    p_code: code.trim(),
  });
  if (error) {
    console.warn('[analyst-secrets] verify', error.message);
    return { ok: false, error: error.message };
  }
  const payload = data as { ok?: boolean; error?: string } | null;
  if (!payload?.ok) {
    return { ok: false, error: payload?.error || 'verify_failed' };
  }
  return { ok: true };
}
