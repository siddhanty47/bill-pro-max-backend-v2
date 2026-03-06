/**
 * @file Business Service
 * @description Business logic for business/tenant management
 */

import { Types } from 'mongoose';
import { BusinessRepository } from '../repositories';
import { BusinessMemberRepository } from '../repositories/BusinessMemberRepository';
import { IBusiness, IBusinessSettings } from '../models';
import { KeycloakAdminService } from './KeycloakAdminService';
import { NotFoundError, ConflictError, ForbiddenError } from '../middleware';
import { UserRoles } from '../config/keycloak';
import { logger } from '../utils/logger';

/**
 * Create business input
 */
export interface CreateBusinessInput {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  gst?: string;
  stateCode?: string;
  settings?: Partial<IBusinessSettings>;
}

/**
 * Update business input
 */
export interface UpdateBusinessInput {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  gst?: string;
  stateCode?: string;
  logo?: string;
  settings?: Partial<IBusinessSettings>;
}

/**
 * Business creation result
 */
export interface BusinessCreationResult {
  business: IBusiness;
  tokenRefreshRequired: boolean;
}

/**
 * Business Service class
 * Handles business creation, updates, and Keycloak integration
 */
export class BusinessService {
  private businessRepository: BusinessRepository;
  private businessMemberRepository: BusinessMemberRepository;
  private keycloakAdminService: KeycloakAdminService;

  constructor() {
    this.businessRepository = new BusinessRepository();
    this.businessMemberRepository = new BusinessMemberRepository();
    this.keycloakAdminService = new KeycloakAdminService();
  }

  /**
   * Create a new business for a user
   * Creates the business in MongoDB and updates the user's businessIds in Keycloak
   * @param userId - Keycloak user ID (from JWT sub claim)
   * @param input - Business data
   * @returns Created business and token refresh flag
   */
  async createBusiness(userId: string, input: CreateBusinessInput): Promise<BusinessCreationResult> {
    // Check for duplicate business name for this owner
    const existingBusinesses = await this.businessRepository.findByOwner(userId);
    const duplicateName = existingBusinesses.find(
      b => b.name.toLowerCase() === input.name.toLowerCase()
    );

    if (duplicateName) {
      throw new ConflictError('You already have a business with this name');
    }

    // Create business in MongoDB
    const defaultTaxRate = input.settings?.defaultTaxRate ?? 18;
    const defaultSgstRate = input.settings?.defaultSgstRate ?? defaultTaxRate / 2;
    const defaultCgstRate = input.settings?.defaultCgstRate ?? defaultTaxRate / 2;
    const defaultIgstRate = input.settings?.defaultIgstRate ?? defaultTaxRate;

    const business = await this.businessRepository.create({
      name: input.name,
      ownerUserId: userId,
      address: input.address,
      phone: input.phone,
      email: input.email,
      gst: input.gst,
      stateCode: input.stateCode,
      settings: {
        billingCycle: input.settings?.billingCycle || 'monthly',
        currency: input.settings?.currency || 'INR',
        defaultTaxRate,
        defaultSgstRate,
        defaultCgstRate,
        defaultIgstRate,
        defaultPaymentDueDays: input.settings?.defaultPaymentDueDays ?? 15,
        notifications: {
          email: input.settings?.notifications?.email ?? true,
          whatsapp: input.settings?.notifications?.whatsapp ?? false,
        },
      },
      isActive: true,
    });

    const businessId = business._id.toString();

    // Create BusinessMember record for the owner
    try {
      await this.businessMemberRepository.create({
        businessId: business._id,
        userId,
        email: input.email || '',
        role: UserRoles.OWNER,
        joinedAt: new Date(),
      } as Partial<import('../models/BusinessMember').IBusinessMember>);
    } catch (memberError) {
      logger.warn('Failed to create BusinessMember for owner', { businessId, userId, error: memberError });
    }

    // Update Keycloak user's businessIds attribute
    try {
      await this.keycloakAdminService.addBusinessIdToUser(userId, businessId);

      // If this is the user's first business, assign owner role
      if (existingBusinesses.length === 0) {
        try {
          await this.keycloakAdminService.assignRoleToUser(userId, 'owner');
        } catch (roleError) {
          // Log but don't fail - role might already exist
          logger.warn('Failed to assign owner role (may already exist)', { userId, error: roleError });
        }
      }
    } catch (keycloakError) {
      // If Keycloak update fails, we should still return the business
      // but log the error and indicate manual intervention may be needed
      logger.error('Failed to update Keycloak after business creation', {
        businessId,
        userId,
        error: keycloakError,
      });
    }

    logger.info('Business created', {
      businessId,
      userId,
      name: business.name,
    });

    return {
      business,
      tokenRefreshRequired: true,
    };
  }

