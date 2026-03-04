/**
 * @file Bill model
 * @description Mongoose schema for bills/invoices
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/**
 * Bill status
 */
export type BillStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';
export type BillTaxMode = 'intra' | 'inter';

/**
 * Billing period interface
 */
export interface IBillingPeriod {
  /** Period start date */
  start: Date;
  /** Period end date */
  end: Date;
}

/**
 * Bill item interface
 */
export interface IBillItem {
  /** Inventory item ID */
  itemId: Types.ObjectId;
  /** Item name */
  itemName: string;
  /** Quantity */
  quantity: number;
  /** Rate per day */
  ratePerDay: number;
  /** Total days */
  totalDays: number;
  /** Amount (quantity * rate * days) */
  amount: number;
  /** Slab start date (optional) */
  slabStart?: Date;
  /** Slab end date (optional) */
  slabEnd?: Date;
}

/**
 * Damage bill item interface
 */
export interface IDamageBillItem {
  /** Inventory item ID */
  itemId: Types.ObjectId;
  /** Item name */
  itemName: string;
  /** Damaged quantity */
  quantity: number;
  /** Damage rate per unit */
  damageRate: number;
  /** Damage amount (quantity * damageRate) */
  amount: number;
  /** Optional note about damage */
  note?: string;
}

/**
 * Bill document interface
 */
export interface IBill extends Document {
  /** Business ID (multi-tenant key) */
  businessId: Types.ObjectId;
  /** Unique bill number */
  billNumber: string;
  /** Party ID */
  partyId: Types.ObjectId;
  /** Agreement ID */
  agreementId: string;
  /** Billing period */
  billingPeriod: IBillingPeriod;
  /** Bill date (display date on invoice; optional for legacy bills) */
  billDate?: Date;
  /** Bill items */
  items: IBillItem[];
  /** Subtotal (before tax and discount) */
  subtotal: number;
  /** Legacy tax rate (percentage) kept for backward compatibility */
  taxRate?: number;
  /** Tax mode used for this bill */
  taxMode?: BillTaxMode;
  /** SGST rate (percentage) */
  sgstRate?: number;
  /** CGST rate (percentage) */
  cgstRate?: number;
  /** IGST rate (percentage) */
  igstRate?: number;
  /** SGST amount */
  sgstAmount?: number;
  /** CGST amount */
  cgstAmount?: number;
  /** IGST amount */
  igstAmount?: number;
  /** Tax amount */
  taxAmount: number;
  /** Discount rate (percentage) */
  discountRate: number;
  /** Discount amount */
  discountAmount: number;
  /** Total amount */
  totalAmount: number;
  /** Currency */
  currency: string;
  /** Bill status */
  status: BillStatus;
  /** Due date */
  dueDate: Date;
  /** PDF URL */
  pdfUrl?: string;
  /** Sent timestamp */
  sentAt?: Date;
  /** Paid timestamp */
  paidAt?: Date;
  /** Amount paid so far */
  amountPaid: number;
  /** Notes */
  notes?: string;
  /** Transportation charges total (stored separately for line-item display) */
  transportationCharges?: number;
  /** Damage items from return challans */
  damageItems?: IDamageBillItem[];
  /** Total damage charges */
  damageCharges?: number;
  /** Whether underlying challan data changed after this bill was generated */
  isStale?: boolean;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Billing period schema
 */
const BillingPeriodSchema = new Schema<IBillingPeriod>(
  {
    start: {
      type: Date,
      required: true,
    },
    end: {
      type: Date,
      required: true,
    },
  },
  { _id: false }
);

/**
 * Bill item schema
 */
const BillItemSchema = new Schema<IBillItem>(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true,
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    ratePerDay: {
      type: Number,
      required: true,
      min: 0,
    },
    totalDays: {
      type: Number,
      required: true,
      min: 0,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    slabStart: {
      type: Date,
      required: false,
    },
    slabEnd: {
      type: Date,
      required: false,
    },
  },
  { _id: false }
);

/**
 * Damage bill item schema
 */
const DamageBillItemSchema = new Schema<IDamageBillItem>(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true,
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    damageRate: {
      type: Number,
      required: true,
      min: 0,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false }
);

/**
 * Bill schema
 */
const BillSchema = new Schema<IBill>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: [true, 'Business ID is required'],
      index: true,
    },
    billNumber: {
      type: String,
      required: [true, 'Bill number is required'],
      unique: true,
    },
    partyId: {
      type: Schema.Types.ObjectId,
      ref: 'Party',
      required: [true, 'Party ID is required'],
    },
    agreementId: {
      type: String,
      required: [true, 'Agreement ID is required'],
    },
    billingPeriod: {
      type: BillingPeriodSchema,
      required: true,
    },
    billDate: {
      type: Date,
    },
    items: {
      type: [BillItemSchema],
      required: true,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    taxRate: {
      type: Number,
      required: false,
      min: 0,
      max: 100,
      default: 0,
    },
    taxMode: {
      type: String,
      enum: ['intra', 'inter'],
      default: 'intra',
    },
    sgstRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    cgstRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    igstRate: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    sgstAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    cgstAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    igstAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    taxAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    discountRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'],
      default: 'draft',
    },
    dueDate: {
      type: Date,
      required: true,
    },
    pdfUrl: {
      type: String,
    },
    sentAt: {
      type: Date,
    },
    paidAt: {
      type: Date,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    transportationCharges: {
      type: Number,
      default: 0,
      min: 0,
    },
    damageItems: {
      type: [DamageBillItemSchema],
      default: [],
    },
    damageCharges: {
      type: Number,
      default: 0,
      min: 0,
    },
    isStale: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
BillSchema.index({ businessId: 1, status: 1 });
BillSchema.index({ businessId: 1, partyId: 1 });
BillSchema.index({ businessId: 1, partyId: 1, status: 1 });
BillSchema.index({ businessId: 1, dueDate: 1, status: 1 });

// Unique compound index to prevent duplicate bills for the same period
// This ensures only one bill per party + agreement + billing period (month/year)
BillSchema.index(
  { businessId: 1, partyId: 1, agreementId: 1, 'billingPeriod.start': 1 },
  { unique: true }
);

// Virtual for balance due
BillSchema.virtual('balanceDue').get(function () {
  return this.totalAmount - this.amountPaid;
});

// Virtual for is overdue
BillSchema.virtual('isOverdue').get(function () {
  return (
    this.status !== 'paid' &&
    this.status !== 'cancelled' &&
    new Date() > this.dueDate
  );
});

/**
 * Bill model
 */
export const Bill: Model<IBill> = mongoose.model<IBill>('Bill', BillSchema);
