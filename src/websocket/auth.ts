/**
 * @file WebSocket authentication middleware
 * @description Validates Keycloak JWT on Socket.IO handshake
 */

import type { Socket } from 'socket.io';
import { verifyToken, KeycloakTokenPayload } from '../middleware/keycloakAuth';
import { logger } from '../utils/logger';

export interface SocketData {
  userId: string;
  username: string;
  email: string;
  businessIds: string[];
  roles: string[];
}

/**
 * Socket.IO middleware that authenticates connections using a Keycloak JWT.
 * The client must pass `auth: { token }` when connecting.
 */
export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth?.token as string | undefined;

  if (!token) {
    logger.warn('WebSocket connection rejected: no token provided', {
      socketId: socket.id,
    });
    return next(new Error('Authentication required'));
  }

  verifyToken(token)
    .then((payload: KeycloakTokenPayload) => {
      const realmAccess = (payload as Record<string, unknown>).realm_access as {
        roles?: string[];
      } | undefined;

      socket.data = {
        userId: payload.sub,
        username: payload.preferred_username || payload.sub,
        email: payload.email || '',
        businessIds: Array.isArray(payload.businessIds) ? payload.businessIds : [],
        roles: realmAccess?.roles || [],
      } satisfies SocketData;

      next();
    })
    .catch((err) => {
      logger.warn('WebSocket connection rejected: invalid token', {
        socketId: socket.id,
        error: err instanceof Error ? err.message : String(err),
      });
      next(new Error('Invalid or expired token'));
    });
}
