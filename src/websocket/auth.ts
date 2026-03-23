/**
 * @file WebSocket authentication middleware
 * @description Validates Supabase JWT on Socket.IO handshake
 */

import type { Socket } from 'socket.io';
import { verifyToken } from '../middleware/supabaseAuth';
import { User } from '../models/User';
import { logger } from '../utils/logger';

export interface SocketData {
  userId: string;
  username: string;
  email: string;
  businessIds: string[];
  roles: string[];
}

/**
 * Socket.IO middleware that authenticates connections using a Supabase JWT.
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
    .then((payload) =>
      User.findOne({ authProviderId: payload.sub })
        .lean()
        .then((mongoUser) => {
          socket.data = {
            userId: payload.sub,
            username: payload.email || payload.sub,
            email: payload.email || '',
            businessIds: mongoUser?.businessIds?.map((id) => id.toString()) ?? [],
            roles: mongoUser?.roles ?? [],
          } satisfies SocketData;

          next();
        })
    )
    .catch((err) => {
      logger.warn('WebSocket connection rejected: invalid token', {
        socketId: socket.id,
        error: err instanceof Error ? err.message : String(err),
      });
      next(new Error('Invalid or expired token'));
    });
}
