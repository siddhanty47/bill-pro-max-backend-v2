/**
 * @file Request logging middleware
 * @description Logs incoming HTTP requests with timing information
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

/**
 * Extended request interface with ID
 */
interface ExtendedRequest extends Request {
  id: string;
  startTime: number;
}

/**
 * Request logger middleware
 * Adds request ID and logs request details
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const extReq = req as ExtendedRequest;

  // Generate request ID
  extReq.id = (req.headers['x-request-id'] as string) || uuidv4();
  extReq.startTime = Date.now();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', extReq.id);

  // Log incoming request
  logger.info('Incoming request', {
    requestId: extReq.id,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - extReq.startTime;

    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

    logger[logLevel]('Request completed', {
      requestId: extReq.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });

  next();
}
