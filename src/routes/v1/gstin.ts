/**
 * @file GSTIN lookup routes
 * @description API routes for looking up GST registration details.
 * Provides both a standalone auth-only route (for business creation)
 * and a business-scoped route (for party creation).
 * The GSTIN lookup itself is universal — not business-specific.
 */

import { Router } from 'express';
import { GstinController } from '../../controllers';
import { authenticate } from '../../middleware';

const gstinController = new GstinController();

/**
 * Standalone GSTIN routes (auth-only, no business scope).
 * Mounted at /gstin — used by the BusinessForm when creating
 * a new business (no businessId available yet).
 *
 * GET /gstin/:gstinNumber
 */
export const standaloneGstinRouter = Router();
standaloneGstinRouter.use(authenticate);
standaloneGstinRouter.get('/:gstinNumber', gstinController.lookupGstin);

/**
 * Business-scoped GSTIN routes.
 * Mounted at /businesses/:businessId/gstin — used by the PartyForm.
 *
 * GET /businesses/:businessId/gstin/:gstinNumber
 */
const businessScopedGstinRouter = Router({ mergeParams: true });
businessScopedGstinRouter.use(authenticate);
businessScopedGstinRouter.get('/:gstinNumber', gstinController.lookupGstin);

export default businessScopedGstinRouter;
