/**
 * @file Keycloak authentication middleware
 * @description JWT token validation and user extraction from Keycloak tokens
 */

import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { keycloakConfig, UserRole } from '../config/keycloak';
import { UnauthorizedError, ForbiddenError } from './errorHandler';
import { logger } from '../utils/logger';

/**
 * Keycloak token payload structure
 */
export interface KeycloakTokenPayload extends JwtPayload {
  /** Subject (user ID in Keycloak) */
  sub: string;
  /** Preferred username */
  preferred_username?: string;
  /** Email address */
  email?: string;
  /** Email verified flag */
  email_verified?: boolean;
  /** User's full name */
  name?: string;
  /** Given name (first name) */
  given_name?: string;
  /** Family name (last name) */
  family_name?: string;
  /** Realm roles */
  realm_roles?: string[];
  /** Resource access (client roles) */
  resource_access?: {
    [clientId: string]: {
      roles: string[];
    };
  };
  /** Business IDs the user has access to */
  businessIds?: string[];
  /** Token type */
  typ?: string;
  /** Authorized party */
  azp?: string;
  /** Scope */
  scope?: string;
}

/**
 * Authenticated user attached to request
 */
export interface AuthenticatedUser {
  /** Keycloak user ID */
  id: string;
  /** Username */
  username: string;
  /** Email address */
  email: string;
  /** Full name */
  name: string;
  /** First name */
  firstName: string;
  /** Last name */
  lastName: string;
  /** User roles */
  roles: string[];
  /** Business IDs user has access to */
  businessIds: string[];
  /** Raw token payload */
  tokenPayload: KeycloakTokenPayload;
}

/**
 * Extended Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/**
 * JWKS client for fetching Keycloak public keys
 */
const jwksClient = jwksRsa({
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000, // 10 minutes
  jwksUri: keycloakConfig.jwksUri,
});

/**
 * Get signing key from JWKS
 * @param kid - Key ID from token header
 * @returns Signing key
 */
async function getSigningKey(kid: string): Promise<string> {
  const key = await jwksClient.getSigningKey(kid);
  return key.getPublicKey();
}

/**
 * Verify JWT token from Keycloak
 * @param token - JWT token string
 * @returns Decoded token payload
 */
export async function verifyToken(token: string): Promise<KeycloakTokenPayload> {
  return new Promise((resolve, reject) => {
    // Decode header to get kid
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      return reject(new UnauthorizedError('Invalid token format'));
    }

    const kid = decoded.header.kid;
    if (!kid) {
      return reject(new UnauthorizedError('Token missing key ID'));
    }

    // Get signing key and verify
    getSigningKey(kid)
      .then(signingKey => {
        jwt.verify(
          token,
          signingKey,
          {
            algorithms: ['RS256'],
            issuer: keycloakConfig.issuer,
          },
          (err, payload) => {
            if (err) {
              if (err.name === 'TokenExpiredError') {
                return reject(new UnauthorizedError('Token has expired'));
              }
              return reject(new UnauthorizedError('Invalid token'));
            }
            resolve(payload as KeycloakTokenPayload);
          }
        );
      })
      .catch(() => {
        reject(new UnauthorizedError('Unable to verify token'));
      });
  });
}

/**
 * Extract roles from token payload
 * @param payload - Token payload
 * @returns Array of role names
 */
function extractRoles(payload: KeycloakTokenPayload): string[] {
  const roles: string[] = [];

  // Realm roles
  if (payload.realm_roles) {
    roles.push(...payload.realm_roles);
  }

  // Check realm_access (common in newer Keycloak versions)
  const realmAccess = (payload as Record<string, unknown>).realm_access as {
    roles?: string[];
  } | undefined;
  if (realmAccess?.roles) {
    roles.push(...realmAccess.roles);
  }

  // Client roles
  if (payload.resource_access) {
    for (const client of Object.values(payload.resource_access)) {
      if (client.roles) {
        roles.push(...client.roles);
      }
    }
  }

  // Remove duplicates
  return [...new Set(roles)];
}

/**
 * Extract business IDs from token payload
 * @param payload - Token payload
 * @returns Array of business IDs
 */
function extractBusinessIds(payload: KeycloakTokenPayload): string[] {
  if (payload.businessIds) {
    if (Array.isArray(payload.businessIds)) {
      return payload.businessIds;
    }
    if (typeof payload.businessIds === 'string') {
      return [payload.businessIds];
    }
  }
  return [];
}

/**
 * Authentication middleware
 * Validates JWT token and attaches user to request
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next(new UnauthorizedError('Authorization header is required'));
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return next(new UnauthorizedError('Invalid authorization header format'));
  }

  const token = parts[1];

  verifyToken(token)
    .then(payload => {
      const user: AuthenticatedUser = {
        id: payload.sub,
        username: payload.preferred_username || payload.sub,
        email: payload.email || '',
        name: payload.name || '',
        firstName: payload.given_name || '',
        lastName: payload.family_name || '',
        roles: extractRoles(payload),
        businessIds: extractBusinessIds(payload),
        tokenPayload: payload,
      };

      (req as AuthenticatedRequest).user = user;

      logger.debug('User authenticated', {
        userId: user.id,
        username: user.username,
        roles: user.roles,
        businessIds: user.businessIds,
      });

      next();
    })
    .catch(next);
}

/**
 * Optional authentication middleware
 * Attaches user if token is present, but doesn't require it
 */
export function authenticateOptional(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return next();
  }

  const token = parts[1];

  verifyToken(token)
    .then(payload => {
      const user: AuthenticatedUser = {
        id: payload.sub,
        username: payload.preferred_username || payload.sub,
        email: payload.email || '',
        name: payload.name || '',
        firstName: payload.given_name || '',
        lastName: payload.family_name || '',
        roles: extractRoles(payload),
        businessIds: extractBusinessIds(payload),
        tokenPayload: payload,
      };

      (req as AuthenticatedRequest).user = user;
      next();
    })
    .catch(() => {
      // Ignore errors for optional auth
      next();
    });
}
