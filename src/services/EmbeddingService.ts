/**
 * @file Embedding Service
 * @description Thin wrapper around the OpenAI embeddings endpoint used for
 * semantic challan matching. Converts catalog text (inventory items, parties,
 * sites) and extracted challan text into vectors stored in / queried against
 * MongoDB Atlas Vector Search.
 *
 * Non-blocking by design: callers that embed on write should treat failures as
 * fire-and-forget (log + continue), mirroring the audit-logging pattern.
 */

import OpenAI from 'openai';
import crypto from 'crypto';
import { embeddingConfig } from '../config';
import { logger } from '../utils/logger';

export class EmbeddingService {
  private client: OpenAI | null = null;

  /** Lazily construct the client so missing keys don't crash boot. */
  private getClient(): OpenAI {
    if (!this.client) {
      if (!embeddingConfig.apiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
      }
      this.client = new OpenAI({ apiKey: embeddingConfig.apiKey });
    }
    return this.client;
  }

  /** True when an API key is present — guards optional embed-on-write paths. */
  isEnabled(): boolean {
    return Boolean(embeddingConfig.apiKey);
  }

  /** Stable hash of the source text, stored to skip re-embedding no-op updates. */
  static hashText(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  /**
   * Embed a single string. Returns a vector of length `embeddingConfig.dimensions`.
   */
  async embed(text: string): Promise<number[]> {
    const [vector] = await this.embedBatch([text]);
    return vector;
  }

  /**
   * Embed many strings in one request. Order of the result matches input order.
   * Empty/whitespace-only inputs are embedded as-is (OpenAI rejects empty
   * strings, so they're replaced with a single space).
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const input = texts.map((t) => (t && t.trim().length > 0 ? t : ' '));

    const response = await this.getClient().embeddings.create({
      model: embeddingConfig.model,
      input,
      dimensions: embeddingConfig.dimensions,
    });

    // API returns items with an `index`; sort to guarantee input alignment.
    return response.data
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding as number[]);
  }

  /**
   * Fire-and-forget embed: never throws. Returns the vector or null on failure.
   * Use from service write paths where embedding must not block the mutation.
   */
  async embedSafe(text: string): Promise<number[] | null> {
    try {
      if (!this.isEnabled()) return null;
      return await this.embed(text);
    } catch (error) {
      logger.error('Embedding failed (non-blocking):', error);
      return null;
    }
  }
}

/** Shared singleton — stateless aside from the lazy client. */
export const embeddingService = new EmbeddingService();
