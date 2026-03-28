/**
 * @file AuditLog Controller
 * @description HTTP request handler for audit log retrieval
 */

import { Request, Response, NextFunction } from 'express';
import { AuditLogService } from '../services';
import { paginationSchema, auditLogParamsSchema } from '../types/api';
import { AuditDocumentType } from '../models';

/**
 * AuditLog Controller class
 */
export class AuditLogController {
  private auditLogService: AuditLogService;

  constructor() {
    this.auditLogService = new AuditLogService();
  }

  /**
   * Get audit history for a document
   */
  getDocumentHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { businessId } = req.params;
      const { documentType, documentId } = auditLogParamsSchema.parse(req.params);
      const pagination = paginationSchema.parse(req.query);

      const result = await this.auditLogService.getHistory(
        businessId,
        documentType as AuditDocumentType,
        documentId,
        pagination
      );

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        message: 'Audit history retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}
