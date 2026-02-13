/**
 * @file Business scope middleware
 * @description Multi-tenant data isolation middleware
 */

import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from './keycloakAuth';
import { ForbiddenError, UnauthorizedError, NotFoundError } from './errorHandler';
import { logger } from '../utils/logger';

/**
 * Extended request with business context
 */
export interface BusinessScopedRequest extends AuthenticatedRequest {
  /** Current business ID from route params */
  businessId: string;
}

/**
 * Middleware to validate and enforce business scope
 * Ensures user has access to the business specified in route params
 * Also allows access if the user is the owner of the business (for cases where token hasn't been refreshed yet)
 */
export async function validateBusinessAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { businessId } = req.params;

  // Ensure user is authenticated
  if (!authReq.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  // Validate businessId is provided
  if (!businessId) {
    return next(new NotFoundError('Business'));
  }

  // Check if user has access to this business via their JWT token
  if (authReq.user.businessIds.includes(businessId)) {
    // User has explicit access via token
    (req as BusinessScopedRequest).businessId = businessId;
    logger.debug('Business access validated via token', {
      userId: authReq.user.id,
      businessId,
    });
    return next();
  }

  // If not in token, check if user is the owner of this business
  // This handles the case where a business was just created but token hasn't been refreshed
  try {
    const Business = mongoose.model('Business');
    const business = await Business.findById(businessId).lean();

    if (business && (business as { ownerUserId?: string }).ownerUserId === authReq.user.id) {
      // User is the owner, allow access
      (req as BusinessScopedRequest).businessId = businessId;
      logger.debug('Business access validated via ownership', {
        userId: authReq.user.id,
        businessId,
      });
      return next();
    }
  } catch (error) {
    // If business lookup fails, continue to deny access
    logger.debug('Business lookup failed during access check', {
      businessId,
      error,
    });
  }

  // Access denied
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
 * Middleware for client portal access
 * Validates access to specific agreement/party
 */
export function validateClientPortalAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;

  // Ensure user is authenticated
  if (!authReq.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  // Check for client-portal role
  if (!authReq.user.roles.includes('client-portal')) {
    return next(new ForbiddenError('Client portal access required'));
  }

  // Additional validation for specific agreement would go here
  // This would check if the user's associated partyId matches the requested data

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
