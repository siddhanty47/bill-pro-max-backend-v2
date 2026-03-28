/**
 * @file Business Controller
 * @description HTTP request handlers for business management
 */

import { Request, Response, NextFunction } from 'express';
import { BusinessService } from '../services';
import { BusinessMemberRepository } from '../repositories/BusinessMemberRepository';
import { AuthenticatedRequest } from '../middleware';
import { AuditPerformer } from '../types/api';
import { logger } from '../utils/logger';

/**
 * Business Controller class
 * Handles HTTP requests for business CRUD operations
 */
export class BusinessController {
  private businessService: BusinessService;
  private memberRepository: BusinessMemberRepository;

  constructor() {
    this.businessService = new BusinessService();
    this.memberRepository = new BusinessMemberRepository();
  }

  /**
   * Create a new business
   * POST /businesses
   */
  createBusiness = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;

      const result = await this.businessService.createBusiness(userId, req.body);

      res.status(201).json({
        success: true,
        data: result.business,
        message: 'Business created successfully. Please refresh your session to access the new business.',
        tokenRefreshRequired: result.tokenRefreshRequired,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all businesses for the authenticated user
   * GET /businesses
   */
  getBusinesses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { businessIds, id: userId } = authReq.user;

      // Get businesses the user has access to via their JWT
      const accessibleBusinesses = await this.businessService.getBusinessesForUser(businessIds);

      // Also get businesses the user owns (in case they were just created and not in JWT yet)
      const ownedBusinesses = await this.businessService.getOwnedBusinesses(userId);

      // Get businesses the user is a member of via BusinessMember records
      // (covers accepted invitations even before the JWT is refreshed)
      const memberships = await this.memberRepository.findByUser(userId);
      const memberBusinessIds = memberships.map((m) => m.businessId.toString());
      const memberBusinesses = memberBusinessIds.length > 0
        ? await this.businessService.getBusinessesForUser(memberBusinessIds)
        : [];

      // Merge and deduplicate
      const businessMap = new Map<string, typeof accessibleBusinesses[0]>();

      for (const business of accessibleBusinesses) {
        businessMap.set(business._id.toString(), business);
      }

      for (const business of ownedBusinesses) {
        if (!businessMap.has(business._id.toString())) {
          businessMap.set(business._id.toString(), business);
        }
      }

      for (const business of memberBusinesses) {
        if (!businessMap.has(business._id.toString())) {
          businessMap.set(business._id.toString(), business);
        }
      }

      const businesses = Array.from(businessMap.values());

      res.status(200).json({
        success: true,
        data: businesses,
        message: 'Businesses retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get a specific business by ID
   * GET /businesses/:id
   */
  getBusinessById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      const { businessIds, id: userId } = authReq.user;

      const business = await this.businessService.getBusinessById(id);

      // Check if user has access to this business
      const hasAccess =
        this.businessService.hasAccess(id, businessIds) || business.ownerUserId === userId;

      if (!hasAccess) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have access to this business',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: business,
        message: 'Business retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update a business
   * PATCH /businesses/:id
   */
  updateBusiness = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      const userId = authReq.user.id;
      const performer: AuditPerformer = { userId: authReq.user.id, name: authReq.user.name };

      const business = await this.businessService.updateBusiness(id, userId, req.body, performer);

      res.status(200).json({
        success: true,
        data: business,
        message: 'Business updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete a business (soft delete)
   * DELETE /businesses/:id
   */
  deleteBusiness = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;
      const userId = authReq.user.id;

      await this.businessService.deleteBusiness(id, userId);

      res.status(200).json({
        success: true,
        message: 'Business deleted successfully',
        tokenRefreshRequired: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}

export default BusinessController;
