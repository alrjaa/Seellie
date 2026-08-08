import type { User } from '@/data/initial-data';
import type { UserRole } from '@/types';
import { ensureSocialLists } from '@/utils/social-stats';
import { normalizeUserRoles } from '@/utils/roles';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type ProfileRow = {
  id: string;
  email: string;
  name: string;
  handle: string | null;
  visible_id: string | null;
  role: string;
  roles: string[] | null;
  active_role: string | null;
  avatar: string | null;
  bio: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  status: string | null;
  mobile: string | null;
};

function defaultPermissions(role: UserRole): User['permissions'] {
  return {
    canComment: true,
    canUseVoice: true,
    canNominateToPersonality: role === 'freelancer' || role === 'follower',
    canCreateContent: role === 'freelancer' || role === 'follower',
  };
}

export function profileToUser(row: ProfileRow): User {
  const rolesRaw = (row.roles?.length ? row.roles : [row.role || 'follower']) as string[];
  const isAdmin =
    row.role === 'superadmin' ||
    row.active_role === 'superadmin' ||
    rolesRaw.includes('superadmin');
  const role = (isAdmin ? 'superadmin' : row.role || 'follower') as UserRole;
  const roles = (
    isAdmin ? ['superadmin'] : rolesRaw.length ? rolesRaw : [role]
  ) as UserRole[];
  const draft: User = {
    id: row.id,
    email: row.email,
    name: row.name,
    handle: row.handle || `@${row.email.split('@')[0] || 'user'}`,
    visibleId: row.visible_id || `FLW-${row.id.slice(0, 4).toUpperCase()}`,
    role,
    roles,
    activeRole: (isAdmin
      ? 'superadmin'
      : (row.active_role as UserRole) || role) as UserRole,
    avatar: row.avatar || undefined,
    bio: row.bio || undefined,
    city: row.city || undefined,
    region: row.region || undefined,
    country: row.country || undefined,
    status: (row.status as User['status']) || 'active',
    mobile: row.mobile || undefined,
    passwordHash: 'supabase',
    permissions: defaultPermissions(role),
    posts: [],
    media: { photos: [], videos: [] },
    personalityPhotos: [],
    analysisContent: [],
    comments: [],
  };
  return ensureSocialLists(normalizeUserRoles(draft));
}

export async function fetchProfile(userId: string): Promise<User | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return profileToUser(data as ProfileRow);
}

/** كل حسابات profiles للوحة إدارة المستخدمين */
export async function fetchAllProfiles(): Promise<User[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    console.warn('[supabase] fetchAllProfiles', error.message);
    return [];
  }
  return ((data || []) as ProfileRow[]).map(profileToUser);
}

/**
 * دمج القائمة المحلية مع السحابة:
 * نفس الإيميل → الحساب السحابي (UUID) يفوز ويزيل المكرر المحلي.
 */
export function mergeUsersPreferCloud(
  localUsers: User[],
  cloudUsers: User[]
): User[] {
  const byEmail = new Map<string, User>();
  for (const u of localUsers) {
    const key = (u.email || '').trim().toLowerCase();
    if (!key) continue;
    byEmail.set(key, u);
  }
  for (const u of cloudUsers) {
    const key = (u.email || '').trim().toLowerCase();
    if (!key) continue;
    byEmail.set(key, u);
  }
  // إن وُجد مشرف سحابي، أخفِ حساب المشرف التجريبي المحلي لتجنب التكرار البصري
  const hasCloudAdmin = cloudUsers.some((u) => u.role === 'superadmin');
  const merged = Array.from(byEmail.values()).filter((u) => {
    if (!hasCloudAdmin) return true;
    if (u.id === 'superadmin-1') return false;
    if (
      u.role === 'superadmin' &&
      u.passwordHash !== 'supabase' &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        u.id
      )
    ) {
      return false;
    }
    return true;
  });
  return merged;
}

