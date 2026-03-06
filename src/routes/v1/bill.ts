/**
 * @file Bill routes
 * @description API routes for bill/invoice management
 */

import { Router } from 'express';
import { BillController } from '../../controllers';
import { authenticate, validateBusinessAccess, validateBody, requirePermission } from '../../middleware';
import { generateBillSchema, bulkGenerateBillSchema, updateBillStatusSchema } from '../../types/api';

const router = Router({ mergeParams: true });
const billController = new BillController();

// Apply authentication and business access validation to all routes
router.use(authenticate, validateBusinessAccess);

/**
 * GET /businesses/:businessId/bills
 * Get all bills for a business
 */
router.get(
  '/',
  requirePermission('read', 'bill'),
  billController.getBills
);

/**
 * POST /businesses/:businessId/bills/generate
 * Generate bills for a billing period
 */
router.post(
  '/generate',
  requirePermission('create', 'bill'),
  validateBody(generateBillSchema),
  billController.generateBill
);

/**
 * POST /businesses/:businessId/bills/bulk-generate
 * Bulk generate bills for multiple agreements
 */
router.post(
  '/bulk-generate',
  requirePermission('create', 'bill'),
  validateBody(bulkGenerateBillSchema),
  billController.bulkGenerateBills
);

/**
 * GET /businesses/:businessId/bills/overdue
 * Get overdue bills
 */
router.get(
  '/overdue',
  requirePermission('read', 'bill'),
  billController.getOverdueBills
);

/**
 * GET /businesses/:businessId/bills/payment-summary
 * Get payment summary
 */
router.get(
  '/payment-summary',
  requirePermission('read', 'bill'),
  billController.getPaymentSummary
);

/**
 * GET /businesses/:businessId/bills/:id/pdf
 * Download bill invoice PDF
 */
router.get(
  '/:id/pdf',
  requirePermission('read', 'bill'),
  billController.getBillPdf
);

/**
 * GET /businesses/:businessId/bills/:id
 * Get a specific bill
 */
router.get(
  '/:id',
  requirePermission('read', 'bill'),
  billController.getBillById
);

/**
 * PATCH /businesses/:businessId/bills/:id/status
 * Update bill status
 */
router.patch(
  '/:id/status',
  requirePermission('update', 'bill'),
  validateBody(updateBillStatusSchema),
  billController.updateBillStatus
);

/**
 * DELETE /businesses/:businessId/bills/:id
 * Delete a bill
 * Query param: force=true to delete bills with any status
 */
router.delete(
  '/:id',
  requirePermission('delete', 'bill'),
  billController.deleteBill
);

export default router;
