import type { User } from '@/data/initial-data';
import { isUuid } from '@/services/supabase-messages';
import { allowLocalDemoAuth } from '@/utils/demo-auth';

/** Cloud / non-demo accounts never persist a verifiable local password hash. */
export function sanitizeUserForPersistence(user: User): User {
  const cloud =
    isUuid(user.id) ||
    user.passwordHash === 'supabase' ||
    !allowLocalDemoAuth();
  if (cloud) {
    return { ...user, passwordHash: 'supabase' };
  }
  return user;
}

/** Seed users in published builds must not carry crackable/demo hashes. */
export function sanitizeSeedUserForRuntime(user: User): User {
  if (allowLocalDemoAuth()) return user;
  return { ...user, passwordHash: 'supabase' };
}