export async function upsertProfile(input: {
  id: string;
  email: string;
  name: string;
  handle?: string;
  visibleId?: string;
  role?: UserRole;
}): Promise<User | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const role = input.role || 'follower';
  const payload = {
    id: input.id,
    email: input.email,
    name: input.name,
    handle: input.handle || null,
    visible_id: input.visibleId || null,
    role,
    roles: [role],
    active_role: role,
    status: 'active',
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();
  if (error || !data) {
    console.warn('[supabase] upsertProfile', error?.message);
    return null;
  }
  return profileToUser(data as ProfileRow);
}

/** تحديث أدوار الحساب السحابي (منظم / لاعب حر) في profiles */
export async function updateProfileRolesCloud(input: {
  id: string;
  email: string;
  name: string;
  handle?: string;
  visibleId?: string;
  role: UserRole;
  roles: UserRole[];
  activeRole: UserRole;
}): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from('profiles').upsert(
    {
      id: input.id,
      email: input.email.trim().toLowerCase(),
      name: input.name,
      handle: input.handle || null,
      visible_id: input.visibleId || null,
      role: input.role,
      roles: input.roles,
      active_role: input.activeRole,
      status: 'active',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) {
    console.warn('[supabase] updateProfileRolesCloud', error.message);
    return false;
  }
  return true;
}

/**
 * تحديث ملف مستخدم من لوحة المشرف (حالة/أدوار).
 * يتطلب سياسة profiles_update_admin + SECURITY-HARDENING.sql
 */
export async function updateProfileAdminCloud(input: {
  id: string;
  email?: string;
  name?: string;
  handle?: string;
  visibleId?: string;
  role?: UserRole;
  roles?: UserRole[];
  activeRole?: UserRole;
  status?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'not_configured' };
  }
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) {
    return { ok: false, error: 'no_session' };
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.email != null) patch.email = input.email.trim().toLowerCase();
  if (input.name != null) patch.name = input.name;
  if (input.handle != null) patch.handle = input.handle || null;
  if (input.visibleId != null) patch.visible_id = input.visibleId || null;
  if (input.role != null) patch.role = input.role;
  if (input.roles != null) patch.roles = input.roles;
  if (input.activeRole != null) patch.active_role = input.activeRole;
  if (input.status != null) patch.status = input.status;

  const { error } = await sb.from('profiles').update(patch).eq('id', input.id);
  if (error) {
    console.warn('[supabase] updateProfileAdminCloud', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function findProfileByEmail(
  email: string
): Promise<ProfileRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  if (error || !data) return null;
  return data as ProfileRow;
}

export async function supabaseSignIn(
  email: string,
  password: string
): Promise<{ user: User | null; error?: string }> {
  if (!isSupabaseConfigured()) return { user: null, error: 'not_configured' };
  const sb = getSupabase()!;
  const { data, error } = await sb.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data.user) {
    return { user: null, error: error?.message || 'auth_failed' };
  }
  let profile = await fetchProfile(data.user.id);
  if (!profile) {
    profile = await upsertProfile({
      id: data.user.id,
      email: data.user.email || email,
      name:
        (data.user.user_metadata?.name as string) ||
        email.split('@')[0] ||
        'User',
      handle: data.user.user_metadata?.handle as string | undefined,
    });
  }
  return { user: profile };
}

export async function supabaseSignUp(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ user: User | null; error?: string }> {
  if (!isSupabaseConfigured()) return { user: null, error: 'not_configured' };
  const sb = getSupabase()!;
  const email = input.email.trim().toLowerCase();
  const { data, error } = await sb.auth.signUp({
    email,
    password: input.password,
    options: {
      data: { name: input.name.trim() },
    },
  });
  if (error || !data.user) {
    return { user: null, error: error?.message || 'signup_failed' };
  }
  const handleBase = email.split('@')[0] || 'user';
  const profile = await upsertProfile({
    id: data.user.id,
    email,
    name: input.name.trim(),
    handle: `@${handleBase}`.slice(0, 24),
    visibleId: `FLW-${Math.floor(1000 + Math.random() * 9000)}`,
    role: 'follower',
  });
  return { user: profile, error: profile ? undefined : 'profile_failed' };
}

export async function supabaseSignOut(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}

