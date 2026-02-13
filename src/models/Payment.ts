/**
 * @file Payment model
 * @description Mongoose schema for payment records
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/**
 * Payment type (receivable or payable)
 */
export type PaymentType = 'receivable' | 'payable';

/**
 * Payment method
 */
export type PaymentMethod = 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other';

/**
 * Payment status
 */
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

/**
 * Payment document interface
 */
export interface IPayment extends Document {
  /** Business ID (multi-tenant key) */
  businessId: Types.ObjectId;
  /** Payment type */
  type: PaymentType;
  /** Party ID */
  partyId: Types.ObjectId;
  /** Bill ID (for receivables) */
  billId?: Types.ObjectId;
  /** Purchase ID (for payables) */
  purchaseId?: Types.ObjectId;
  /** Payment amount */
  amount: number;
  /** Currency */
  currency: string;
  /** Payment method */
  method: PaymentMethod;
  /** Payment reference number */
  reference?: string;
  /** Payment date */
  date: Date;
  /** Payment status */
  status: PaymentStatus;
  /** Notes */
  notes?: string;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Payment schema
 */
const PaymentSchema = new Schema<IPayment>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: [true, 'Business ID is required'],
      index: true,
    },
    type: {
      type: String,
      enum: ['receivable', 'payable'],
      required: [true, 'Payment type is required'],
    },
    partyId: {
      type: Schema.Types.ObjectId,
      ref: 'Party',
      required: [true, 'Party ID is required'],
    },
    billId: {
      type: Schema.Types.ObjectId,
      ref: 'Bill',
    },
    purchaseId: {
      type: Schema.Types.ObjectId,
      ref: 'Purchase',
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be positive'],
    },
    currency: {
      type: String,
      default: 'INR',
    },
    method: {
      type: String,
      enum: ['cash', 'bank_transfer', 'upi', 'cheque', 'other'],
      required: [true, 'Payment method is required'],
    },
    reference: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      required: [true, 'Payment date is required'],
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled'],
      default: 'completed',
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
PaymentSchema.index({ businessId: 1, billId: 1 });
PaymentSchema.index({ businessId: 1, partyId: 1 });
PaymentSchema.index({ businessId: 1, date: -1 });
PaymentSchema.index({ businessId: 1, type: 1, status: 1 });

/**
 * Payment model
 */
export const Payment: Model<IPayment> = mongoose.model<IPayment>(
  'Payment',
  PaymentSchema
);
