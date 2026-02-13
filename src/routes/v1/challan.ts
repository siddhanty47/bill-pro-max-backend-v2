/**
 * @file Challan routes
 * @description API routes for challan (delivery/return) management
 */

import { Router } from 'express';
import { ChallanController } from '../../controllers';
import { authenticate, validateBusinessAccess, validateBody, requirePermission } from '../../middleware';
import { createChallanSchema, confirmChallanSchema } from '../../types/api';

const router = Router({ mergeParams: true });
const challanController = new ChallanController();

// Apply authentication and business access validation to all routes
router.use(authenticate, validateBusinessAccess);

/**
 * GET /businesses/:businessId/challans
 * Get all challans for a business
 */
router.get(
  '/',
  requirePermission('read', 'challan'),
  challanController.getChallans
);

/**
 * POST /businesses/:businessId/challans
 * Create a new challan
 */
router.post(
  '/',
  requirePermission('create', 'challan'),
  validateBody(createChallanSchema),
  challanController.createChallan
);

/**
 * GET /businesses/:businessId/challans/:id
 * Get a specific challan
 */
router.get(
  '/:id',
  requirePermission('read', 'challan'),
  challanController.getChallanById
);

/**
 * POST /businesses/:businessId/challans/:id/confirm
 * Confirm a challan
 */
router.post(
  '/:id/confirm',
  requirePermission('update', 'challan'),
  validateBody(confirmChallanSchema),
  challanController.confirmChallan
);

export default router;