/** رابط ثابت لبريد الاستعادة على الويب المنشور */
export const WEB_PASSWORD_RESET_URL =
  'https://www.seellie.com/reset-password';

/**
 * رابط بعد التحقق من البريد.
 * - ويب منشور → https://www.seellie.com/reset-password
 * - Expo Go → exp://IP:PORT/--/reset-password
 * - تطبيق مستقل → seellie://reset-password
 */
export function passwordResetRedirectUrl(): string {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin.replace(/\/$/, '');
      if (
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        return WEB_PASSWORD_RESET_URL;
      }
      // vercel.app أو seellie.com / www — نفس المسار
      return `${origin}/reset-password`;
    }
    return WEB_PASSWORD_RESET_URL;
  }

  const url = Linking.createURL('reset-password');
  if (
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.startsWith('http:')
  ) {
    if (Constants.appOwnership === 'expo' && url.startsWith('exp://')) {
      return url;
    }
    return 'seellie://reset-password';
  }
  return url;
}

export async function supabaseRequestPasswordReset(
  email: string
): Promise<{ ok: boolean; error?: string; redirectTo?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'not_configured' };
  }
  const sb = getSupabase()!;
  // على الويب المنشور ثبّت الوجهة لتطابق Redirect URLs في Supabase
  const redirectTo =
    Platform.OS === 'web'
      ? WEB_PASSWORD_RESET_URL
      : passwordResetRedirectUrl();
  const { error } = await sb.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo }
  );
  if (error) {
    return { ok: false, error: error.message, redirectTo };
  }
  return { ok: true, redirectTo };
}

export async function supabaseUpdatePassword(
  password: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'not_configured' };
  }
  if (password.trim().length < 6) {
    return { ok: false, error: 'password_too_short' };
  }
  const sb = getSupabase()!;
  const { error } = await sb.auth.updateUser({ password: password.trim() });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function collectAuthParams(url: string): URLSearchParams {
  const params = new URLSearchParams();
  try {
    const hash = url.includes('#') ? url.split('#')[1] || '' : '';
    const query = url.includes('?')
      ? url.split('?')[1]?.split('#')[0] || ''
      : '';
    for (const part of [query, hash]) {
      if (!part) continue;
      const sp = new URLSearchParams(part);
      sp.forEach((value, key) => {
        if (value && !params.has(key)) params.set(key, value);
      });
    }
  } catch {
    // ignore
  }
  return params;
}

/** استخراج جلسة الاستعادة من رابط البريد */
export async function supabaseConsumeAuthUrl(
  url: string
): Promise<{ ok: boolean; recovery?: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'not_configured' };

  try {
    const params = collectAuthParams(url);

    // PKCE: ?code=
    const code = params.get('code');
    if (code) {
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (error) {
        // قد تكون الجلسة اكتملت عبر detectSessionInUrl
        const { data } = await sb.auth.getSession();
        if (data.session) return { ok: true, recovery: true };
        return { ok: false, error: error.message };
      }
      return { ok: true, recovery: true };
    }

    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    const type = params.get('type');
    if (access_token && refresh_token) {
      const { error } = await sb.auth.setSession({
        access_token,
        refresh_token,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, recovery: type === 'recovery' || true };
    }

    // رابط verify قد يمرّر token_hash أو token
    const token_hash = params.get('token_hash') || params.get('token');
    const otpType = (params.get('type') || 'recovery') as
      | 'recovery'
      | 'signup'
      | 'invite'
      | 'magiclink'
      | 'email';
    if (token_hash) {
      const { error } = await sb.auth.verifyOtp({
        token_hash,
        type: otpType === 'recovery' ? 'recovery' : 'email',
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, recovery: true };
    }

    // بعض الرسائل تضع error في الرابط
    const err = params.get('error_description') || params.get('error');
    if (err) return { ok: false, error: err };

    return { ok: false, error: 'no_tokens' };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'parse_failed',
    };
  }
}

export async function restoreSupabaseSession(): Promise<User | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  if (!data.session?.user) return null;
  return fetchProfile(data.session.user.id);
}
