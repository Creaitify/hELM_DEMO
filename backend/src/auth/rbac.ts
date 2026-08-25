import { env } from '../env.js';
import type { Role } from '../domain/types.js';

/**
 * Role-based access control.
 *
 * The workspace is the security boundary. A user holds exactly one role per
 * workspace and every role resolves to an explicit permission set — no
 * permission is ever inferred from a role comparison at a call site.
 *
 * The backend is authoritative. The frontend receives the resolved permission
 * list only so it can explain why a control is unavailable; hiding a control
 * is never the enforcement.
 */

export const PERMISSIONS = [
  'workspace.read',
  'workspace.manage',
  'members.read',
  'members.manage',
  'connections.read',
  'connections.manage',
  'connections.delete_data',
  'analytics.read',
  'scopes.manage',
  'intelligence.read',
  'intelligence.run',
  'recommendations.approve',
  'library.read',
  'library.create',
  'library.publish',
  'studio.generate',
  'audit.read',
  'ops.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const VIEWER: Permission[] = [
  'workspace.read',
  'members.read',
  'connections.read',
  'analytics.read',
  'intelligence.read',
  'library.read',
];

const ANALYST: Permission[] = [
  ...VIEWER,
  'scopes.manage',
  'intelligence.run',
  'library.create',
  'studio.generate',
];

const ADMIN: Permission[] = [
  ...ANALYST,
  'members.manage',
  'connections.manage',
  'recommendations.approve',
  'library.publish',
  'audit.read',
];

const OWNER: Permission[] = [...ADMIN, 'workspace.manage', 'connections.delete_data'];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  viewer: VIEWER,
  analyst: ANALYST,
  admin: ADMIN,
  owner: OWNER,
};

/** Plain-language reason shown when a role cannot perform an action. */
const PERMISSION_REASON: Record<Permission, string> = {
  'workspace.read': 'You need access to this workspace.',
  'workspace.manage': 'Only an owner can change workspace settings.',
  'members.read': 'You need access to this workspace.',
  'members.manage': 'Only an admin or owner can change who has access.',
  'connections.read': 'You need access to this workspace.',
  'connections.manage': 'Only an admin or owner can connect or disconnect a provider.',
  'connections.delete_data': 'Only an owner can delete stored provider history.',
  'analytics.read': 'You need access to this workspace.',
  'scopes.manage': 'Viewers cannot save or edit account groups.',
  'intelligence.read': 'You need access to this workspace.',
  'intelligence.run': 'Viewers cannot start an investigation.',
  'recommendations.approve': 'Only an admin or owner can approve a recommendation.',
  'library.read': 'You need access to this workspace.',
  'library.create': 'Viewers cannot create library artifacts.',
  'library.publish': 'Only an admin or owner can publish or approve an artifact.',
  'studio.generate': 'Viewers cannot generate images.',
  'audit.read': 'Only an admin or owner can read the audit ledger.',
  'ops.read': 'The operator console is limited to platform operators.',
};

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  analyst: 'Analyst',
  viewer: 'Viewer',
};

export function permissionsForRole(role: Role): Permission[] {
  // RBAC_ENABLED=false is a demo switch, not a hole: it reports the full
  // permission set rather than pretending a viewer has owner rights, so the
  // interface and the backend agree on what is allowed.
  if (!env.auth.rbacEnabled) return [...PERMISSIONS];
  return ROLE_PERMISSIONS[role] ?? VIEWER;
}

export function roleCan(role: Role, permission: Permission): boolean {
  if (!env.auth.rbacEnabled) return true;
  return permissionsForRole(role).includes(permission);
}

export function denialReason(permission: Permission): string {
  return PERMISSION_REASON[permission] ?? 'You do not have permission to do this.';
}

/** Roles a given role is allowed to assign to somebody else. */
export function assignableRoles(role: Role): Role[] {
  if (!env.auth.rbacEnabled) return ['owner', 'admin', 'analyst', 'viewer'];
  if (role === 'owner') return ['owner', 'admin', 'analyst', 'viewer'];
  if (role === 'admin') return ['analyst', 'viewer'];
  return [];
}
