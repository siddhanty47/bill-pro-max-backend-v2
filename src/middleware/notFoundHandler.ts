/**
 * @file 404 Not Found handler middleware
 * @description Handles requests to non-existent routes
 */

import { Request, Response } from 'express';

/**
 * Not found handler middleware
 * Returns a 404 response for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  const requestId = (req as Request & { id?: string }).id || 'unknown';

  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
    timestamp: new Date().toISOString(),
    requestId,
  });
}
