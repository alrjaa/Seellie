import { getSupabase, isSupabaseConfigured } from '@/services/supabase';

/**
 * يسجّل حدثاً أمنياً خفيفاً في السحابة (بدون كلمات مرور/tokens).
 * يفشل بصمت إن لم تُنفَّذ SECURITY-PHASE4 بعد.
 */
export async function logSecurityEvent(
  action: string,
  meta: Record<string, unknown> = {}
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabase();
  if (!sb) return;
  const safe = { ...meta };
  delete safe.password;
  delete safe.token;
  delete safe.access_token;
  delete safe.refresh_token;
  delete safe.anonKey;
  try {
    await sb.rpc('log_security_event', {
      p_action: action.slice(0, 80),
      p_meta: safe,
    });
  } catch {
    // ignore — monitoring must never break UX
  }
}
