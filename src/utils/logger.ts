/**
 * @file Winston logger configuration
 * @description Centralized logging utility with structured log format
 */

import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

/**
 * Custom log format for development
 */
const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(meta).length > 0) {
    log += ` ${JSON.stringify(meta)}`;
  }
  if (stack) {
    log += `\n${stack}`;
  }
  return log;
});

/**
 * Custom log format for production (JSON)
 */
const prodFormat = printf(({ level, message, timestamp, ...meta }) => {
  return JSON.stringify({
    timestamp,
    level,
    message,
    ...meta,
  });
});

/**
 * Determine log level based on environment
 */
const getLogLevel = (): string => {
  return process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
};

/**
 * Create Winston logger instance
 */
export const logger = winston.createLogger({
  level: getLogLevel(),
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true })),
  defaultMeta: { service: 'billpromax-backend-v2' },
  transports: [
    new winston.transports.Console({
      format:
        process.env.NODE_ENV === 'production'
          ? prodFormat
          : combine(colorize({ all: true }), devFormat),
    }),
  ],
});

/**
 * Add file transport in production
 */
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: prodFormat,
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: prodFormat,
    })
  );
}

export default logger;
