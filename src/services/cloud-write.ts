import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import { isUuid } from '@/services/supabase-messages';
import { uploadAppMedia } from '@/services/supabase-storage';

export type CloudWriteError =
  | 'not_configured'
  | 'no_client'
  | 'no_session'
  | 'not_cloud_user'
  | 'upload_failed'
  | string;

export type CloudSession = {
  userId: string;
  accessToken: string;
};

/** جلسة سحابية صالحة — مطلوبة لأي كتابة محتوى متعددة الأجهزة */
export async function requireCloudSession(
  localUserId?: string | null
): Promise<{ session: CloudSession | null; error?: CloudWriteError }> {
  if (!isSupabaseConfigured()) {
    return { session: null, error: 'not_configured' };
  }
  const sb = getSupabase();
  if (!sb) return { session: null, error: 'no_client' };
  const { data } = await sb.auth.getSession();
  const uid = data.session?.user?.id;
  if (!uid || !data.session?.access_token) {
    return { session: null, error: 'no_session' };
  }
  if (localUserId && isUuid(localUserId) && localUserId !== uid) {
    return { session: null, error: 'not_cloud_user' };
  }
  if (localUserId && !isUuid(localUserId)) {
    return { session: null, error: 'not_cloud_user' };
  }
  return {
    session: { userId: uid, accessToken: data.session.access_token },
  };
}

/**
 * إن كان الرابط محلياً (file:// / blob) ارفعه للسحابة؛ وإلا أعدّه كما هو.
 * عند جلسة سحابية: فشل الرفع = خطأ (لا ننشر file:// بين الأجهزة).
 */
export async function resolvePublicMediaUrl(input: {
  uri: string;
  kind: 'photo' | 'video';
  folder: string;
  userId: string;
  requireCloud: boolean;
}): Promise<{ url: string | null; error?: CloudWriteError }> {
  const trimmed = input.uri.trim();
  if (!trimmed) return { url: null, error: 'empty_url' };
  if (/^https?:\/\//i.test(trimmed)) return { url: trimmed };

  if (!input.requireCloud) {
    return { url: trimmed };
  }

  const uploaded = await uploadAppMedia(
    trimmed,
    input.kind,
    input.userId,
    input.folder
  );
  if (!uploaded) return { url: null, error: 'upload_failed' };
  return { url: uploaded };
}

export function cloudWriteErrorMessage(error?: CloudWriteError): string {
  switch (error) {
    case 'not_configured':
      return 'السحابة غير مهيأة';
    case 'no_session':
      return 'سجّل الدخول بحساب سحابي أولاً';
    case 'not_cloud_user':
      return 'هذا الحساب محلي تجريبي — استخدم Sign up للمزامنة بين الأجهزة';
    case 'upload_failed':
      return 'تعذّر رفع الملف للسحابة';
    case 'no_client':
      return 'تعذّر الاتصال بالسحابة';
    default:
      return error || 'تعذّر الحفظ السحابي';
  }
}
