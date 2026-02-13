/**
 * @file Purchase model
 * @description Mongoose schema for purchase records from suppliers
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/**
 * Payment status
 */
export type PurchasePaymentStatus = 'pending' | 'partial' | 'paid';

/**
 * Purchase item interface
 */
export interface IPurchaseItem {
  /** Inventory item ID */
  itemId: Types.ObjectId;
  /** Item name */
  itemName: string;
  /** Quantity */
  quantity: number;
  /** Cost per unit */
  costPerUnit: number;
  /** Total cost */
  totalCost: number;
}

/**
 * Purchase document interface
 */
export interface IPurchase extends Document {
  /** Business ID (multi-tenant key) */
  businessId: Types.ObjectId;
  /** Supplier party ID */
  supplierPartyId: Types.ObjectId;
  /** Supplier name (denormalized) */
  supplierName: string;
  /** Purchase date */
  date: Date;
  /** Purchase items */
  items: IPurchaseItem[];
  /** Total cost */
  totalCost: number;
  /** Amount paid */
  amountPaid: number;
  /** Payment status */
  paymentStatus: PurchasePaymentStatus;
  /** Invoice number from supplier */
  invoiceNumber?: string;
  /** Invoice file URL */
  invoiceUrl?: string;
  /** Notes */
  notes?: string;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Purchase item schema
 */
const PurchaseItemSchema = new Schema<IPurchaseItem>(
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
    costPerUnit: {
      type: Number,
      required: true,
      min: 0,
    },
    totalCost: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

/**
 * Purchase schema
 */
const PurchaseSchema = new Schema<IPurchase>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: [true, 'Business ID is required'],
      index: true,
    },
    supplierPartyId: {
      type: Schema.Types.ObjectId,
      ref: 'Party',
      required: [true, 'Supplier party ID is required'],
    },
    supplierName: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    items: {
      type: [PurchaseItemSchema],
      required: true,
      validate: {
        validator: function (items: IPurchaseItem[]) {
          return items.length > 0;
        },
        message: 'At least one item is required',
      },
    },
    totalCost: {
      type: Number,
      required: true,
      min: 0,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'partial', 'paid'],
      default: 'pending',
    },
    invoiceNumber: {
      type: String,
      trim: true,
    },
    invoiceUrl: {
      type: String,
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
PurchaseSchema.index({ businessId: 1, supplierPartyId: 1 });
PurchaseSchema.index({ businessId: 1, date: -1 });
PurchaseSchema.index({ businessId: 1, paymentStatus: 1 });

// Virtual for balance due
PurchaseSchema.virtual('balanceDue').get(function () {
  return this.totalCost - this.amountPaid;
});

/**
 * Purchase model
 */
export const Purchase: Model<IPurchase> = mongoose.model<IPurchase>(
  'Purchase',
  PurchaseSchema
);
