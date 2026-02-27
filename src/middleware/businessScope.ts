/**
 * @file Business scope middleware
 * @description Multi-tenant data isolation middleware.
 * Validates business access and loads per-business role from BusinessMember collection.
 */

import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest, AuthenticatedUser } from './keycloakAuth';
import { ForbiddenError, UnauthorizedError, NotFoundError } from './errorHandler';
import { BusinessMember } from '../models/BusinessMember';
import { UserRole } from '../config/keycloak';
import { logger } from '../utils/logger';

/**
 * Extended authenticated user with per-business role
 */
export interface BusinessScopedUser extends AuthenticatedUser {
  /** Role within the current business (loaded from BusinessMember) */
  businessRole: UserRole;
}

/**
 * Extended request with business context
 */
export interface BusinessScopedRequest extends AuthenticatedRequest {
  /** Current business ID from route params */
  businessId: string;
  /** User with per-business role injected */
  user: BusinessScopedUser;
}

/**
 * Middleware to validate and enforce business scope.
 * Ensures user has access to the business specified in route params.
 * Loads the user's per-business role from the BusinessMember collection
 * and injects it as `req.user.businessRole`.
 */
export async function validateBusinessAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { businessId } = req.params;

  if (!authReq.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (!businessId) {
    return next(new NotFoundError('Business'));
  }

  // Try to find the user's membership in this business
  const membership = await BusinessMember.findOne({
    businessId,
    userId: authReq.user.id,
  }).lean();

  if (membership) {
    (req as BusinessScopedRequest).businessId = businessId;
    (authReq.user as BusinessScopedUser).businessRole = membership.role as UserRole;
    logger.debug('Business access validated via membership', {
      userId: authReq.user.id,
      businessId,
      role: membership.role,
    });
    return next();
  }

  // Check if user has access via JWT businessIds (backwards compatibility / newly created)
  if (authReq.user.businessIds.includes(businessId)) {
    (req as BusinessScopedRequest).businessId = businessId;
    // Fall back to checking ownership for role
    try {
      const Business = mongoose.model('Business');
      const business = await Business.findById(businessId).lean();
      if (business && (business as { ownerUserId?: string }).ownerUserId === authReq.user.id) {
        (authReq.user as BusinessScopedUser).businessRole = 'owner' as UserRole;
      } else {
        (authReq.user as BusinessScopedUser).businessRole = 'viewer' as UserRole;
      }
    } catch {
      (authReq.user as BusinessScopedUser).businessRole = 'viewer' as UserRole;
    }
    logger.debug('Business access validated via JWT token', {
      userId: authReq.user.id,
      businessId,
    });
    return next();
  }

  // Check if user is the owner (handles newly created businesses before membership is created)
  try {
    const Business = mongoose.model('Business');
    const business = await Business.findById(businessId).lean();

    if (business && (business as { ownerUserId?: string }).ownerUserId === authReq.user.id) {
      (req as BusinessScopedRequest).businessId = businessId;
      (authReq.user as BusinessScopedUser).businessRole = 'owner' as UserRole;
      logger.debug('Business access validated via ownership', {
        userId: authReq.user.id,
        businessId,
      });
      return next();
    }
  } catch (error) {
    logger.debug('Business lookup failed during access check', {
      businessId,
      error,
    });
  }

  logger.warn('Business access denied', {
    userId: authReq.user.id,
    attemptedBusinessId: businessId,
    userBusinessIds: authReq.user.businessIds,
    path: req.path,
  });
  return next(
    new ForbiddenError('You do not have access to this business')
  );
}

/**
 * Middleware for client portal access.
 * Validates access to specific agreement/party.
 */
export function validateClientPortalAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (!authReq.user.roles.includes('client-portal')) {
    return next(new ForbiddenError('Client portal access required'));
  }

  next();
}

/**
 * Helper to get business ID from request
 * @param req - Express request
 * @returns Business ID
 * @throws Error if business ID not found
 */
export function getBusinessId(req: Request): string {
  const businessScopedReq = req as BusinessScopedRequest;
  if (!businessScopedReq.businessId) {
    throw new Error('Business ID not found in request');
  }
  return businessScopedReq.businessId;
}

/**
 * Helper to get authenticated user from request
 * @param req - Express request
 * @returns Authenticated user
 * @throws Error if user not found
 */
export function getAuthenticatedUser(req: Request): AuthenticatedRequest['user'] {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    throw new UnauthorizedError('User not authenticated');
  }
  return authReq.user;
}
