/**
 * @file WebSocket server setup
 * @description Socket.IO server attached to the Express HTTP server.
 * Provides an authenticated, user-scoped real-time channel.
 * Uses Redis adapter in production so events reach all instances.
 */

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { socketAuthMiddleware, SocketData } from './auth';
import { logger } from '../utils/logger';

let io: SocketIOServer | null = null;
let redisPubClient: ReturnType<typeof createClient> | null = null;
let redisSubClient: ReturnType<typeof createClient> | null = null;

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
 * Uses Redis adapter when REDIS_URL is set (production multi-instance).
 * @param httpServer - The Node HTTP server returned by express.listen()
 */
export async function initializeWebSocket(httpServer: HttpServer): Promise<SocketIOServer> {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Use Redis adapter in production so events broadcast across all instances
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      redisPubClient = createClient({
        url: redisUrl,
        ...(redisUrl.startsWith('rediss://') && {
          socket: { tls: true, rejectUnauthorized: false },
        }),
      });
      redisSubClient = redisPubClient.duplicate();
      await Promise.all([redisPubClient.connect(), redisSubClient.connect()]);
      io.adapter(createAdapter(redisPubClient, redisSubClient));
      logger.info('Socket.IO Redis adapter attached (multi-instance support)');
    } catch (err) {
      logger.warn('Socket.IO Redis adapter failed — running without multi-instance support', {
        error: err instanceof Error ? err.message : err,
      });
    }
  }

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
 * Gracefully close the Socket.IO server and Redis connections.
 */
export async function closeWebSocket(): Promise<void> {
  if (io) {
    await new Promise<void>((resolve) => {
      io!.close(() => resolve());
    });
    io = null;
  }
  if (redisPubClient) {
    await redisPubClient.quit();
    redisPubClient = null;
  }
  if (redisSubClient) {
    await redisSubClient.quit();
    redisSubClient = null;
  }
  logger.info('Socket.IO server closed');
}

export { SocketData } from './auth';
