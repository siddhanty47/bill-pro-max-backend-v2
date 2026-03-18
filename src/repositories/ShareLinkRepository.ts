/**
 * @file ShareLink Repository
 * @description Data access layer for share link operations.
 */

import { Types } from 'mongoose';
import { BaseRepository } from './BaseRepository';
import { ShareLink, IShareLink } from '../models/ShareLink';

/**
 * ShareLink repository class
 */
export class ShareLinkRepository extends BaseRepository<IShareLink> {
  constructor() {
    super(ShareLink);
  }

  /**
   * Find an active share link by its token
   * @param token - Share link token
   * @returns ShareLink or null
   */
  async findByToken(token: string): Promise<IShareLink | null> {
    return this.findOne({ token, status: 'active' });
  }

  /**
   * Find all share links for a party within a business
   * @param businessId - Business document ID
   * @param partyId - Party document ID
   * @returns Array of share links
   */
  async findByParty(
    businessId: string | Types.ObjectId,
    partyId: string | Types.ObjectId
  ): Promise<IShareLink[]> {
    return this.find({ businessId, partyId }, undefined, { sort: { createdAt: -1 } });
  }

  /**
   * Revoke a share link
   * @param linkId - ShareLink document ID
   * @returns Updated share link
   */
  async revokeLink(linkId: string | Types.ObjectId): Promise<IShareLink | null> {
    return this.updateById(linkId, { status: 'revoked' });
  }

  /**
   * Increment access count and update last accessed timestamp
   * @param linkId - ShareLink document ID
   * @returns Updated share link
   */
  async incrementAccessCount(linkId: string | Types.ObjectId): Promise<IShareLink | null> {
    return this.updateById(linkId, {
      $inc: { accessCount: 1 },
      $set: { lastAccessedAt: new Date() },
    });
  }
}

export default ShareLinkRepository;
