/**
 * @file Party routes
 * @description API routes for party (clients/suppliers) management
 */

import { Router } from 'express';
import { PartyController, StatementController } from '../../controllers';
import { authenticate, validateBusinessAccess, validateBody, validateQuery, requirePermission } from '../../middleware';
import { createPartySchema, updatePartySchema, createAgreementSchema, addSiteSchema, updateSiteSchema, statementQuerySchema } from '../../types/api';

const router = Router({ mergeParams: true });
const partyController = new PartyController();
const statementController = new StatementController();

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

/**
 * PATCH /businesses/:businessId/parties/:id/sites/:siteCode
 * Update an existing site on a party
 */
router.patch(
  '/:id/sites/:siteCode',
  requirePermission('update', 'party'),
  validateBody(updateSiteSchema),
  partyController.updateSite
);

/**
 * GET /businesses/:businessId/parties/:id/statements/pdf
 * Generate a party statement PDF
 */
router.get(
  '/:id/statements/pdf',
  requirePermission('read', 'party'),
  validateQuery(statementQuerySchema),
  statementController.getStatementPdf
);

/**
 * GET /businesses/:businessId/parties/:id/statements/data
 * Get party statement data as JSON for in-browser preview
 */
router.get(
  '/:id/statements/data',
  requirePermission('read', 'party'),
  validateQuery(statementQuerySchema),
  statementController.getStatementData
);

export default router;
