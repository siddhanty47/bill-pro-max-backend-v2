/**
 * @file Business routes
 * @description API routes for business management
 */

import { Router } from 'express';
import { BusinessController } from '../../controllers';
import { authenticate } from '../../middleware/supabaseAuth';
import { validateBody } from '../../middleware/validation';
import { createBusinessSchema, updateBusinessSchema } from '../../types/api';

const router = Router();
const businessController = new BusinessController();

/**
 * All business routes require authentication
 * Note: These routes do NOT use businessScope middleware since they operate
 * on the business entity itself, not resources within a business
 */

/**
 * POST /businesses
 * Create a new business for the authenticated user
 */
router.post(
  '/',
  authenticate,
  validateBody(createBusinessSchema),
  businessController.createBusiness
);

/**
 * GET /businesses
 * Get all businesses for the authenticated user
 */
router.get('/', authenticate, businessController.getBusinesses);

/**
 * GET /businesses/:id
 * Get a specific business by ID
 */
router.get('/:id', authenticate, businessController.getBusinessById);

/**
 * PATCH /businesses/:id
 * Update a business (only owner can update)
 */
router.patch(
  '/:id',
  authenticate,
  validateBody(updateBusinessSchema),
  businessController.updateBusiness
);

/**
 * DELETE /businesses/:id
 * Delete a business (soft delete, only owner can delete)
 */
router.delete('/:id', authenticate, businessController.deleteBusiness);

export default router;
