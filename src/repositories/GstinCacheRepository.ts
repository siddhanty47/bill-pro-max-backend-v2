/**
 * @file GSTIN Cache Repository
 * @description Data access layer for GSTIN cache operations.
 */

import { BaseRepository } from './BaseRepository';
import { GstinCache, IGstinCache, CACHE_TTL_MS } from '../models/GstinCache';
import { GstinDetails } from '../services/GstinService';

/**
 * GSTIN Cache repository class
 */
export class GstinCacheRepository extends BaseRepository<IGstinCache> {
  constructor() {
    super(GstinCache);
  }

  /**
   * Find a cached GSTIN entry by its number
   * @param gstin - The GSTIN number to look up
   * @returns Cached entry or null
   */
  async findByGstin(gstin: string): Promise<IGstinCache | null> {
    return this.findOne({ gstin: gstin.toUpperCase().trim() });
  }

  /**
   * Insert or update a cached GSTIN entry with a fresh TTL
   * @param gstin - The GSTIN number
   * @param details - The GSTIN details to cache
   * @returns The upserted cache document
   */
  async upsertCache(gstin: string, details: GstinDetails): Promise<IGstinCache> {
    const normalizedGstin = gstin.toUpperCase().trim();
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);

    const result = await GstinCache.findOneAndUpdate(
      { gstin: normalizedGstin },
      { gstin: normalizedGstin, details, expiresAt },
      { upsert: true, new: true }
    );

    return result;
  }

  /**
   * Refresh the TTL on a cached entry (extend expiry by 30 days from now)
   * @param id - The document ID
   * @returns Updated document or null
   */
  async refreshTtl(id: string): Promise<IGstinCache | null> {
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
    return this.updateById(id, { expiresAt });
  }
}

export default GstinCacheRepository;
