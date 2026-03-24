/**
 * @file Inventory model
 * @description Mongoose schema for inventory items
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/**
 * Purchase info interface (initial purchase of item)
 */
export interface IPurchaseInfo {
  /** Purchase ID */
  purchaseId?: string;
  /** Supplier party ID */
  supplierPartyId?: Types.ObjectId;
  /** Supplier name */
  supplierName?: string;
  /** Cost per unit */
  costPerUnit: number;
  /** Purchase date */
  date: Date;
  /** Payment status */
  paymentStatus: 'pending' | 'partial' | 'paid';
}

/**
 * Quantity transaction interface for tracking stock adjustments
 */
export interface IQuantityTransaction {
  /** Type of quantity adjustment */
  type: 'purchase' | 'scraped' | 'sold' | 'damaged' | 'short' | 'challan_loss_edit' | 'challan_item_edit' | 'challan_delivery' | 'challan_return' | 'challan_delivery_reversed' | 'challan_return_reversed';
  /** Quantity adjusted */
  quantity: number;
  /** Optional note describing the adjustment */
  note?: string;
  /** Date the adjustment occurred */
  date: Date;
  /** Signed change to rented quantity (for challan-related types). Client sums this to compute rented. */
  rentedDelta?: number;
  /** Challan type for challan_item_edit (delivery vs return) */
  challanType?: 'delivery' | 'return';
}

/**
 * Inventory document interface
 */
export interface IInventory extends Document {
  /** Business ID (multi-tenant key) */
  businessId: Types.ObjectId;
  /** Unique inventory code (user-defined) */
  code: string;
  /** Item name */
  name: string;
  /** Item category */
  category: string;
  /** Total quantity owned */
  totalQuantity: number;
  /** Unit of measurement */
  unit: string;
  /** Description */
  description?: string;
  /** Default rate per day */
  defaultRatePerDay?: number;
  /** Fixed price per unit when returned damaged (not per-day) */
  damageRate?: number;
  /** Cost price per unit — used when item is lost (short) */
  costPrice?: number;
  /** Purchase information */
  purchaseInfo?: IPurchaseInfo;
  /** History of quantity adjustments (purchases, scraped, sold) */
  quantityHistory: IQuantityTransaction[];
  /** Is item active */
  isActive: boolean;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Purchase info schema
 */
const PurchaseInfoSchema = new Schema<IPurchaseInfo>(
  {
    purchaseId: {
      type: String,
    },
    supplierPartyId: {
      type: Schema.Types.ObjectId,
      ref: 'Party',
    },
    supplierName: {
      type: String,
      trim: true,
    },
    costPerUnit: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'partial', 'paid'],
      default: 'pending',
    },
  },
  { _id: false }
);

/**
 * Quantity transaction sub-schema for tracking stock adjustments
 */
const QuantityTransactionSchema = new Schema<IQuantityTransaction>(
  {
    type: {
      type: String,
      enum: ['purchase', 'scraped', 'sold', 'damaged', 'short', 'challan_loss_edit', 'challan_item_edit', 'challan_delivery', 'challan_return', 'challan_delivery_reversed', 'challan_return_reversed'],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    date: {
      type: Date,
      required: true,
    },
    rentedDelta: {
      type: Number,
    },
    challanType: {
      type: String,
      enum: ['delivery', 'return'],
    },
  },
  { _id: true }
);

/**
 * Inventory schema
 */
const InventorySchema = new Schema<IInventory>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: [true, 'Business ID is required'],
      index: true,
    },
    code: {
      type: String,
      required: [true, 'Inventory code is required'],
      trim: true,
      uppercase: true,
      maxlength: [20, 'Inventory code cannot exceed 20 characters'],
    },
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      maxlength: [100, 'Item name cannot exceed 100 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    totalQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
      default: 'pcs',
    },
    description: {
      type: String,
      trim: true,
    },
    defaultRatePerDay: {
      type: Number,
      min: 0,
    },
    damageRate: {
      type: Number,
      min: 0,
      default: 0,
    },
    costPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    purchaseInfo: {
      type: PurchaseInfoSchema,
    },
    quantityHistory: {
      type: [QuantityTransactionSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
InventorySchema.index({ businessId: 1, code: 1 }, { unique: true });
InventorySchema.index({ businessId: 1, category: 1 });
InventorySchema.index({ name: 'text', category: 'text' });

/**
 * Inventory model
 */
export const Inventory: Model<IInventory> = mongoose.model<IInventory>(
  'Inventory',
  InventorySchema
);
