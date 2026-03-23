/**
 * @file Member Controller
 * @description HTTP request handlers for business member management.
 */

import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { BusinessMemberRepository } from '../repositories/BusinessMemberRepository';
import { BusinessScopedRequest, BusinessScopedUser } from '../middleware/businessScope';
import { ForbiddenError, NotFoundError } from '../middleware';
import { UserRole, UserRoles } from '../config/roles';
import { User } from '../models/User';
import { clearUserCache } from '../middleware/supabaseAuth';
import { logger } from '../utils/logger';

/**
 * Member Controller class.
 * Handles listing, updating roles, and removing members from a business.
 */
export class MemberController {
  private memberRepository: BusinessMemberRepository;

  constructor() {
    this.memberRepository = new BusinessMemberRepository();
  }

  /**
   * List all members of a business.
   * GET /businesses/:businessId/members
   */
  getMembers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req as BusinessScopedRequest;
      const members = await this.memberRepository.findByBusiness(businessId);

      res.status(200).json({
        success: true,
        data: members,
        message: 'Members retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update a member's role.
   * PATCH /businesses/:businessId/members/:memberId
   */
  updateMemberRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scopedReq = req as BusinessScopedRequest;
      const { memberId } = req.params;
      const { role } = req.body;

      if ((scopedReq.user as BusinessScopedUser).businessRole !== UserRoles.OWNER) {
        return next(new ForbiddenError('Only the business owner can change roles'));
      }

      const member = await this.memberRepository.findById(memberId);
      if (!member || member.businessId.toString() !== scopedReq.businessId) {
        return next(new NotFoundError('Member'));
      }

      if (member.role === UserRoles.OWNER) {
        return next(new ForbiddenError('Cannot change the owner role'));
      }

      const updated = await this.memberRepository.updateRole(memberId, role as UserRole);

      logger.info('Member role updated', {
        businessId: scopedReq.businessId,
        memberId,
        newRole: role,
      });

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Member role updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Remove a member from the business.
   * DELETE /businesses/:businessId/members/:memberId
   */
  removeMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scopedReq = req as BusinessScopedRequest;
      const { memberId } = req.params;

      if ((scopedReq.user as BusinessScopedUser).businessRole !== UserRoles.OWNER) {
        return next(new ForbiddenError('Only the business owner can remove members'));
      }

      const member = await this.memberRepository.findById(memberId);
      if (!member || member.businessId.toString() !== scopedReq.businessId) {
        return next(new NotFoundError('Member'));
      }

      if (member.role === UserRoles.OWNER) {
        return next(new ForbiddenError('Cannot remove the business owner'));
      }

      await this.memberRepository.deleteById(memberId);

      // Remove the businessId from the user's MongoDB record
      try {
        await User.findOneAndUpdate(
          { authProviderId: member.userId },
          { $pull: { businessIds: new Types.ObjectId(scopedReq.businessId) } }
        );
        clearUserCache(member.userId);
      } catch (dbError) {
        logger.error('Failed to update user businessIds after member removal', {
          memberId,
          userId: member.userId,
          error: dbError,
        });
      }

      logger.info('Member removed from business', {
        businessId: scopedReq.businessId,
        memberId,
        userId: member.userId,
      });

      res.status(200).json({
        success: true,
        message: 'Member removed successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}

export default MemberController;
