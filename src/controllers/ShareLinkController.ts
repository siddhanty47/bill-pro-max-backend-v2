/**
 * @file ShareLink Controller
 * @description HTTP request handlers for share link management and public portal.
 */

import { Request, Response, NextFunction } from 'express';
import { ShareLinkService } from '../services/ShareLinkService';
import { BusinessScopedRequest, BusinessScopedUser } from '../middleware/businessScope';
import { ForbiddenError } from '../middleware';
import { UserRoles } from '../config/keycloak';
import { logger } from '../utils/logger';

/**
 * ShareLink Controller class.
 * Handles business-scoped management endpoints and public portal endpoints.
 */
export class ShareLinkController {
  private shareLinkService: ShareLinkService;

  constructor() {
    this.shareLinkService = new ShareLinkService();
  }

  // ─── Management endpoints (authenticated, business-scoped) ─────────

  /**
   * Create a new share link for a party.
   * POST /businesses/:businessId/parties/:partyId/share-links
   */
  createShareLink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scopedReq = req as BusinessScopedRequest;
      const userRole = (scopedReq.user as BusinessScopedUser).businessRole;

      if (userRole !== UserRoles.OWNER && userRole !== UserRoles.MANAGER) {
        return next(new ForbiddenError('Only owners and managers can create share links'));
      }

      const { partyId } = req.params;
      const shareLink = await this.shareLinkService.createShareLink(
        scopedReq.businessId,
        partyId,
        req.body,
        scopedReq.user.id
      );

      res.status(201).json({
        success: true,
        data: shareLink,
        message: 'Share link created successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * List all share links for a party.
   * GET /businesses/:businessId/parties/:partyId/share-links
   */
  getShareLinks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req as BusinessScopedRequest;
      const { partyId } = req.params;
      const links = await this.shareLinkService.getShareLinks(businessId, partyId);

      res.status(200).json({
        success: true,
        data: links,
        message: 'Share links retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update a share link.
   * PATCH /businesses/:businessId/parties/:partyId/share-links/:linkId
   */
  updateShareLink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scopedReq = req as BusinessScopedRequest;
      const { linkId } = req.params;

      const updated = await this.shareLinkService.updateShareLink(
        linkId,
        scopedReq.businessId,
        req.body
      );

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Share link updated',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Revoke a share link.
   * DELETE /businesses/:businessId/parties/:partyId/share-links/:linkId
   */
  revokeShareLink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scopedReq = req as BusinessScopedRequest;
      const { linkId } = req.params;

      await this.shareLinkService.revokeShareLink(linkId, scopedReq.businessId);

      res.status(200).json({
        success: true,
        message: 'Share link revoked',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  // ─── Portal endpoints (public, no auth) ────────────────────────────

  /**
   * Get portal info (party name, business name, scope).
   * GET /share/:token
   */
  getPortalInfo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shareLink = await this.shareLinkService.resolveToken(req.params.token);
      const info = await this.shareLinkService.getPortalInfo(shareLink);

      res.status(200).json({
        success: true,
        data: info,
        message: 'Portal info retrieved',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get challans for the portal.
   * GET /share/:token/challans
   */
  getPortalChallans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shareLink = await this.shareLinkService.resolveToken(req.params.token);
      const filters = {
        type: req.query.type as 'delivery' | 'return' | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined,
      };
      const result = await this.shareLinkService.getPortalChallans(shareLink, filters);

      res.status(200).json({
        success: true,
        ...result,
        message: 'Portal challans retrieved',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get running items for the portal.
   * GET /share/:token/running-items
   */
  getPortalRunningItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shareLink = await this.shareLinkService.resolveToken(req.params.token);
      const items = await this.shareLinkService.getPortalRunningItems(shareLink);

      res.status(200).json({
        success: true,
        data: items,
        message: 'Portal running items retrieved',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get bills for the portal.
   * GET /share/:token/bills
   */
  getPortalBills = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shareLink = await this.shareLinkService.resolveToken(req.params.token);
      const filters = {
        status: req.query.status as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined,
      };
      const result = await this.shareLinkService.getPortalBills(shareLink, filters);

      res.status(200).json({
        success: true,
        ...result,
        message: 'Portal bills retrieved',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get aggregated summary for the portal.
   * GET /share/:token/summary
   */
  getPortalSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shareLink = await this.shareLinkService.resolveToken(req.params.token);
      const summary = await this.shareLinkService.getPortalSummary(shareLink);

      res.status(200).json({
        success: true,
        data: summary,
        message: 'Portal summary retrieved',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
  /**
   * Get payments for the portal.
   * GET /share/:token/payments
   */
  getPortalPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shareLink = await this.shareLinkService.resolveToken(req.params.token);
      const filters = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined,
      };
      const result = await this.shareLinkService.getPortalPayments(shareLink, filters);

      res.status(200).json({
        success: true,
        ...result,
        message: 'Portal payments retrieved',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Download challan PDF from portal.
   * GET /share/:token/challans/:challanId/pdf
   */
  getPortalChallanPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shareLink = await this.shareLinkService.resolveToken(req.params.token);
      const { buffer, challanNumber } = await this.shareLinkService.getPortalChallanPdf(
        shareLink,
        req.params.challanId
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="challan-${challanNumber}.pdf"`
      );
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Download bill PDF from portal.
   * GET /share/:token/bills/:billId/pdf
   */
  getPortalBillPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shareLink = await this.shareLinkService.resolveToken(req.params.token);
      const pdfBuffer = await this.shareLinkService.getPortalBillPdf(
        shareLink,
        req.params.billId
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="invoice-${req.params.billId}.pdf"`
      );
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  };
}

export default ShareLinkController;
