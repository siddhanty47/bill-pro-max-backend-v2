/**
 * @file AuditLog Repository
 * @description Repository for audit log operations
 */

import { Types } from 'mongoose';
import { BaseRepository, PaginationOptions, PaginatedResult } from './BaseRepository';
import { AuditLog, IAuditLog, AuditDocumentType } from '../models';

/**
 * AuditLog repository class
 */
export class AuditLogRepository extends BaseRepository<IAuditLog> {
  constructor() {
    super(AuditLog);
  }

  /**
   * Find audit logs for a specific document
   * @param businessId - Business ID
   * @param documentType - Type of entity
   * @param documentId - Document ID
   * @param pagination - Pagination options
   * @returns Paginated audit logs
   */
  async findByDocument(
    businessId: string | Types.ObjectId,
    documentType: AuditDocumentType,
    documentId: string | Types.ObjectId,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<IAuditLog>> {
    return this.findPaginated(
      {
        businessId: new Types.ObjectId(businessId.toString()),
        documentType,
        documentId: documentId.toString(),
      },
      { ...pagination, sortBy: 'createdAt', sortOrder: 'desc' }
    );
  }
}
