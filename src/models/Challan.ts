/**
 * @file Challan model
 * @description Mongoose schema for delivery/return challans
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/**
 * Challan type
 */
export type ChallanType = 'delivery' | 'return';

/**
 * Challan status
 */
export type ChallanStatus = 'draft' | 'confirmed' | 'cancelled';

/**
 * Challan item interface
 */
export interface IChallanItem {
  /** Inventory item ID */
  itemId: Types.ObjectId;
  /** Item name (denormalized for convenience) */
  itemName: string;
  /** Quantity */
  quantity: number;
}

/**
 * Damaged item interface (only for return challans)
 */
export interface IDamagedItem {
  /** Inventory item ID */
  itemId: Types.ObjectId;
  /** Item name (denormalized) */
  itemName: string;
  /** Damaged quantity */
  quantity: number;
  /** Damage charge per unit (user-editable, auto-filled from inventory default) */
  damageRate: number;
  /** Optional note describing the damage */
  note?: string;
  /** Loss type: damage = received damaged, short = missing/less, need_repair = can be fixed (no inventory reduction) */
  lossType?: 'damage' | 'short' | 'need_repair';
}

/**
 * Challan document interface
 */
export interface IChallan extends Document {
  /** Business ID (multi-tenant key) */
  businessId: Types.ObjectId;
  /** Unique challan number */
  challanNumber: string;
  /** Challan type (delivery/return) */
  type: ChallanType;
  /** Party ID */
  partyId: Types.ObjectId;
  /** Agreement ID */
  agreementId: string;
  /** Challan date */
  date: Date;
  /** Items in challan */
  items: IChallanItem[];
  /** Damaged items (only for return challans) */
  damagedItems: IDamagedItem[];
  /** Challan status */
  status: ChallanStatus;
  /** Confirmed by (person name) */
  confirmedBy?: string;
  /** Confirmation timestamp */
  confirmedAt?: Date;
  /** Digital signature (Base64 or S3 URL) */
  signature?: string;
  /** Notes */
  notes?: string;
  /** Transporter name (snapshot from employee directory) */
  transporterName?: string;
  /** Vehicle number (snapshot from employee directory) */
  vehicleNumber?: string;
  /** Cartage charge for this challan */
  cartageCharge?: number;
  /** Loading charge */
  loadingCharge?: number;
  /** Unloading charge */
  unloadingCharge?: number;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Challan item schema
 */
const ChallanItemSchema = new Schema<IChallanItem>(
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
  },
  { _id: false }
);

/**
 * Damaged item schema (return challans only)
 */
const DamagedItemSchema = new Schema<IDamagedItem>(
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
    note: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    lossType: {
      type: String,
      enum: ['damage', 'short', 'need_repair'],
      default: 'damage',
    },
  },
  { _id: false }
);

/**
 * Challan schema
 */
const ChallanSchema = new Schema<IChallan>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: [true, 'Business ID is required'],
      index: true,
    },
    challanNumber: {
      type: String,
      required: [true, 'Challan number is required'],
    },
    type: {
      type: String,
      enum: ['delivery', 'return'],
      required: [true, 'Challan type is required'],
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
    date: {
      type: Date,
      required: [true, 'Challan date is required'],
      default: Date.now,
    },
    items: {
      type: [ChallanItemSchema],
      required: true,
      validate: {
        validator: function (items: IChallanItem[]) {
          return items.length > 0;
        },
        message: 'At least one item is required',
      },
    },
    damagedItems: {
      type: [DamagedItemSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['draft', 'confirmed', 'cancelled'],
      default: 'draft',
    },
    confirmedBy: {
      type: String,
      trim: true,
    },
    confirmedAt: {
      type: Date,
    },
    signature: {
      type: String,
    },
    notes: {
      type: String,
      trim: true,
    },
    transporterName: {
      type: String,
      trim: true,
    },
    vehicleNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    cartageCharge: {
      type: Number,
      min: 0,
    },
    loadingCharge: {
      type: Number,
      min: 0,
    },
    unloadingCharge: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
ChallanSchema.index({ businessId: 1, challanNumber: 1 }, { unique: true });
ChallanSchema.index({ businessId: 1, date: -1 });
ChallanSchema.index({ businessId: 1, partyId: 1 });
ChallanSchema.index({ businessId: 1, partyId: 1, type: 1 });
ChallanSchema.index({ businessId: 1, status: 1 });

// Virtual for total items count
ChallanSchema.virtual('totalItems').get(function () {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

/**
 * Challan model
 */
export const Challan: Model<IChallan> = mongoose.model<IChallan>(
  'Challan',
  ChallanSchema
);
