/**
 * @file AuditLog routes
 * @description API routes for document audit history
 */

import { Router } from 'express';
import { AuditLogController } from '../../controllers';
import { authenticate, validateBusinessAccess } from '../../middleware';

const router = Router({ mergeParams: true });
const auditLogController = new AuditLogController();

// Apply authentication and business access validation to all routes
router.use(authenticate, validateBusinessAccess);

/**
 * GET /businesses/:businessId/audit-logs/:documentType/:documentId
 * Get audit history for a specific document
 */
router.get(
  '/:documentType/:documentId',
  auditLogController.getDocumentHistory
);

export default router;
