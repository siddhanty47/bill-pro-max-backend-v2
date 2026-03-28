/**
 * @file AuditLog model
 * @description Mongoose schema for document change audit logs
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/**
 * Supported document types for audit logging
 */
export type AuditDocumentType =
  | 'inventory'
  | 'party'
  | 'agreement'
  | 'challan'
  | 'bill'
  | 'payment'
  | 'business';

/**
 * Audit action type
 */
export type AuditAction = 'created' | 'updated' | 'deleted';

/**
 * Single field change record
 */
export interface IFieldChange {
  /** Dot-notation field path, e.g. "name", "contact.phone" */
  field: string;
  /** Value before the change */
  oldValue: unknown;
  /** Value after the change */
  newValue: unknown;
}

/**
 * Performer of the action
 */
export interface IAuditPerformer {
  /** User ID */
  userId: string;
  /** Display name */
  name: string;
}

/**
 * AuditLog document interface
 */
export interface IAuditLog extends Document {
  /** Business ID (multi-tenant key) */
  businessId: Types.ObjectId;
  /** ID of the document that was changed */
  documentId: string;
  /** Type of entity that was changed */
  documentType: AuditDocumentType;
  /** Action performed */
  action: AuditAction;
  /** List of field changes (empty for created/deleted) */
  changes: IFieldChange[];
  /** Who performed the action */
  performedBy: IAuditPerformer;
  /** Created timestamp */
  createdAt: Date;
}

/**
 * Field change sub-schema
 */
const FieldChangeSchema = new Schema<IFieldChange>(
  {
    field: { type: String, required: true },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

/**
 * Performer sub-schema
 */
const AuditPerformerSchema = new Schema<IAuditPerformer>(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true },
  },
  { _id: false }
);

/**
 * AuditLog schema
 */
const AuditLogSchema = new Schema<IAuditLog>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: [true, 'Business ID is required'],
    },
    documentId: {
      type: String,
      required: [true, 'Document ID is required'],
    },
    documentType: {
      type: String,
      enum: ['inventory', 'party', 'agreement', 'challan', 'bill', 'payment', 'business'],
      required: [true, 'Document type is required'],
    },
    action: {
      type: String,
      enum: ['created', 'updated', 'deleted'],
      required: [true, 'Action is required'],
    },
    changes: {
      type: [FieldChangeSchema],
      default: [],
    },
    performedBy: {
      type: AuditPerformerSchema,
      required: [true, 'Performer is required'],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Primary query index: fetch history for a specific document
AuditLogSchema.index({ businessId: 1, documentType: 1, documentId: 1, createdAt: -1 });

// For future TTL or archival
AuditLogSchema.index({ createdAt: 1 });

/**
 * AuditLog model
 */
export const AuditLog: Model<IAuditLog> = mongoose.model<IAuditLog>(
  'AuditLog',
  AuditLogSchema
);
