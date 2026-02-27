/**
 * @file Invitation Repository
 * @description Data access layer for invitation operations.
 */

import { Types } from 'mongoose';
import { BaseRepository } from './BaseRepository';
import { Invitation, IInvitation, InvitationStatus } from '../models/Invitation';

/**
 * Invitation repository class
 */
export class InvitationRepository extends BaseRepository<IInvitation> {
  constructor() {
    super(Invitation);
  }

  /**
   * Find all invitations for a business
   * @param businessId - Business document ID
   * @returns Array of invitations
   */
  async findByBusiness(businessId: string | Types.ObjectId): Promise<IInvitation[]> {
    return this.find({ businessId }, undefined, { sort: { createdAt: -1 } });
  }

  /**
   * Find a pending invitation by business + email
   * @param businessId - Business document ID
   * @param email - Invited email
   * @returns Invitation or null
   */
  async findPendingByBusinessAndEmail(
    businessId: string | Types.ObjectId,
    email: string
  ): Promise<IInvitation | null> {
    return this.findOne({
      businessId,
      email: email.toLowerCase(),
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });
  }

  /**
   * Find an invitation by its unique token
   * @param token - Invitation token (uuid)
   * @returns Invitation or null
   */
  async findByToken(token: string): Promise<IInvitation | null> {
    return this.findOne({ token });
  }

  /**
   * Find all pending invitations for an email address
   * @param email - User email
   * @returns Array of pending invitations
   */
  async findPendingByEmail(email: string): Promise<IInvitation[]> {
    return this.find({
      email: email.toLowerCase(),
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });
  }

  /**
   * Update invitation status
   * @param invitationId - Invitation document ID
   * @param status - New status
   * @returns Updated invitation
   */
  async updateStatus(
    invitationId: string | Types.ObjectId,
    status: InvitationStatus
  ): Promise<IInvitation | null> {
    return this.updateById(invitationId, { status });
  }
}

export default InvitationRepository;
