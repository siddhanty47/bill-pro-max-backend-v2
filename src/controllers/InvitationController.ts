/**
 * @file Invitation Controller
 * @description HTTP request handlers for business invitation management.
 */

import { Request, Response, NextFunction } from 'express';
import { InvitationService } from '../services/InvitationService';
import { BusinessScopedRequest, BusinessScopedUser } from '../middleware/businessScope';
import { AuthenticatedRequest } from '../middleware';
import { ForbiddenError } from '../middleware';
import { UserRoles } from '../config/keycloak';
import { logger } from '../utils/logger';

/**
 * Invitation Controller class.
 * Handles both business-scoped endpoints (create, list, cancel)
 * and public/authenticated endpoints (verify, accept, decline).
 */
export class InvitationController {
  private invitationService: InvitationService;

  constructor() {
    this.invitationService = new InvitationService();
  }

  /**
   * Create a new invitation.
   * POST /businesses/:businessId/invitations
   */
  createInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scopedReq = req as BusinessScopedRequest;
      const userRole = (scopedReq.user as BusinessScopedUser).businessRole;

      if (userRole !== UserRoles.OWNER && userRole !== UserRoles.MANAGER) {
        return next(new ForbiddenError('Only owners and managers can invite members'));
      }

      const invitation = await this.invitationService.createInvitation(
        scopedReq.businessId,
        req.body,
        scopedReq.user.id,
        scopedReq.user.name || scopedReq.user.email
      );

      res.status(201).json({
        success: true,
        data: invitation,
        message: 'Invitation sent successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * List all invitations for a business.
   * GET /businesses/:businessId/invitations
   */
  getInvitations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req as BusinessScopedRequest;
      const invitations = await this.invitationService.getInvitations(businessId);

      res.status(200).json({
        success: true,
        data: invitations,
        message: 'Invitations retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update an invitation's role.
   * PATCH /businesses/:businessId/invitations/:id
   */
  updateInvitationRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scopedReq = req as BusinessScopedRequest;
      const { id } = req.params;

      if ((scopedReq.user as BusinessScopedUser).businessRole !== UserRoles.OWNER) {
        return next(new ForbiddenError('Only the business owner can update invitation roles'));
      }

      const updated = await this.invitationService.updateInvitationRole(
        id,
        scopedReq.businessId,
        req.body.role
      );

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Invitation role updated',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Cancel a pending invitation.
   * DELETE /businesses/:businessId/invitations/:id
   */
  cancelInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scopedReq = req as BusinessScopedRequest;
      const { id } = req.params;

      if ((scopedReq.user as BusinessScopedUser).businessRole !== UserRoles.OWNER) {
        return next(new ForbiddenError('Only the business owner can cancel invitations'));
      }

      await this.invitationService.cancelInvitation(id, scopedReq.businessId);

      res.status(200).json({
        success: true,
        message: 'Invitation cancelled',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Verify an invitation token (public endpoint).
   * GET /invitations/verify/:token
   */
  verifyInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.params;
      const invitation = await this.invitationService.verifyInvitation(token);

      res.status(200).json({
        success: true,
        data: invitation,
        message: 'Invitation is valid',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Accept an invitation.
   * POST /invitations/:token/accept
   */
  acceptInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { token } = req.params;

      await this.invitationService.acceptInvitation(
        token,
        authReq.user.id,
        authReq.user.email,
        authReq.user.name
      );

      res.status(200).json({
        success: true,
        message: 'Invitation accepted. You now have access to the business.',
        tokenRefreshRequired: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Decline an invitation.
   * POST /invitations/:token/decline
   */
  declineInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { token } = req.params;

      await this.invitationService.declineInvitation(
        token,
        authReq.user.id,
        authReq.user.email
      );

      res.status(200).json({
        success: true,
        message: 'Invitation declined',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}

export default InvitationController;
