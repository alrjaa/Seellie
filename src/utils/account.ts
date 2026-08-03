import type { UserRole } from '@/types';

const ROLE_PREFIX: Record<UserRole, string> = {
  follower: 'FOL',
  freelancer: 'FLR',
  organizer: 'ORG',
  superadmin: 'ADM',
};

/** Normalize to a public @handle (lowercase, latin/digits/underscore). */
export function normalizeHandle(raw: string): string {
  const cleaned = (raw || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return `@${cleaned || 'user'}`;
}

export function registrationPrefix(role: UserRole): string {
  return ROLE_PREFIX[role];
}

/** Stable registration number like FOL-1001 */
export function formatRegistrationId(role: UserRole, sequence: number): string {
  const n = Math.max(1, Math.floor(sequence));
  return `${ROLE_PREFIX[role]}-${String(n).padStart(4, '0')}`;
}

export function parseRegistrationSequence(visibleId?: string): number | null {
  if (!visibleId) return null;
  const m = visibleId.match(/^[A-Z]{3}-(\d+)$/i);
  return m ? Number(m[1]) : null;
}

export function nextRegistrationId(
  role: UserRole,
  existing: Array<{ role: string; visibleId?: string }>
): string {
  let max = 1000;
  existing.forEach((u) => {
    if (u.role !== role) return;
    const seq = parseRegistrationSequence(u.visibleId);
    if (seq != null && seq > max) max = seq;
  });
  return formatRegistrationId(role, max + 1);
}

export function allocateUniqueHandle(
  preferred: string,
  existingHandles: string[]
): string {
  const base = normalizeHandle(preferred);
  const taken = new Set(
    existingHandles.map((h) => normalizeHandle(h).toLowerCase())
  );
  if (!taken.has(base.toLowerCase())) return base;

  const stem = base.slice(1);
  let i = 2;
  while (taken.has(`@${stem}${i}`.toLowerCase())) i += 1;
  return `@${stem}${i}`;
}

/** Fill missing handle / registration for legacy sessions. */
export function ensureAccountIdentity<
  T extends { role: UserRole; name: string; email: string; handle?: string; visibleId?: string },
>(user: T, existing: Array<{ role: string; handle?: string; visibleId?: string }>): T & {
  handle: string;
  visibleId: string;
} {
  const handle =
    user.handle && user.handle.trim()
      ? normalizeHandle(user.handle)
      : allocateUniqueHandle(
          user.email.split('@')[0] || user.name || user.role,
          existing.map((u) => u.handle || '')
        );

  const visibleId =
    user.visibleId && user.visibleId.trim()
      ? user.visibleId.trim()
      : nextRegistrationId(user.role, existing);

  return { ...user, handle, visibleId };
}
