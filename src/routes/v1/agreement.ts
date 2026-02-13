/**
 * @file Agreement routes
 * @description API routes for agreement management
 */

import { Router } from 'express';
import { PartyController } from '../../controllers';
import { authenticate, validateBusinessAccess, validateBody, requirePermission } from '../../middleware';
import { updateAgreementSchema, addAgreementRateSchema, updateAgreementRateSchema } from '../../types/api';

const router = Router({ mergeParams: true });
const partyController = new PartyController();

// Apply authentication and business access validation to all routes
router.use(authenticate, validateBusinessAccess);

/**
 * GET /businesses/:businessId/agreements
 * Get all agreements for a business
 */
router.get(
  '/',
  requirePermission('read', 'party'),
  partyController.getAllAgreements
);

/**
 * GET /businesses/:businessId/agreements/:agreementId
 * Get a specific agreement
 */
router.get(
  '/:agreementId',
  requirePermission('read', 'party'),
  partyController.getAgreementById
);

/**
 * PATCH /businesses/:businessId/agreements/:agreementId
 * Update an agreement
 */
router.patch(
  '/:agreementId',
  requirePermission('update', 'party'),
  validateBody(updateAgreementSchema),
  partyController.updateAgreement
);

/**
 * GET /businesses/:businessId/agreements/:agreementId/rates
 * Get all rates/items for an agreement
 */
router.get(
  '/:agreementId/rates',
  requirePermission('read', 'party'),
  partyController.getAgreementRates
);

/**
 * POST /businesses/:businessId/agreements/:agreementId/rates
 * Add an item/rate to an agreement
 */
router.post(
  '/:agreementId/rates',
  requirePermission('update', 'party'),
  validateBody(addAgreementRateSchema),
  partyController.addAgreementRate
);

/**
 * PATCH /businesses/:businessId/agreements/:agreementId/rates/:itemId
 * Update a rate in an agreement
 */
router.patch(
  '/:agreementId/rates/:itemId',
  requirePermission('update', 'party'),
  validateBody(updateAgreementRateSchema),
  partyController.updateAgreementRate
);

export default router;
