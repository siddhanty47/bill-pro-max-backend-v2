/**
 * @file Role-Based Access Control (RBAC) middleware
 * @description Authorization middleware for role and permission checks
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, AuthenticatedUser } from './keycloakAuth';
import { ForbiddenError, UnauthorizedError } from './errorHandler';
import { UserRole, UserRoles } from '../config/keycloak';
import { logger } from '../utils/logger';

/**
 * Permission action types
 */
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'manage';

/**
 * Resource types
 */
export type ResourceType =
  | 'business'
  | 'party'
  | 'inventory'
  | 'challan'
  | 'bill'
  | 'payment'
  | 'report'
  | 'user';

/**
 * Permission definition
 */
export interface Permission {
  action: PermissionAction;
  resource: ResourceType;
}

/**
 * Role-permission mapping
 * Defines what each role can do
 */
const rolePermissions: Record<UserRole, Permission[]> = {
  owner: [
    // Owner has all permissions
    { action: 'manage', resource: 'business' },
    { action: 'manage', resource: 'party' },
    { action: 'manage', resource: 'inventory' },
    { action: 'manage', resource: 'challan' },
    { action: 'manage', resource: 'bill' },
    { action: 'manage', resource: 'payment' },
    { action: 'manage', resource: 'report' },
    { action: 'manage', resource: 'user' },
  ],
  manager: [
    // Manager has operational access
    { action: 'read', resource: 'business' },
    { action: 'manage', resource: 'party' },
    { action: 'manage', resource: 'inventory' },
    { action: 'manage', resource: 'challan' },
    { action: 'read', resource: 'bill' },
    { action: 'create', resource: 'bill' },
    { action: 'read', resource: 'payment' },
    { action: 'create', resource: 'payment' },
    { action: 'read', resource: 'report' },
  ],
  staff: [
    // Staff has basic operational access
    { action: 'read', resource: 'party' },
    { action: 'read', resource: 'inventory' },
    { action: 'create', resource: 'challan' },
    { action: 'read', resource: 'challan' },
    { action: 'update', resource: 'challan' },
    { action: 'read', resource: 'bill' },
  ],
  accountant: [
    // Accountant has financial access
    { action: 'read', resource: 'party' },
    { action: 'read', resource: 'inventory' },
    { action: 'read', resource: 'challan' },
    { action: 'manage', resource: 'bill' },
    { action: 'manage', resource: 'payment' },
    { action: 'read', resource: 'report' },
  ],
  viewer: [
    // Viewer has read-only access
    { action: 'read', resource: 'party' },
    { action: 'read', resource: 'inventory' },
    { action: 'read', resource: 'challan' },
    { action: 'read', resource: 'bill' },
    { action: 'read', resource: 'payment' },
    { action: 'read', resource: 'report' },
  ],
  'client-portal': [
    // Client portal has limited access
    { action: 'read', resource: 'challan' },
    { action: 'read', resource: 'bill' },
    { action: 'read', resource: 'payment' },
  ],
};

/**
 * Check if a role has a specific permission
 * @param role - User role
 * @param action - Permission action
 * @param resource - Resource type
 * @returns True if role has permission
 */
function roleHasPermission(
  role: string,
  action: PermissionAction,
  resource: ResourceType
): boolean {
  const permissions = rolePermissions[role as UserRole];
  if (!permissions) return false;

  return permissions.some(
    p =>
      (p.action === action || p.action === 'manage') &&
      p.resource === resource
  );
}

/**
 * Check if user has a specific permission
 * @param user - Authenticated user
 * @param action - Permission action
 * @param resource - Resource type
 * @returns True if user has permission
 */
export function userHasPermission(
  user: AuthenticatedUser,
  action: PermissionAction,
  resource: ResourceType
): boolean {
  return user.roles.some(role => roleHasPermission(role, action, resource));
}

/**
 * Check if user has any of the specified roles
 * @param user - Authenticated user
 * @param roles - Array of role names
 * @returns True if user has any of the roles
 */
export function userHasRole(user: AuthenticatedUser, roles: string[]): boolean {
  return user.roles.some(role => roles.includes(role));
}

/**
 * Middleware to require specific roles
 * @param roles - Required roles (any of these)
 * @returns Express middleware
 */
export function requireRoles(
  ...roles: UserRole[]
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!userHasRole(authReq.user, roles)) {
      logger.warn('Access denied - insufficient role', {
        userId: authReq.user.id,
        userRoles: authReq.user.roles,
        requiredRoles: roles,
        path: req.path,
      });
      return next(
        new ForbiddenError(
          `Access denied. Required roles: ${roles.join(', ')}`
        )
      );
    }

    next();
  };
}

/**
 * Middleware to require specific permission
 * @param action - Permission action
 * @param resource - Resource type
 * @returns Express middleware
 */
export function requirePermission(
  action: PermissionAction,
  resource: ResourceType
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!userHasPermission(authReq.user, action, resource)) {
      logger.warn('Access denied - insufficient permission', {
        userId: authReq.user.id,
        userRoles: authReq.user.roles,
        requiredAction: action,
        requiredResource: resource,
        path: req.path,
      });
      return next(
        new ForbiddenError(
          `Access denied. Required permission: ${action} on ${resource}`
        )
      );
    }

    next();
  };
}

/**
 * Middleware to require owner role
 */
export const requireOwner = requireRoles(UserRoles.OWNER);

/**
 * Middleware to require manager or above
 */
export const requireManager = requireRoles(UserRoles.OWNER, UserRoles.MANAGER);

/**
 * Middleware to require staff or above
 */
export const requireStaff = requireRoles(
  UserRoles.OWNER,
  UserRoles.MANAGER,
  UserRoles.STAFF
);

/**
 * Middleware to require accountant role
 */
export const requireAccountant = requireRoles(
  UserRoles.OWNER,
  UserRoles.ACCOUNTANT
);
