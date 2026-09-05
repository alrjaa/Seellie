import type { User } from '@/data/initial-data';
import type { UserRole } from '@/types';
import { ensureSocialLists } from '@/utils/social-stats';
import { normalizeUserRoles } from '@/utils/roles';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import { isUuid } from '@/services/supabase-messages';
import {
  applyContentPayload,
  type UserContentPayload,
} from '@/services/supabase-user-content';
import { mergeUsersPreferCloud } from '@/services/merge-users';
import { stripAnalystAccessCode } from '@/services/analyst-strip';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export { mergeUsersPreferCloud } from '@/services/merge-users';
export { stripAnalystAccessCode } from '@/services/analyst-strip';

export type ProfileRow = {
  id: string;
  email?: string | null;
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
  mobile?: string | null;
  content?: UserContentPayload | null;
};

function defaultPermissions(role: UserRole): User['permissions'] {
  return {
    canComment: true,
    // نشر الفريد للمحللين المعتمدين فقط — لا يُفعَّل افتراضياً لكل متابع
    canCreateContent: false,
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
    email: row.email || '',
    name: row.name,
    handle: row.handle || `@${(row.email || 'user').split('@')[0] || 'user'}`,
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
  return ensureSocialLists(
    normalizeUserRoles(applyContentPayload(draft, row.content))
  );
}

function parseProfileRow(row: ProfileRow): User | null {
  try {
    if (!row?.id) return null;
    return profileToUser(row);
  } catch (error) {
    console.warn('[supabase] skip corrupt profile', row?.id, error);
    return null;
  }
}

/** Owner/admin table columns — includes email/mobile. */
export const PROFILE_OWNER_COLUMNS =
  'id,email,name,handle,visible_id,role,roles,active_role,avatar,bio,city,region,country,status,mobile,content';

/** Catalog view — no email/mobile. */
export const PROFILE_CATALOG_COLUMNS =
  'id,name,handle,visible_id,role,roles,active_role,avatar,bio,city,region,country,status,content';

/** @deprecated F13-P2-02 — use PROFILE_CATALOG_COLUMNS / PROFILE_OWNER_COLUMNS */
export const PROFILE_PUBLIC_COLUMNS = PROFILE_OWNER_COLUMNS;

export async function fetchProfile(userId: string): Promise<User | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('profiles')
    .select(PROFILE_OWNER_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (!error && data) return profileToUser(data as ProfileRow);
  const { data: catalog, error: catalogError } = await sb
    .from('profiles_catalog')
    .select(PROFILE_CATALOG_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (catalogError || !catalog) return null;
  return profileToUser(catalog as ProfileRow);
}

export type FetchProfilesResult = {
  users: User[];
  /** false = network/RLS/query failure — must NOT be treated as “empty catalog”. */
  ok: boolean;
  error?: string;
};

/**
 * كل حسابات profiles للوحة/الخلاصة — content يُنقّى من accessCode عند التحويل.
 * FIX-02: distinguishes failure vs empty so merges never wipe on error.
 */
export async function fetchAllProfilesResult(): Promise<FetchProfilesResult> {
  if (!isSupabaseConfigured()) {
    return { users: [], ok: false, error: 'not_configured' };
  }
  const sb = getSupabase();
  if (!sb) return { users: [], ok: false, error: 'no_client' };
  const { data, error } = await sb
    .from('profiles_catalog')
    .select(PROFILE_CATALOG_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    console.warn('[supabase] fetchAllProfilesResult', error.message);
    return { users: [], ok: false, error: error.message };
  }
  const catalog = ((data || []) as ProfileRow[])
    .map(parseProfileRow)
    .filter((u): u is User => !!u);
  const { data: privileged } = await sb
    .from('profiles')
    .select(PROFILE_OWNER_COLUMNS)
    .limit(500);
  if (privileged?.length) {
    return {
      users: mergeUsersPreferCloud(
        catalog,
        (privileged as ProfileRow[])
          .map(parseProfileRow)
          .filter((u): u is User => !!u)
      ),
      ok: true,
    };
  }
  return { users: catalog, ok: true };
}

/**
 * بث فوري لتحديثات profiles (تحليلات/منشورات/وسائط داخل content).
 * يتطلب إضافة الجدول إلى supabase_realtime (انظر PROFILES-REALTIME.sql).
 */
export function subscribeProfiles(
  onChange: (user: User) => void
): (() => void) | null {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const channel = sb
    .channel('profiles-content-live')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'profiles',
      },
      (payload) => {
        const row = payload.new as ProfileRow;
        if (row?.id) {
          const user = parseProfileRow(row);
          if (user) onChange(user);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
      },
      (payload) => {
        const row = payload.new as ProfileRow;
        if (row?.id) {
          const user = parseProfileRow(row);
          if (user) onChange(user);
        }
      }
    )
    .subscribe();
  return () => {
    void sb.removeChannel(channel);
  };
}

/**
 * دمج القائمة المحلية مع السحابة — moved to merge-users.ts (FIX-02 pure module).
 * Re-exported above for backward compatibility.
 */

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
    .select(PROFILE_OWNER_COLUMNS)
    .single();
  if (error || !data) {
    console.warn('[supabase] upsertProfile', error?.message);
    return null;
  }
  return profileToUser(data as ProfileRow);
}

/** تحديث أدوار الحساب السحابي (منظم / مواهب) في profiles */
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