  /**
   * Get businesses for a user by their business IDs
   * @param businessIds - Array of business IDs from JWT
   * @returns Array of businesses
   */
  async getBusinessesForUser(businessIds: string[]): Promise<IBusiness[]> {
    if (!businessIds.length) {
      return [];
    }

    const objectIds = businessIds
      .filter(id => Types.ObjectId.isValid(id))
      .map(id => new Types.ObjectId(id));

    return this.businessRepository.findByIds(objectIds);
  }

  /**
   * Get a business by ID
   * @param businessId - Business ID
   * @returns Business
   */
  async getBusinessById(businessId: string): Promise<IBusiness> {
    const business = await this.businessRepository.findById(businessId);

    if (!business || !business.isActive) {
      throw new NotFoundError('Business');
    }

    return business;
  }

  /**
   * Update a business
   * @param businessId - Business ID
   * @param userId - User ID making the update (for authorization)
   * @param input - Update data
   * @returns Updated business
   */
  async updateBusiness(
    businessId: string,
    userId: string,
    input: UpdateBusinessInput
  ): Promise<IBusiness> {
    const business = await this.getBusinessById(businessId);

    // Only owner can update business
    if (business.ownerUserId !== userId) {
      throw new ForbiddenError('Only the business owner can update business settings');
    }

    const updateData: Partial<IBusiness> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.gst !== undefined) updateData.gst = input.gst;
    if (input.stateCode !== undefined) updateData.stateCode = input.stateCode;
    if (input.logo !== undefined) updateData.logo = input.logo;

    // Handle settings update
    if (input.settings) {
      updateData.settings = {
        ...business.settings,
        ...input.settings,
        notifications: {
          ...business.settings.notifications,
          ...input.settings.notifications,
        },
      };
    }

    const updated = await this.businessRepository.updateById(businessId, updateData);

    if (!updated) {
      throw new NotFoundError('Business');
    }

    logger.info('Business updated', { businessId, userId });

    return updated;
  }

  /**
   * Delete a business (soft delete)
   * @param businessId - Business ID
   * @param userId - User ID making the deletion (for authorization)
   */
  async deleteBusiness(businessId: string, userId: string): Promise<void> {
    const business = await this.getBusinessById(businessId);

    // Only owner can delete business
    if (business.ownerUserId !== userId) {
      throw new ForbiddenError('Only the business owner can delete the business');
    }

    // Soft delete the business
    await this.businessRepository.softDelete(businessId);

    // Remove businessId from owner's Keycloak attributes
    try {
      await this.keycloakAdminService.removeBusinessIdFromUser(userId, businessId);
    } catch (keycloakError) {
      logger.error('Failed to update Keycloak after business deletion', {
        businessId,
        userId,
        error: keycloakError,
      });
    }

    logger.info('Business deleted', { businessId, userId });
  }

  /**
   * Check if a user has access to a business
   * @param businessId - Business ID
   * @param userBusinessIds - Business IDs from user's JWT
   * @returns True if user has access
   */
  hasAccess(businessId: string, userBusinessIds: string[]): boolean {
    return userBusinessIds.includes(businessId);
  }

  /**
   * Get businesses owned by a user
   * @param userId - Owner user ID
   * @returns Array of owned businesses
   */
  async getOwnedBusinesses(userId: string): Promise<IBusiness[]> {
    return this.businessRepository.findByOwner(userId);
  }
}

export default BusinessService;
