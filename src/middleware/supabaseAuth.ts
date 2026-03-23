/**
 * @file Supabase authentication middleware
 * @description JWT token validation and user extraction from Supabase tokens.
 * Verifies RS256 JWTs locally using JWKS public key (cached).
 * Looks up MongoDB User for roles and businessIds (not in Supabase JWT).
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createPublicKey } from 'crypto';
import { LRUCache } from 'lru-cache';
import { supabaseConfig } from '../config/supabase';
import { UnauthorizedError } from './errorHandler';
import { User, IUser } from '../models/User';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// JWKS key cache
// ---------------------------------------------------------------------------

interface JwkKey {
  kty: string;
  use?: string;
  n?: string;
  e?: string;
  [key: string]: unknown;
}

interface CachedKey {
  pem: string;
  fetchedAt: number;
}

const JWKS_TTL_MS = 3_600_000; // 1 hour
let cachedKey: CachedKey | null = null;
let fetchInProgress: Promise<string> | null = null;

function jwkToPem(jwk: JwkKey): string {
  const key = createPublicKey({ key: jwk as import('crypto').JsonWebKeyInput['key'], format: 'jwk' });
  return key.export({ type: 'spki', format: 'pem' }) as string;
}

async function fetchJwksPublicKey(): Promise<string> {
  if (fetchInProgress) return fetchInProgress;

  fetchInProgress = (async () => {
    try {
      const jwksUrl = `${supabaseConfig.url}/auth/v1/.well-known/jwks.json`;
      const res = await fetch(jwksUrl);
      if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);

      const jwks = (await res.json()) as { keys: JwkKey[] };
      const signingKey = jwks.keys.find((k) => k.use === 'sig');
      if (!signingKey) throw new Error('No signing key found in JWKS');

      const pem = jwkToPem(signingKey);
      cachedKey = { pem, fetchedAt: Date.now() };
      return pem;
    } catch (err) {
      if (cachedKey) {
        logger.warn('JWKS fetch failed, using stale cached key', {
          error: err instanceof Error ? err.message : String(err),
        });
        return cachedKey.pem;
      }
      throw err;
    } finally {
      fetchInProgress = null;
    }
  })();

  return fetchInProgress;
}

async function getSigningKey(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedKey && Date.now() - cachedKey.fetchedAt < JWKS_TTL_MS) {
    return cachedKey.pem;
  }
  return fetchJwksPublicKey();
}

/**
 * Pre-fetch JWKS key on server startup to avoid cold-start latency.
 */
export async function warmJwksCache(): Promise<void> {
  try {
    await getSigningKey();
    logger.info('JWKS public key cached successfully');
  } catch (err) {
    logger.error('Failed to warm JWKS cache', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Token types & interfaces
// ---------------------------------------------------------------------------

/**
 * Supabase JWT payload structure
 */
interface SupabaseTokenPayload {
  sub: string;
  email?: string;
  user_metadata?: {
    firstName?: string;
    lastName?: string;
    full_name?: string;
    name?: string;
    [key: string]: unknown;
  };
  role?: string;
}

/**
 * Authenticated user attached to request
 */
export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  roles: string[];
  businessIds: string[];
}

/**
 * Extended Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

// ---------------------------------------------------------------------------
// MongoDB user cache
// ---------------------------------------------------------------------------

/**
 * LRU cache for MongoDB user lookups to avoid a DB query per request.
 * Key: Supabase user UUID (sub), Value: partial user data.
 */
const userCache = new LRUCache<string, { roles: string[]; businessIds: string[] }>({
  max: 500,
  ttl: 60_000, // 60 seconds
});

/**
 * Clear cached user data (call after updating user roles/businessIds)
 */
export function clearUserCache(userId: string): void {
  userCache.delete(userId);
}

// ---------------------------------------------------------------------------
// Token verification
// ---------------------------------------------------------------------------

function mapJwtError(err: unknown): UnauthorizedError {
  if (err instanceof jwt.TokenExpiredError) {
    return new UnauthorizedError('Token has expired');
  }
  logger.error('JWT verification failed', {
    error: err instanceof Error ? err.message : String(err),
  });
  return new UnauthorizedError('Invalid token');
}

/**
 * Verify JWT token locally using cached JWKS public key.
 * On signature mismatch, retries once with a freshly fetched key (handles rotation).
 */
export async function verifyToken(token: string): Promise<SupabaseTokenPayload> {
  const pem = await getSigningKey();

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, pem, { algorithms: ['ES256'] }) as jwt.JwtPayload;
  } catch (err) {
    // On signature/key error (not expiry), retry with fresh key for rotation
    if (err instanceof jwt.JsonWebTokenError && !(err instanceof jwt.TokenExpiredError)) {
      const freshPem = await getSigningKey(true);
      if (freshPem !== pem) {
        try {
          payload = jwt.verify(token, freshPem, { algorithms: ['ES256'] }) as jwt.JwtPayload;
        } catch (retryErr) {
          throw mapJwtError(retryErr);
        }
      } else {
        throw mapJwtError(err);
      }
    } else {
      throw mapJwtError(err);
    }
  }

  return {
    sub: payload.sub!,
    email: payload.email as string | undefined,
    user_metadata: payload.user_metadata as SupabaseTokenPayload['user_metadata'],
    role: payload.role as string | undefined,
  };
}

// ---------------------------------------------------------------------------
// User data helpers
// ---------------------------------------------------------------------------

/**
 * Look up user's roles and businessIds from MongoDB, with caching.
 */
async function getUserData(userId: string): Promise<{ roles: string[]; businessIds: string[] }> {
  const cached = userCache.get(userId);
  if (cached) return cached;

  const mongoUser = await User.findOne({ authProviderId: userId }).lean();
  const data = {
    roles: mongoUser?.roles ?? [],
    businessIds: mongoUser?.businessIds?.map((id) => id.toString()) ?? [],
  };
  userCache.set(userId, data);
  return data;
}

/**
 * Build AuthenticatedUser from token payload + MongoDB data
 */
function buildUser(payload: SupabaseTokenPayload, mongoData: { roles: string[]; businessIds: string[] }): AuthenticatedUser {
  const meta = payload.user_metadata || {};
  const firstName = (meta.firstName as string) || '';
  const lastName = (meta.lastName as string) || '';
  const name = (meta.full_name as string) || (meta.name as string) || `${firstName} ${lastName}`.trim();

  return {
    id: payload.sub,
    username: payload.email || payload.sub,
    email: payload.email || '',
    name,
    firstName,
    lastName,
    roles: mongoData.roles,
    businessIds: mongoData.businessIds,
  };
}

// ---------------------------------------------------------------------------
// Express middleware
// ---------------------------------------------------------------------------

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
    .then((payload) => getUserData(payload.sub).then((mongoData) => ({ payload, mongoData })))
    .then(({ payload, mongoData }) => {
      const user = buildUser(payload, mongoData);
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
    .then((payload) =>
      getUserData(payload.sub).then((mongoData) => {
        const user = buildUser(payload, mongoData);
        (req as AuthenticatedRequest).user = user;
        next();
      })
    )
    .catch(() => {
      next();
    });
}
