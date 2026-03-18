/**
 * @file ShareLink routes
 * @description Routes for share link management and public portal.
 * Business-scoped routes are mounted under /businesses/:businessId/parties/:partyId/share-links.
 * Public portal routes are mounted at /share.
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ShareLinkController } from '../../controllers/ShareLinkController';
import { authenticate, validateBusinessAccess } from '../../middleware';

const shareLinkController = new ShareLinkController();

/**
 * Rate limiter for public share portal routes.
 * 60 requests per minute per IP.
 */
const portalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
    },
  },
  standardHeaders: true,
});

/**
 * Business-scoped share link routes (authenticated).
 * Mounted at: /businesses/:businessId/parties/:partyId/share-links
 */
export const businessShareLinkRouter = Router({ mergeParams: true });
businessShareLinkRouter.use(authenticate, validateBusinessAccess);

businessShareLinkRouter.post('/', shareLinkController.createShareLink);
businessShareLinkRouter.get('/', shareLinkController.getShareLinks);
businessShareLinkRouter.patch('/:linkId', shareLinkController.updateShareLink);
businessShareLinkRouter.delete('/:linkId', shareLinkController.revokeShareLink);

/**
 * Public share portal routes (no auth required).
 * Mounted at: /share
 */
export const standaloneShareRouter = Router();
standaloneShareRouter.use(portalRateLimiter);

standaloneShareRouter.get('/:token', shareLinkController.getPortalInfo);
standaloneShareRouter.get('/:token/challans', shareLinkController.getPortalChallans);
standaloneShareRouter.get('/:token/running-items', shareLinkController.getPortalRunningItems);
standaloneShareRouter.get('/:token/bills', shareLinkController.getPortalBills);
standaloneShareRouter.get('/:token/payments', shareLinkController.getPortalPayments);
standaloneShareRouter.get('/:token/challans/:challanId/pdf', shareLinkController.getPortalChallanPdf);
standaloneShareRouter.get('/:token/bills/:billId/pdf', shareLinkController.getPortalBillPdf);
standaloneShareRouter.get('/:token/summary', shareLinkController.getPortalSummary);
