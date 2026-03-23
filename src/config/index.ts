/**
 * @file Configuration module that exports all configuration settings
 * @description Central configuration management for the BillProMax Backend V2
 */

import { databaseConfig, connectDatabase, disconnectDatabase } from './database';
import { supabaseConfig } from './supabase';

/**
 * Application configuration interface
 */
interface AppConfig {
  /** Server port */
  port: number;
  /** Node environment */
  nodeEnv: string;
  /** API version prefix */
  apiVersion: string;
  /** Log level */
  logLevel: string;
}

/**
 * Application configuration settings
 */
export const appConfig: AppConfig = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiVersion: process.env.API_VERSION || 'v1',
  logLevel: process.env.LOG_LEVEL || 'info',
};

/**
 * File storage configuration interface
 */
interface FileStorageConfig {
  /** Storage type: 'local' or 's3' */
  type: string;
  /** Local storage path */
  localPath: string;
  /** AWS S3 bucket name */
  s3Bucket: string;
  /** AWS region */
  awsRegion: string;
}

/**
 * File storage configuration settings
 */
export const fileStorageConfig: FileStorageConfig = {
  type: process.env.FILE_STORAGE_TYPE || 'local',
  localPath: process.env.FILE_STORAGE_PATH || './uploads',
  s3Bucket: process.env.AWS_S3_BUCKET || '',
  awsRegion: process.env.AWS_REGION || 'ap-south-1',
};

/**
 * Email configuration interface
 */
interface EmailConfig {
  /** Resend API key */
  resendApiKey: string;
  /** From email address */
  fromEmail: string;
}

/**
 * Email configuration settings
 */
export const emailConfig: EmailConfig = {
  resendApiKey: process.env.RESEND_API_KEY || '',
  fromEmail: process.env.EMAIL_FROM || 'billing@billpromax.com',
};

/**
 * WhatsApp configuration interface
 */
interface WhatsAppConfig {
  /** WhatsApp API URL */
  apiUrl: string;
  /** Access token */
  accessToken: string;
  /** Phone number ID */
  phoneNumberId: string;
}

/**
 * WhatsApp configuration settings
 */
export const whatsAppConfig: WhatsAppConfig = {
  apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v17.0',
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
};

/**
 * Redis configuration interface
 */
interface RedisConfig {
  /** Redis connection URL */
  url: string;
}

/**
 * Redis configuration settings
 */
export const redisConfig: RedisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
};

export { databaseConfig, connectDatabase, disconnectDatabase, supabaseConfig };
