/**
 * @file BusinessMember Repository
 * @description Data access layer for business member operations.
 */

import { Types } from 'mongoose';
import { BaseRepository } from './BaseRepository';
import { BusinessMember, IBusinessMember } from '../models/BusinessMember';
import { UserRole } from '../config/keycloak';

/**
 * BusinessMember repository class
 */
export class BusinessMemberRepository extends BaseRepository<IBusinessMember> {
  constructor() {
    super(BusinessMember);
  }

  /**
   * Find all members of a business
   * @param businessId - Business document ID
   * @returns Array of business members
   */
  async findByBusiness(businessId: string | Types.ObjectId): Promise<IBusinessMember[]> {
    return this.find({ businessId }, undefined, { sort: { role: 1, joinedAt: 1 } });
  }

  /**
   * Find a member by business and user ID
   * @param businessId - Business document ID
   * @param userId - Keycloak user ID
   * @returns BusinessMember or null
   */
  async findByBusinessAndUser(
    businessId: string | Types.ObjectId,
    userId: string
  ): Promise<IBusinessMember | null> {
    return this.findOne({ businessId, userId });
  }

  /**
   * Find all business memberships for a user
   * @param userId - Keycloak user ID
   * @returns Array of business members
   */
  async findByUser(userId: string): Promise<IBusinessMember[]> {
    return this.find({ userId });
  }

  /**
   * Update a member's role
   * @param memberId - BusinessMember document ID
   * @param role - New role
   * @returns Updated business member
   */
  async updateRole(
    memberId: string | Types.ObjectId,
    role: UserRole
  ): Promise<IBusinessMember | null> {
    return this.updateById(memberId, { role });
  }

  /**
   * Check if a user is a member of a business
   * @param businessId - Business document ID
   * @param userId - Keycloak user ID
   * @returns True if the user is a member
   */
  async isMember(businessId: string | Types.ObjectId, userId: string): Promise<boolean> {
    return this.exists({ businessId, userId });
  }
}

export default BusinessMemberRepository;
