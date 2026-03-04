/**
 * @file Challan routes
 * @description API routes for challan (delivery/return) management
 */

import { Router } from 'express';
import { ChallanController } from '../../controllers';
import { authenticate, validateBusinessAccess, validateBody, requirePermission } from '../../middleware';
import {
  createChallanSchema,
  confirmChallanSchema,
  updateChallanTransportationSchema,
  updateChallanItemSchema,
  addChallanItemSchema,
  updateChallanDamagedItemsSchema,
} from '../../types/api';

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
 * GET /businesses/:businessId/challans/next-number?type=delivery&date=2025-01-01
 * Predict the next challan number for a given type and financial year
 */
router.get(
  '/next-number',
  requirePermission('read', 'challan'),
  challanController.getNextChallanNumber
);

/**
 * GET /businesses/:businessId/challans/items-with-party/:partyId?agreementId=...
 * Get items currently with a party, optionally filtered by agreement
 */
router.get(
  '/items-with-party/:partyId',
  requirePermission('read', 'challan'),
  challanController.getItemsWithParty
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

/**
 * PATCH /businesses/:businessId/challans/:id/items/:itemId
 * Update a challan item's quantity
 */
router.patch(
  '/:id/items/:itemId',
  requirePermission('update', 'challan'),
  validateBody(updateChallanItemSchema),
  challanController.updateChallanItem
);

/**
 * POST /businesses/:businessId/challans/:id/items
 * Add an item to a challan
 */
router.post(
  '/:id/items',
  requirePermission('update', 'challan'),
  validateBody(addChallanItemSchema),
  challanController.addChallanItem
);

/**
 * DELETE /businesses/:businessId/challans/:id/items/:itemId
 * Delete an item from a challan
 */
router.delete(
  '/:id/items/:itemId',
  requirePermission('update', 'challan'),
  challanController.deleteChallanItem
);

/**
 * PATCH /businesses/:businessId/challans/:id/transportation
 * Update transportation fields for a challan
 */
router.patch(
  '/:id/transportation',
  requirePermission('update', 'challan'),
  validateBody(updateChallanTransportationSchema),
  challanController.updateChallanTransportation
);

/**
 * PUT /businesses/:businessId/challans/:id/damaged-items
 * Replace damaged items on a return challan
 */
router.put(
  '/:id/damaged-items',
  requirePermission('update', 'challan'),
  validateBody(updateChallanDamagedItemsSchema),
  challanController.updateChallanDamagedItems
);

export default router;
