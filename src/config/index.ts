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

/**
 * Anthropic API configuration interface
 */
interface AnthropicConfig {
  /** Anthropic API key */
  apiKey: string;
  /** Model to use for vision extraction */
  model: string;
}

/**
 * Anthropic API configuration settings
 */
export const anthropicConfig: AnthropicConfig = {
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
};

/**
 * AI Assistant configuration interface
 */
interface AssistantConfig {
  /** Which LLM provider backs the conversational assistant */
  provider: 'anthropic' | 'openai';
  /** Model id for the assistant loop (reasoning + tool-use) */
  model: string;
  /** Max model tokens per assistant turn */
  maxTokens: number;
  /** Hard cap on tool-call iterations per user turn (runaway-loop guard) */
  maxToolIterations: number;
  /** How many prior conversation messages to send as context */
  historyWindow: number;
  /** OpenAI API key (only needed when provider = 'openai') */
  openaiApiKey: string;
}

/**
 * AI Assistant configuration settings.
 * Provider-abstracted: swap `ASSISTANT_PROVIDER` without touching the loop.
 */
export const assistantConfig: AssistantConfig = {
  provider: (process.env.ASSISTANT_PROVIDER as 'anthropic' | 'openai') || 'anthropic',
  // Default to the model the business already uses for vision (guaranteed account
  // access). Override with ASSISTANT_MODEL to a stronger reasoning model (e.g.
  // a Sonnet/Opus tier) once access is confirmed.
  model: process.env.ASSISTANT_MODEL || process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
  maxTokens: parseInt(process.env.ASSISTANT_MAX_TOKENS || '4096', 10),
  maxToolIterations: parseInt(process.env.ASSISTANT_MAX_TOOL_ITERATIONS || '8', 10),
  historyWindow: parseInt(process.env.ASSISTANT_HISTORY_WINDOW || '20', 10),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
};

/**
 * OpenAI embedding configuration interface
 */
interface EmbeddingConfig {
  /** OpenAI API key (used only for the embeddings endpoint) */
  apiKey: string;
  /** Embedding model name */
  model: string;
  /** Vector dimensions — MUST match the Atlas vector index numDimensions */
  dimensions: number;
}

/**
 * OpenAI embedding configuration settings.
 * Powers semantic challan matching (Atlas Vector Search).
 */
export const embeddingConfig: EmbeddingConfig = {
  apiKey: process.env.OPENAI_API_KEY || '',
  model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536', 10),
};

export { databaseConfig, connectDatabase, disconnectDatabase, supabaseConfig };
