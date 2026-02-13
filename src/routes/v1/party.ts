/**
 * @file Party routes
 * @description API routes for party (clients/suppliers) management
 */

import { Router } from 'express';
import { PartyController } from '../../controllers';
import { authenticate, validateBusinessAccess, validateBody, requirePermission } from '../../middleware';
import { createPartySchema, updatePartySchema, createAgreementSchema, addSiteSchema } from '../../types/api';

const router = Router({ mergeParams: true });
const partyController = new PartyController();

// Apply authentication and business access validation to all routes
router.use(authenticate, validateBusinessAccess);

/**
 * GET /businesses/:businessId/parties
 * Get all parties for a business
 */
router.get(
  '/',
  requirePermission('read', 'party'),
  partyController.getParties
);

/**
 * GET /businesses/:businessId/parties/generate-code
 * Generate a party code for a given name
 */
router.get(
  '/generate-code',
  requirePermission('read', 'party'),
  partyController.generateCode
);

/**
 * GET /businesses/:businessId/parties/check-code
 * Check if a party code already exists
 */
router.get(
  '/check-code',
  requirePermission('read', 'party'),
  partyController.checkCodeExists
);

/**
 * POST /businesses/:businessId/parties
 * Create a new party
 */
router.post(
  '/',
  requirePermission('create', 'party'),
  validateBody(createPartySchema),
  partyController.createParty
);

/**
 * GET /businesses/:businessId/parties/:id
 * Get a specific party
 */
router.get(
  '/:id',
  requirePermission('read', 'party'),
  partyController.getPartyById
);

/**
 * PATCH /businesses/:businessId/parties/:id
 * Update a party
 */
router.patch(
  '/:id',
  requirePermission('update', 'party'),
  validateBody(updatePartySchema),
  partyController.updateParty
);

/**
 * DELETE /businesses/:businessId/parties/:id
 * Delete a party
 */
router.delete(
  '/:id',
  requirePermission('delete', 'party'),
  partyController.deleteParty
);

/**
 * POST /businesses/:businessId/parties/:id/agreements
 * Create an agreement for a party
 */
router.post(
  '/:id/agreements',
  requirePermission('create', 'party'),
  validateBody(createAgreementSchema),
  partyController.createAgreement
);

/**
 * POST /businesses/:businessId/parties/:id/sites
 * Add a site to a party
 */
router.post(
  '/:id/sites',
  requirePermission('update', 'party'),
  validateBody(addSiteSchema),
  partyController.addSite
);

export default router;
