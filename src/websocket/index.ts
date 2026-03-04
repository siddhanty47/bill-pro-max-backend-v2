/**
 * @file WebSocket server setup
 * @description Socket.IO server attached to the Express HTTP server.
 * Provides an authenticated, user-scoped real-time channel.
 */

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { socketAuthMiddleware, SocketData } from './auth';
import { logger } from '../utils/logger';

let io: SocketIOServer | null = null;

/**
 * Returns the Socket.IO server instance.
 * Job processors and services can import this to emit events.
 */
export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO has not been initialized. Call initializeWebSocket first.');
  }
  return io;
}

/**
 * Attach Socket.IO to the HTTP server and wire up authentication.
 * @param httpServer - The Node HTTP server returned by express.listen()
 */
export function initializeWebSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const { userId, username } = socket.data as SocketData;

    socket.join(`user:${userId}`);

    logger.info('WebSocket client connected', {
      socketId: socket.id,
      userId,
      username,
    });

    socket.on('disconnect', (reason) => {
      logger.info('WebSocket client disconnected', {
        socketId: socket.id,
        userId,
        reason,
      });
    });
  });

  logger.info('Socket.IO server initialized');

  return io;
}

/**
 * Gracefully close the Socket.IO server.
 */
export async function closeWebSocket(): Promise<void> {
  if (io) {
    await new Promise<void>((resolve) => {
      io!.close(() => resolve());
    });
    io = null;
    logger.info('Socket.IO server closed');
  }
}

export { SocketData } from './auth';
