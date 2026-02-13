/**
 * @file Request validation middleware using Zod
 * @description Validates request body, params, and query using Zod schemas
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from './errorHandler';

/**
 * Validation target options
 */
type ValidationTarget = 'body' | 'params' | 'query';

/**
 * Create validation middleware for a specific target and schema
 * @param schema - Zod schema to validate against
 * @param target - Request property to validate (body, params, or query)
 * @returns Express middleware function
 */
export function validate<T>(
  schema: ZodSchema<T>,
  target: ValidationTarget = 'body'
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[target];
      const result = schema.safeParse(data);

      if (!result.success) {
        const formattedErrors = formatZodErrors(result.error);
        throw new ValidationError('Validation failed', formattedErrors);
      }

      // Replace the target with parsed data (includes type coercion)
      (req as unknown as Record<string, unknown>)[target] = result.data;

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Validate request body
 * @param schema - Zod schema
 * @returns Express middleware
 */
export function validateBody<T>(
  schema: ZodSchema<T>
): (req: Request, res: Response, next: NextFunction) => void {
  return validate(schema, 'body');
}

/**
 * Validate request params
 * @param schema - Zod schema
 * @returns Express middleware
 */
export function validateParams<T>(
  schema: ZodSchema<T>
): (req: Request, res: Response, next: NextFunction) => void {
  return validate(schema, 'params');
}

/**
 * Validate request query
 * @param schema - Zod schema
 * @returns Express middleware
 */
export function validateQuery<T>(
  schema: ZodSchema<T>
): (req: Request, res: Response, next: NextFunction) => void {
  return validate(schema, 'query');
}

/**
 * Format Zod errors into a user-friendly structure
 * @param error - Zod error object
 * @returns Formatted error details
 */
function formatZodErrors(
  error: ZodError
): Array<{ field: string; message: string }> {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}
