/**
 * @file Batch Tracker
 * @description Redis-based tracking for bulk bill generation batches.
 * Uses INCR/GET on Redis keys to track progress without race conditions.
 */

import Redis from 'ioredis';
import { redisConfig } from '../config';

const BATCH_TTL_SECONDS = 3600; // 1 hour

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    const isTls = redisConfig.url.startsWith('rediss://');
    redis = new Redis(redisConfig.url, {
      maxRetriesPerRequest: 3,
      ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
    });
  }
  return redis;
}

function key(batchId: string, field: string): string {
  return `batch:${batchId}:${field}`;
}

export async function initBatch(batchId: string, total: number): Promise<void> {
  const r = getRedis();
  const pipeline = r.pipeline();
  pipeline.set(key(batchId, 'total'), total, 'EX', BATCH_TTL_SECONDS);
  pipeline.set(key(batchId, 'completed'), 0, 'EX', BATCH_TTL_SECONDS);
  pipeline.set(key(batchId, 'failed'), 0, 'EX', BATCH_TTL_SECONDS);
  await pipeline.exec();
}

export async function incrementCompleted(batchId: string): Promise<number> {
  return getRedis().incr(key(batchId, 'completed'));
}

export async function incrementFailed(batchId: string): Promise<number> {
  return getRedis().incr(key(batchId, 'failed'));
}

export interface BatchStatus {
  total: number;
  completed: number;
  failed: number;
  isDone: boolean;
}

export async function getBatchStatus(batchId: string): Promise<BatchStatus> {
  const r = getRedis();
  const [total, completed, failed] = await Promise.all([
    r.get(key(batchId, 'total')),
    r.get(key(batchId, 'completed')),
    r.get(key(batchId, 'failed')),
  ]);
  const t = parseInt(total || '0', 10);
  const c = parseInt(completed || '0', 10);
  const f = parseInt(failed || '0', 10);
  return { total: t, completed: c, failed: f, isDone: c + f >= t };
}

export async function closeBatchTracker(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
