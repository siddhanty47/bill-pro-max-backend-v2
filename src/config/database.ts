/**
 * @file MongoDB database configuration and connection management
 * @description Handles MongoDB connection using Mongoose with proper error handling
 */

import mongoose from 'mongoose';
import { logger } from '../utils/logger';

/**
 * Database configuration interface
 */
interface DatabaseConfig {
  /** MongoDB connection URI */
  uri: string;
  /** Database name */
  database: string;
}

/**
 * Database configuration settings
 */
export const databaseConfig: DatabaseConfig = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/billpromax',
  database: process.env.MONGODB_DATABASE || 'billpromax',
};

/**
 * Connect to MongoDB database
 * @returns Promise that resolves when connection is established
 */
export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set('strictQuery', true);

    await mongoose.connect(databaseConfig.uri, {
      dbName: databaseConfig.database,
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info('MongoDB connected successfully', {
      database: databaseConfig.database,
    });

    // Handle connection events
    mongoose.connection.on('error', err => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

/**
 * Disconnect from MongoDB database
 * @returns Promise that resolves when disconnection is complete
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting from MongoDB:', error);
    throw error;
  }
}

/**
 * Get the current database connection
 * @returns Mongoose connection instance
 */
export function getConnection(): mongoose.Connection {
  return mongoose.connection;
}
