/**
 * @file Business Repository
 * @description Repository for business entity operations
 */

import { Types } from 'mongoose';
import { BaseRepository } from './BaseRepository';
import { Business, IBusiness } from '../models';

/**
 * Business repository class
 */
export class BusinessRepository extends BaseRepository<IBusiness> {
  constructor() {
    super(Business);
  }

  /**
   * Find businesses by owner user ID
   * @param ownerUserId - Keycloak user ID
   * @returns Array of businesses
   */
  async findByOwner(ownerUserId: string): Promise<IBusiness[]> {
    return this.find({ ownerUserId, isActive: true });
  }

  /**
   * Find businesses by IDs
   * @param ids - Array of business IDs
   * @returns Array of businesses
   */
  async findByIds(ids: (string | Types.ObjectId)[]): Promise<IBusiness[]> {
    return this.find({
      _id: { $in: ids },
      isActive: true,
    });
  }

  /**
   * Find business by domain
   * @param domain - Business domain
   * @returns Business or null
   */
  async findByDomain(domain: string): Promise<IBusiness | null> {
    return this.findOne({ domain: domain.toLowerCase(), isActive: true });
  }

  /**
   * Update business settings
   * @param businessId - Business ID
   * @param settings - Partial settings to update
   * @returns Updated business
   */
  async updateSettings(
    businessId: string | Types.ObjectId,
    settings: Partial<IBusiness['settings']>
  ): Promise<IBusiness | null> {
    const updateFields: Record<string, unknown> = {};
    
    Object.entries(settings).forEach(([key, value]) => {
      updateFields[`settings.${key}`] = value;
    });

    return this.updateById(businessId, { $set: updateFields });
  }

  /**
   * Soft delete business (mark as inactive)
   * @param businessId - Business ID
   * @returns Updated business
   */
  async softDelete(businessId: string | Types.ObjectId): Promise<IBusiness | null> {
    return this.updateById(businessId, { isActive: false });
  }
}

export default BusinessRepository;
