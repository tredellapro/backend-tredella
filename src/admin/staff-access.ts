/* Who on the team may do what, decided server-side.
 *
 * Mirrors admin-tredella/src/lib/access.ts. The console's copy shapes its UI —
 * which links appear, which buttons render. This copy is the boundary: it is
 * what stops a request made outside the browser. If a rule changes in one it
 * has to change in the other, or the console will offer a button the API then
 * refuses.
 *
 * Pure and dependency-free so it can be compiled and exercised on its own.
 */

export const STAFF_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'EDITOR',
  'VIEWER',
  'CUSTOM',
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export type Access = 'NONE' | 'VIEW' | 'MANAGE';

/** Matches SECTIONS in the console. A section missing here is invisible there. */
export const SECTION_KEYS = [
  'analytics',
  'users',
  'categories',
  'brands',
  'orders',
  'products',
  'stores',
  'verification',
  'plans',
  'withdrawals',
  'chats',
  'complaints',
  'settings',
  'team',
] as const;

export type Permissions = Record<string, Access>;

const everySection = (level: Access): Permissions =>
  Object.fromEntries(SECTION_KEYS.map((key) => [key, level]));

const withOverrides = (base: Access, overrides: Permissions): Permissions => ({
  ...everySection(base),
  ...overrides,
});

/**
 * The super admin alone releases money and grants access.
 *
 * ADMIN gets VIEW on withdrawals, never MANAGE — an admin with MANAGE could
 * pay the marketplace's money into a bank account of their choosing.
 */
export const ROLE_PRESETS: Record<Exclude<StaffRole, 'CUSTOM'>, Permissions> = {
  SUPER_ADMIN: everySection('MANAGE'),

  ADMIN: withOverrides('MANAGE', {
    withdrawals: 'VIEW',
    plans: 'VIEW',
    team: 'NONE',
  }),

  EDITOR: withOverrides('VIEW', {
    categories: 'MANAGE',
    brands: 'MANAGE',
    products: 'MANAGE',
    complaints: 'MANAGE',
    chats: 'MANAGE',
    settings: 'MANAGE',
    withdrawals: 'NONE',
    plans: 'NONE',
    team: 'NONE',
  }),

  VIEWER: withOverrides('VIEW', {
    withdrawals: 'NONE',
    team: 'NONE',
    // their own profile and password stay theirs to change
    settings: 'MANAGE',
  }),
};

export const permissionsFor = (
  role: StaffRole | null | undefined,
  custom?: Permissions | null,
): Permissions => {
  if (!role) return everySection('NONE');
  if (role === 'CUSTOM') return { ...everySection('NONE'), ...(custom ?? {}) };
  return ROLE_PRESETS[role];
};

export const canView = (permissions: Permissions, key: string): boolean =>
  permissions[key] === 'VIEW' || permissions[key] === 'MANAGE';

export const canManage = (permissions: Permissions, key: string): boolean =>
  permissions[key] === 'MANAGE';

/* ---------------- what a grant may say ---------------- */

/** SUPER_ADMIN is absent on purpose: it comes from the environment, not a form. */
export const GRANTABLE_ROLES: StaffRole[] = [
  'ADMIN',
  'EDITOR',
  'VIEWER',
  'CUSTOM',
];

export const isValidRole = (value: string): value is StaffRole =>
  (STAFF_ROLES as readonly string[]).includes(value);

/**
 * Null when `permissions` is a usable custom grant.
 *
 * Unknown section keys are rejected rather than ignored: a typo that silently
 * grants nothing looks identical to a grant that was never saved.
 */
export const customGrantProblem = (
  permissions: Permissions | null | undefined,
): string | null => {
  if (!permissions || Object.keys(permissions).length === 0)
    return 'Give them access to at least one section, or they will have nowhere to land.';

  const unknown = Object.keys(permissions).filter(
    (key) => !(SECTION_KEYS as readonly string[]).includes(key),
  );
  if (unknown.length > 0)
    return `Not a section: ${unknown.join(', ')}.`;

  const bad = Object.entries(permissions).filter(
    ([, level]) => !['NONE', 'VIEW', 'MANAGE'].includes(level),
  );
  if (bad.length > 0)
    return `Access must be NONE, VIEW or MANAGE — got "${bad[0][1]}" for ${bad[0][0]}.`;

  if (Object.values(permissions).every((level) => level === 'NONE'))
    return 'Give them access to at least one section, or they will have nowhere to land.';

  return null;
};

export interface StaffMember {
  id: string;
  email: string;
  staffRole: StaffRole | null;
}

/**
 * Null when `actor` may set `target` to `next`.
 *
 * A console with nobody who can grant access is a console locked out of
 * itself, so the last super admin cannot be demoted — by anyone, including
 * themselves.
 */
export const grantProblem = (
  actor: StaffMember,
  target: StaffMember | null,
  next: StaffRole,
  superAdminCount: number,
): string | null => {
  if (actor.staffRole !== 'SUPER_ADMIN')
    return 'Only a super admin can change console access.';

  if (next === 'SUPER_ADMIN')
    return 'Super admin comes from SUPER_ADMIN_EMAIL in the environment, not from this call.';

  if (
    target &&
    target.staffRole === 'SUPER_ADMIN' &&
    superAdminCount <= 1
  )
    return `${target.email} is the only super admin. Promote someone else first, or nobody will be able to grant access.`;

  return null;
};

export const revokeProblem = (
  actor: StaffMember,
  target: StaffMember,
  superAdminCount: number,
): string | null => {
  if (actor.staffRole !== 'SUPER_ADMIN')
    return 'Only a super admin can remove console access.';

  if (target.id === actor.id)
    return 'You cannot remove your own access.';

  if (target.staffRole === 'SUPER_ADMIN' && superAdminCount <= 1)
    return `${target.email} is the only super admin. Promote someone else first.`;

  return null;
};