/** حذف الحساب الحالي نهائياً (يتطلب DELETE-OWN-ACCOUNT.sql) */
export async function deleteOwnAccountCloud(): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'not_configured' };
  }
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) {
    return { ok: false, error: 'no_session' };
  }
  const { data, error } = await sb.rpc('delete_own_account');
  if (error) {
    console.warn('[supabase] delete_own_account', error.message);
    const msg = error.message || '';
    if (/cannot_delete_admin/i.test(msg)) {
      return { ok: false, error: 'cannot_delete_admin' };
    }
    const missing =
      /could not find|schema cache|function .* does not exist/i.test(msg);
    return {
      ok: false,
      error: missing
        ? 'missing_rpc: نفّذ DELETE-OWN-ACCOUNT.sql مرة واحدة في SQL Editor'
        : msg,
    };
  }
  if (data && typeof data === 'object' && (data as { ok?: boolean }).ok === false) {
    return {
      ok: false,
      error: String((data as { error?: string }).error || 'delete_failed'),
    };
  }
  return { ok: true };
}

/** حذف نهائي من Auth + profiles (يتطلب ADMIN-PURGE-USER.sql) */
export async function adminPurgeUserCloud(
  userId: string
): Promise<{ ok: boolean; error?: string; email?: string }> {
  if (!isSupabaseConfigured() || !isUuid(userId)) {
    return { ok: false, error: 'not_cloud_user' };
  }
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) {
    return { ok: false, error: 'no_session' };
  }
  const { data, error } = await sb.rpc('admin_purge_user', { p_id: userId });
  if (error) {
    console.warn('[supabase] admin_purge_user', error.message);
    const missing =
      /could not find|schema cache|function .* does not exist/i.test(
        error.message
      );
    return {
      ok: false,
      error: missing
        ? 'missing_rpc: نفّذ ADMIN-PURGE-USER.sql مرة واحدة في SQL Editor'
        : error.message,
    };
  }
  if (data && typeof data === 'object' && (data as { ok?: boolean }).ok === false) {
    return {
      ok: false,
      error: String((data as { error?: string }).error || 'purge_failed'),
    };
  }
  return {
    ok: true,
    email:
      data && typeof data === 'object'
        ? String((data as { email?: string }).email || '')
        : undefined,
  };
}

/** حذف نهائي بالبريد — لتحرير إيميل عالق في Authentication */
export async function adminPurgeUserByEmailCloud(
  email: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'not_configured' };
  }
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) {
    return { ok: false, error: 'no_session' };
  }
  const { data, error } = await sb.rpc('admin_purge_user_by_email', {
    p_email: email.trim().toLowerCase(),
  });
  if (error) {
    console.warn('[supabase] admin_purge_user_by_email', error.message);
    const missing =
      /could not find|schema cache|function .* does not exist/i.test(
        error.message
      );
    return {
      ok: false,
      error: missing
        ? 'missing_rpc: نفّذ ADMIN-PURGE-USER.sql مرة واحدة في SQL Editor'
        : error.message,
    };
  }
  if (data && typeof data === 'object' && (data as { ok?: boolean }).ok === false) {
    return {
      ok: false,
      error: String((data as { error?: string }).error || 'purge_failed'),
    };
  }
  return { ok: true };
}

export async function findProfileByEmail(
  email: string
): Promise<ProfileRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const normalized = email.toLowerCase();
  const { data: own, error } = await sb
    .from('profiles')
    .select(PROFILE_OWNER_COLUMNS)
    .eq('email', normalized)
    .maybeSingle();
  if (!error && own) return own as ProfileRow;
  const { data, error: rpcError } = await sb.rpc('find_profile_by_email', {
    p_email: normalized,
  });
  if (rpcError || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return row as ProfileRow;
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
    void import('@/services/security-events').then(({ logSecurityEvent }) =>
      logSecurityEvent('login_failed', {
        reason: error?.message || 'auth_failed',
      })
    );
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
  if (
    profile &&
    (profile.status === 'blocked' || profile.status === 'suspended')
  ) {
    await sb.auth.signOut();
    void import('@/services/security-events').then(({ logSecurityEvent }) =>
      logSecurityEvent('login_blocked_account', { status: profile!.status })
    );
    return { user: null, error: 'account_not_active' };
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

/**
 * مسار موثوق: رمز من رسالة الاستعادة (بدون الضغط على الرابط الذي تستهلكه ماسحات البريد).
 */
export async function supabaseVerifyRecoveryOtp(
  email: string,
  token: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'not_configured' };
  }
  const cleaned = token.replace(/\s+/g, '');
  if (!cleaned) return { ok: false, error: 'missing_token' };
  const sb = getSupabase()!;
  const { error } = await sb.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: cleaned,
    type: 'recovery',
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** تحقق من الرمز ثم عيّن كلمة المرور في خطوة واحدة */
export async function supabaseResetPasswordWithOtp(input: {
  email: string;
  token: string;
  password: string;
}): Promise<{ ok: boolean; error?: string }> {
  const verified = await supabaseVerifyRecoveryOtp(input.email, input.token);
  if (!verified.ok) return verified;
  return supabaseUpdatePassword(input.password);
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
  const profile = await fetchProfile(data.session.user.id);
  if (
    profile &&
    (profile.status === 'blocked' || profile.status === 'suspended')
  ) {
    await sb.auth.signOut();
    return null;
  }
  return profile;
}
