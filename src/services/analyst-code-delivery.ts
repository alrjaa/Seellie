import { getSupabase, isSupabaseConfigured } from '@/services/supabase';

/**
 * محاولة إرسال رمز المحلل بريداً عبر Edge Function `send-email`.
 * إن لم تُنشر الدالة أو لم يُضبط RESEND_API_KEY تُرجع emailed: false
 * دون كسر مسار الموافقة (التوصيل يتم عبر الرسائل داخل التطبيق + صفحة الفريد).
 *
 * F09-P1-07: لا تستدعِ send-email إلا من جلسة superadmin.
 * applicant / ordinary user → لا invoke (تجنب 403 وسبام)، الموافقة تبقى ناجحة.
 * F09-P1-06 binding يبقى داخل Edge عند استدعاء المشرف.
 */
export async function trySendAnalystCodeEmail(input: {
  to: string;
  code: string;
  name?: string;
  /** Optional profile id — must match email owner (F09-P1-06) */
  userId?: string;
}): Promise<{ emailed: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { emailed: false, error: 'not_configured' };
  }
  const sb = getSupabase();
  if (!sb) return { emailed: false, error: 'no_client' };
  const to = input.to.trim().toLowerCase();
  const code = input.code.trim();
  if (!to || !code) return { emailed: false, error: 'invalid_payload' };

  try {
    // F09-P1-07: gate before Edge — never open send-email to applicants
    const { data: isAdmin, error: adminErr } = await sb.rpc(
      'is_app_superadmin'
    );
    if (adminErr || isAdmin !== true) {
      return { emailed: false, error: 'admin_required' };
    }

    const { data, error } = await sb.functions.invoke('send-email', {
      body: {
        type: 'analyst_access_code',
        to,
        code,
        name: input.name || '',
        ...(input.userId ? { userId: input.userId } : {}),
      },
    });
    if (error) {
      console.warn('[analyst-email]', error.message);
      return { emailed: false, error: error.message };
    }
    const payload = data as { ok?: boolean; error?: string } | null;
    if (payload && payload.ok === false) {
      return { emailed: false, error: payload.error || 'send_failed' };
    }
    return { emailed: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[analyst-email]', msg);
    return { emailed: false, error: msg };
  }
}
