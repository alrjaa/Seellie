import type { UserRole } from '@/types';
import { t } from '@/i18n';

export type SecondaryRole = 'organizer' | 'freelancer';

export function secondaryRoleLabel(role: SecondaryRole): string {
  return t(`roles.${role}`);
}

export function roleLabel(role: UserRole): string {
  return t(`roles.${role}`);
}

/** Live role labels (read via property access so language switches apply) */
export const ROLE_LABEL = {
  get follower() {
    return t('roles.follower');
  },
  get organizer() {
    return t('roles.organizer');
  },
  get freelancer() {
    return t('roles.freelancer');
  },
  get superadmin() {
    return t('roles.superadmin');
  },
} as Record<UserRole, string>;

export const SECONDARY_ROLE_LABEL = {
  get organizer() {
    return t('roles.organizer');
  },
  get freelancer() {
    return t('roles.freelancer');
  },
} as Record<SecondaryRole, string>;

export function organizerPathTerms(): string {
  return t('paths.organizerTerms');
}

export function freelancerPathTerms(): string {
  return t('paths.freelancerTerms');
}

/** Prefer organizerPathTerms() / freelancerPathTerms() */
export const ORGANIZER_PATH_TERMS = '';
export const FREELANCER_PATH_TERMS = '';

/** المسار الثانوي الوحيد إن وُجد (منظم أو لاعب حر — وليس الاثنين) */
export function getSecondaryRole(
  roles?: UserRole[] | null
): SecondaryRole | null {
  if (!roles?.length) return null;
  if (roles.includes('organizer')) return 'organizer';
  if (roles.includes('freelancer')) return 'freelancer';
  return null;
}

export function userHasRole(
  user: { roles?: UserRole[]; role?: UserRole } | null | undefined,
  role: UserRole
): boolean {
  if (!user) return false;
  if (user.roles?.length) return user.roles.includes(role);
  return user.role === role;
}

/** تطبيع الأدوار: دور ثانٍ واحد كحد أقصى + مزامنة role مع activeRole */
export function normalizeUserRoles<
  T extends {
    role: UserRole;
    roles?: UserRole[];
    activeRole?: UserRole;
  },
>(user: T): T & { roles: UserRole[]; activeRole: UserRole; role: UserRole } {
  if (user.role === 'superadmin') {
    return {
      ...user,
      roles: ['superadmin'],
      activeRole: 'superadmin',
      role: 'superadmin',
    };
  }

  let roles: UserRole[] = user.roles?.length
    ? Array.from(new Set(user.roles))
    : [user.role];

  const secondary = getSecondaryRole(roles);
  if (secondary) {
    roles = ['follower', secondary];
  } else if (!roles.includes('follower') && user.role === 'follower') {
    roles = ['follower'];
  } else if (user.role === 'organizer' || user.role === 'freelancer') {
    roles = [user.role];
  } else {
    roles = ['follower'];
  }

  if (roles.includes('organizer') && roles.includes('freelancer')) {
    roles = roles.filter((r) => r !== 'freelancer');
  }

  const activeRole: UserRole =
    user.activeRole && roles.includes(user.activeRole)
      ? user.activeRole
      : roles.includes(user.role)
        ? user.role
        : roles[0];

  return { ...user, roles, activeRole, role: activeRole };
}
