/**
 * @file AuditLog Service
 * @description Business logic for audit logging and object diffing
 */

import { AuditLogRepository } from '../repositories';
import { IAuditLog, IFieldChange, IAuditPerformer, AuditDocumentType, AuditAction } from '../models';
import { PaginationOptions, PaginatedResult } from '../repositories';
import { logger } from '../utils/logger';

/**
 * Parameters for logging a change
 */
export interface LogChangeParams {
  businessId: string;
  documentId: string;
  documentType: AuditDocumentType;
  action: AuditAction;
  changes: IFieldChange[];
  performedBy: IAuditPerformer;
}

/** Fields to always skip when diffing */
const SKIP_FIELDS = new Set([
  '_id',
  'id',
  '__v',
  'createdAt',
  'updatedAt',
  'businessId',
]);

/**
 * AuditLog Service class
 */
export class AuditLogService {
  private auditLogRepository: AuditLogRepository;

  constructor() {
    this.auditLogRepository = new AuditLogRepository();
  }

  /**
   * Log a document change (fire-and-forget — errors are caught and logged)
   */
  logChange(params: LogChangeParams): void {
    this.auditLogRepository
      .create({
        businessId: params.businessId as any,
        documentId: params.documentId as any,
        documentType: params.documentType,
        action: params.action,
        changes: params.changes,
        performedBy: params.performedBy,
      })
      .catch((err) => {
        logger.error('Failed to write audit log', {
          error: err.message,
          documentType: params.documentType,
          documentId: params.documentId,
          action: params.action,
        });
      });
  }

  /**
   * Get paginated audit history for a document
   */
  async getHistory(
    businessId: string,
    documentType: AuditDocumentType,
    documentId: string,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<IAuditLog>> {
    return this.auditLogRepository.findByDocument(
      businessId,
      documentType,
      documentId,
      pagination
    );
  }

  /**
   * Diff two plain objects and return field-level changes.
   *
   * @param oldDoc - The document before the update (Mongoose doc or plain object)
   * @param newDoc - The document after the update (Mongoose doc or plain object)
   * @param trackedFields - Optional whitelist of top-level fields to track.
   *                        If omitted, all fields on newDoc are compared.
   * @returns Array of field changes (only fields that actually changed)
   */
  static diffObjects(
    oldDoc: Record<string, any>,
    newDoc: Record<string, any>,
    trackedFields?: string[]
  ): IFieldChange[] {
    const old = toPlain(oldDoc);
    const updated = toPlain(newDoc);
    const changes: IFieldChange[] = [];

    const fields = trackedFields ?? Object.keys(updated);

    for (const field of fields) {
      if (SKIP_FIELDS.has(field)) continue;

      const oldVal = old[field];
      const newVal = updated[field];

      if (!deepEqual(oldVal, newVal)) {
        changes.push({
          field,
          oldValue: serialize(oldVal),
          newValue: serialize(newVal),
        });
      }
    }

    return changes;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Convert a Mongoose document or plain object to a plain JS object.
 */
function toPlain(doc: Record<string, any>): Record<string, any> {
  if (doc && typeof doc.toObject === 'function') {
    return doc.toObject({ virtuals: false });
  }
  return doc;
}

/**
 * Deep equality check that handles ObjectId, Date, arrays, and nested objects.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  // Handle ObjectId — compare string representations
  if (isObjectId(a) || isObjectId(b)) {
    return String(a) === String(b);
  }

  // Handle Date
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // Handle null/undefined
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, i < b.length ? b[i] : undefined));
  }

  // Handle objects
  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, any>;
    const bObj = b as Record<string, any>;
    const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
    for (const key of keys) {
      if (SKIP_FIELDS.has(key)) continue;
      if (!deepEqual(aObj[key], bObj[key])) return false;
    }
    return true;
  }

  // Primitives
  return a === b;
}

/**
 * Check if a value is a Mongoose ObjectId
 */
function isObjectId(val: unknown): boolean {
  return (
    val != null &&
    typeof val === 'object' &&
    typeof (val as any).toHexString === 'function'
  );
}

/**
 * Serialize a value for storage in the audit log.
 * Converts ObjectIds to strings, Dates to ISO strings, etc.
 */
function serialize(val: unknown): unknown {
  if (val == null) return null;
  if (isObjectId(val)) return String(val);
  if (val instanceof Date) return val.toISOString();
  if (Array.isArray(val)) return val.map(serialize);
  if (typeof val === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (!SKIP_FIELDS.has(k)) {
        result[k] = serialize(v);
      }
    }
    return result;
  }
  return val;
}
