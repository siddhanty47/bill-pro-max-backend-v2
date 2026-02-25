/**
 * @file Global error handler middleware
 * @description Centralized error handling for all Express routes
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Custom application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error class
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * Not found error class
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

/**
 * Unauthorized error class
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/**
 * Forbidden error class
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * Conflict error class
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * Error response interface
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
  requestId: string;
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as Request & { id?: string }).id || 'unknown';

  // Log the error
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestId,
  });

  // Handle AppError (operational errors)
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      timestamp: new Date().toISOString(),
      requestId,
    };

    res.status(err.statusCode).json(response);
    return;
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.message,
      },
      timestamp: new Date().toISOString(),
      requestId,
    };

    res.status(400).json(response);
    return;
  }

  // Handle Mongoose cast errors (invalid ObjectId)
  if (err.name === 'CastError') {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'INVALID_ID',
        message: 'Invalid ID format',
      },
      timestamp: new Date().toISOString(),
      requestId,
    };

    res.status(400).json(response);
    return;
  }

  // Handle duplicate key errors (MongoDB returns code as number 11000)
  const errCode = (err as unknown as Record<string, unknown>).code;
  if (errCode === 11000 || errCode === '11000') {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'DUPLICATE_KEY',
        message: 'Duplicate entry found',
      },
      timestamp: new Date().toISOString(),
      requestId,
    };

    res.status(409).json(response);
    return;
  }

  // Handle unknown errors
  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : err.message,
    },
    timestamp: new Date().toISOString(),
    requestId,
  };

  res.status(500).json(response);
}
