/**
 * @file User roles configuration
 * @description App-domain role constants, independent of auth provider
 */

export const UserRoles = {
  OWNER: 'owner',
  MANAGER: 'manager',
  STAFF: 'staff',
  ACCOUNTANT: 'accountant',
  VIEWER: 'viewer',
  CLIENT_PORTAL: 'client-portal',
} as const;

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles];
