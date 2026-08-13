/**
 * FIX-01 — Logout isolation: clear user-scoped local data without wiping app prefs.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { removeJson, getJson, setJson } from '@/services/storage';
import { isUuid } from '@/services/supabase-messages';

/** AUTH + PRIVATE DATA + user caches — cleared on logout */
export const LOGOUT_CLEAR_KEYS = [
  'tajjd.secure.currentUser',
  'seellie.shareCards',
  'seellie.messages',
  'seellie.notifications.v1',
] as const;

/** PUBLIC / PREFERENCES — keep across sessions */
export const LOGOUT_KEEP_KEYS = [
  'seellie.appLogo.v3',
  'seellie.appName',
  'seellie.supportLevels.v1',
  'seellie.fabIcons.v1',
  'seellie.referees',
  'seellie.competitions',
  'seellie.competitionRequests',
] as const;

const CREDENTIAL_OVERRIDES_KEY = 'seellie.userCredentialOverrides.v1';

type CredentialOverride = {
  email?: string;
  passwordHash?: string;
  name?: string;
};

/**
 * Clears session + private caches so User B cannot see User A local data.
 * Does not wipe language/theme/app branding preferences.
 */
export async function clearUserScopedLocalData(userId?: string | null): Promise<void> {
  await Promise.all(LOGOUT_CLEAR_KEYS.map((k) => removeJson(k)));

  if (userId) {
    try {
      await AsyncStorage.removeItem(`seellie.privateSpace.v1.${userId}`);
    } catch {
      /* ignore */
    }
  }

  // Drop cloud-user credential overrides (must never keep password material for Supabase accounts)
  try {
    const prev =
      (await getJson<Record<string, CredentialOverride>>(CREDENTIAL_OVERRIDES_KEY)) ||
      {};
    const next: Record<string, CredentialOverride> = {};
    for (const [id, row] of Object.entries(prev)) {
      if (isUuid(id)) continue;
      if (row?.passwordHash === 'supabase') continue;
      next[id] = row;
    }
    await setJson(CREDENTIAL_OVERRIDES_KEY, next);
  } catch {
    /* ignore */
  }
}

/**
 * One-shot migration: strip real passwordHash from AsyncStorage session for cloud users.
 */
export async function migrateLocalSessionCredentials(): Promise<void> {
  try {
    const stored = await getJson<{
      id?: string;
      passwordHash?: string;
      analyst?: { accessCode?: string } | null;
    }>('tajjd.secure.currentUser');
    if (!stored?.id) return;
    let dirty = false;
    const next = { ...stored };
    if (isUuid(stored.id) && stored.passwordHash && stored.passwordHash !== 'supabase') {
      next.passwordHash = 'supabase';
      dirty = true;
    }
    if (next.analyst && 'accessCode' in next.analyst) {
      const { accessCode: _drop, ...rest } = next.analyst as {
        accessCode?: string;
      } & Record<string, unknown>;
      next.analyst = rest as typeof next.analyst;
      dirty = true;
    }
    if (dirty) await setJson('tajjd.secure.currentUser', next);
  } catch {
    /* ignore */
  }
}
