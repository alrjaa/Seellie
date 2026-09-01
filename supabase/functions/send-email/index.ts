/**
 * send-email — رسائل معاملات Seellie (رمز محلل فقط)
 *
 * FIX-08 (F08-S04): لا يُسمح بترحيل بريد عشوائي لأي مستخدم مصادق.
 * فقط المشرف + type=analyst_access_code + حقول إلزامية + حد معدل.
 *
 * F09-P1-06: body.code يجب أن يطابق analyst_access_codes للمستلم (profiles.email = to).
 * لا يُرسل البريد عند mismatch. Authorization قبل فحص RESEND.
 *
 * Secrets (Dashboard → Edge Functions → Secrets):
 *   RESEND_API_KEY
 *   EMAIL_FROM (اختياري)
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type Body = {
  type?: string;
  to?: string;
  code?: string;
  name?: string;
  /** Optional: must match profile.id for `to` when provided */
  userId?: string;
};

const rateBucket = new Map<string, { count: number; resetAt: number }>();

function checkRate(userId: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cur = rateBucket.get(userId);
  if (!cur || now > cur.resetAt) {
    rateBucket.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (cur.count >= limit) return false;
  cur.count += 1;
  return true;
}

/** Avoid leaking timing on code compare (best-effort in JS). */
function codesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const anon = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const from =
      Deno.env.get('EMAIL_FROM') || 'Seellie <onboarding@resend.dev>';

    const authHeader = req.headers.get('Authorization') || '';
    const sb = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await sb.auth.getUser();
    if (userError || !userData.user) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }

    const { data: isAdmin, error: adminErr } = await sb.rpc('is_app_superadmin');
    if (adminErr || isAdmin !== true) {
      return json({ ok: false, error: 'forbidden' }, 403);
    }

    if (!checkRate(userData.user.id, 10, 60_000)) {
      return json({ ok: false, error: 'rate_limited' }, 429);
    }

    const body = (await req.json()) as Body;

    // F08-S04: allowlist only — no arbitrary subject/text relay
    if (body.type !== 'analyst_access_code') {
      return json({ ok: false, error: 'type_not_allowed' }, 403);
    }

    const to = (body.to || '').trim().toLowerCase();
    if (!to || !to.includes('@')) {
      return json({ ok: false, error: 'invalid_to' }, 400);
    }

    const code = (body.code || '').trim();
    if (!code) return json({ ok: false, error: 'missing_code' }, 400);

    // Recipient must be a real profile email (context binding)
    const { data: profile, error: profileErr } = await sb
      .from('profiles')
      .select('id, email, name')
      .eq('email', to)
      .maybeSingle();
    if (profileErr || !profile?.id) {
      return json({ ok: false, error: 'recipient_not_found' }, 400);
    }

    // Optional client userId must match resolved profile (no trust of bare claims)
    const claimedUserId = (body.userId || '').trim();
    if (claimedUserId && claimedUserId !== profile.id) {
      return json({ ok: false, error: 'analyst_code_recipient_mismatch' }, 400);
    }

    // F09-P1-06: code must match analyst_access_codes for THIS recipient only.
    // Load via superadmin RPC (table RLS is own-row only). Generic error on any fail.
    const { data: storedCode, error: codeErr } = await sb.rpc(
      'admin_get_analyst_access_code',
      { p_id: profile.id }
    );
    const expected =
      typeof storedCode === 'string' ? storedCode.trim() : '';
    if (codeErr || !expected || !codesEqual(expected, code)) {
      return json({ ok: false, error: 'analyst_code_recipient_mismatch' }, 400);
    }

    // Operational: Resend after authorization (F09-P1-06-F)
    const resendKey = Deno.env.get('RESEND_API_KEY') || '';
    if (!resendKey) {
      return json({ ok: false, error: 'RESEND_API_KEY_missing' }, 503);
    }

    const name = (body.name || profile.name || '').trim();
    const subject = 'رمز وصول المحلل — Seellie';
    const text = [
      name ? `مرحباً ${name},` : 'مرحباً,',
      '',
      'تمت الموافقة على طلبك للانضمام كمحلل في مساحة الفريد.',
      `رمز الوصول: ${code}`,
      '',
      'افتح صفحة الفريد في Seellie وأدخل الرمز لتفعيل النشر.',
      'لا تشارك الرمز مع أحد.',
    ].join('\n');
    const html = `
        <div dir="rtl" style="font-family:sans-serif;line-height:1.6">
          <h2>رمز وصول المحلل — Seellie</h2>
          <p>${name ? `مرحباً ${name},` : 'مرحباً,'}</p>
          <p>تمت الموافقة على طلبك للانضمام كمحلل في مساحة الفريد.</p>
          <p style="font-size:22px;letter-spacing:2px"><strong>${escapeHtml(
            code
          )}</strong></p>
          <p>افتح صفحة الفريد وأدخل الرمز لتفعيل النشر. لا تشارك الرمز مع أحد.</p>
        </div>
      `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[send-email] resend', res.status, payload);
      return json(
        {
          ok: false,
          error:
            (payload as { message?: string })?.message ||
            `resend_${res.status}`,
        },
        502
      );
    }

    return json({ ok: true, id: (payload as { id?: string }).id });
  } catch (err) {
    console.error('[send-email]', err);
    return json({ ok: false, error: 'internal' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
