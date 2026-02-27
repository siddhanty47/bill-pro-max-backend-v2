/**
 * @file Middleware exports
 * @description Central export point for all middleware
 */

export { errorHandler, AppError, ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError } from './errorHandler';
export { notFoundHandler } from './notFoundHandler';
export { requestLogger } from './requestLogger';
export { validate, validateBody, validateParams, validateQuery } from './validation';
export { authenticate, authenticateOptional, AuthenticatedRequest, AuthenticatedUser, KeycloakTokenPayload } from './keycloakAuth';
export { requireRoles, requirePermission, requireOwner, requireManager, requireStaff, requireAccountant, userHasPermission, userHasRole, PermissionAction, ResourceType, Permission } from './rbac';
export { validateBusinessAccess, validateClientPortalAccess, getBusinessId, getAuthenticatedUser, BusinessScopedRequest, BusinessScopedUser } from './businessScope';
