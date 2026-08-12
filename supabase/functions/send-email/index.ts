/**
 * send-email — رسائل معاملات Seellie (رمز محلل، …)
 *
 * Secrets (Supabase Dashboard → Edge Functions → Secrets):
 *   RESEND_API_KEY   — مفتاح Resend
 *   EMAIL_FROM       — اختياري، مثل: Seellie <onboarding@resend.dev>
 *
 * Deploy:
 *   supabase functions deploy send-email --project-ref <ref>
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
  subject?: string;
  text?: string;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const anon = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const resendKey = Deno.env.get('RESEND_API_KEY') || '';
    const from =
      Deno.env.get('EMAIL_FROM') || 'Seellie <onboarding@resend.dev>';

    if (!resendKey) {
      return json(
        { ok: false, error: 'RESEND_API_KEY_missing' },
        503
      );
    }

    const authHeader = req.headers.get('Authorization') || '';
    const sb = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await sb.auth.getUser();
    if (userError || !userData.user) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }

    const body = (await req.json()) as Body;
    const to = (body.to || '').trim().toLowerCase();
    if (!to || !to.includes('@')) {
      return json({ ok: false, error: 'invalid_to' }, 400);
    }

    let subject = (body.subject || '').trim();
    let html = '';
    let text = (body.text || '').trim();

    if (body.type === 'analyst_access_code') {
      const code = (body.code || '').trim();
      if (!code) return json({ ok: false, error: 'missing_code' }, 400);
      const name = (body.name || '').trim();
      subject = 'رمز وصول المحلل — Seellie';
      text = [
        name ? `مرحباً ${name},` : 'مرحباً,',
        '',
        'تمت الموافقة على طلبك للانضمام كمحلل في مساحة الفريد.',
        `رمز الوصول: ${code}`,
        '',
        'افتح صفحة الفريد في Seellie وأدخل الرمز لتفعيل النشر.',
        'لا تشارك الرمز مع أحد.',
      ].join('\n');
      html = `
        <div dir="rtl" style="font-family:sans-serif;line-height:1.6">
          <h2>رمز وصول المحلل — Seellie</h2>
          <p>${name ? `مرحباً ${name},` : 'مرحباً,'}</p>
          <p>تمت الموافقة على طلبك للانضمام كمحلل في مساحة الفريد.</p>
          <p style="font-size:22px;letter-spacing:2px"><strong>${code}</strong></p>
          <p>افتح صفحة الفريد وأدخل الرمز لتفعيل النشر. لا تشارك الرمز مع أحد.</p>
        </div>
      `;
    } else if (!subject || !text) {
      return json({ ok: false, error: 'invalid_payload' }, 400);
    } else {
      html = `<pre style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(
        text
      )}</pre>`;
    }

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
