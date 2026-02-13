/**
 * @file Payment routes
 * @description API routes for payment management
 */

import { Router } from 'express';
import { PaymentController } from '../../controllers';
import { authenticate, validateBusinessAccess, validateBody, requirePermission } from '../../middleware';
import { createPaymentSchema } from '../../types/api';

const router = Router({ mergeParams: true });
const paymentController = new PaymentController();

// Apply authentication and business access validation to all routes
router.use(authenticate, validateBusinessAccess);

/**
 * GET /businesses/:businessId/payments
 * Get all payments for a business
 */
router.get(
  '/',
  requirePermission('read', 'payment'),
  paymentController.getPayments
);

/**
 * POST /businesses/:businessId/payments
 * Record a new payment
 */
router.post(
  '/',
  requirePermission('create', 'payment'),
  validateBody(createPaymentSchema),
  paymentController.createPayment
);

/**
 * GET /businesses/:businessId/payments/stats
 * Get payment statistics
 */
router.get(
  '/stats',
  requirePermission('read', 'payment'),
  paymentController.getStats
);

/**
 * GET /businesses/:businessId/payments/:id
 * Get a specific payment
 */
router.get(
  '/:id',
  requirePermission('read', 'payment'),
  paymentController.getPaymentById
);

export default router;
