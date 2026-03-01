/**
 * @file Business model
 * @description Mongoose schema for business/tenant entity
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Business settings interface
 */
export interface IBusinessSettings {
  /** Default billing cycle */
  billingCycle: 'monthly' | 'weekly' | 'yearly';
  /** Currency code */
  currency: string;
  /** Default tax rate (percentage) */
  defaultTaxRate: number;
  /** Default SGST rate (percentage) */
  defaultSgstRate?: number;
  /** Default CGST rate (percentage) */
  defaultCgstRate?: number;
  /** Default IGST rate (percentage) */
  defaultIgstRate?: number;
  /** Default payment due days */
  defaultPaymentDueDays: number;
  /** Notification settings */
  notifications: {
    email: boolean;
    whatsapp: boolean;
  };
}

/**
 * Business document interface
 */
export interface IBusiness extends Document {
  /** Business name */
  name: string;
  /** Owner user ID (Keycloak user ID) */
  ownerUserId: string;
  /** Business domain (optional) */
  domain?: string;
  /** Business address */
  address?: string;
  /** Business phone */
  phone?: string;
  /** Business email */
  email?: string;
  /** GST number */
  gst?: string;
  /** Business logo URL */
  logo?: string;
  /** Business settings */
  settings: IBusinessSettings;
  /** Is business active */
  isActive: boolean;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Business settings schema
 */
const BusinessSettingsSchema = new Schema<IBusinessSettings>(
  {
    billingCycle: {
      type: String,
      enum: ['monthly', 'weekly', 'yearly'],
      default: 'monthly',
    },
    currency: {
      type: String,
      default: 'INR',
    },
    defaultTaxRate: {
      type: Number,
      default: 18,
      min: 0,
      max: 100,
    },
    defaultSgstRate: {
      type: Number,
      default: 9,
      min: 0,
      max: 100,
    },
    defaultCgstRate: {
      type: Number,
      default: 9,
      min: 0,
      max: 100,
    },
    defaultIgstRate: {
      type: Number,
      default: 18,
      min: 0,
      max: 100,
    },
    defaultPaymentDueDays: {
      type: Number,
      default: 15,
      min: 0,
    },
    notifications: {
      email: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: false },
    },
  },
  { _id: false }
);

/**
 * Business schema
 */
const BusinessSchema = new Schema<IBusiness>(
  {
    name: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
      maxlength: [100, 'Business name cannot exceed 100 characters'],
    },
    ownerUserId: {
      type: String,
      required: [true, 'Owner user ID is required'],
      index: true,
    },
    domain: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    gst: {
      type: String,
      trim: true,
      uppercase: true,
    },
    logo: {
      type: String,
    },
    settings: {
      type: BusinessSettingsSchema,
      default: () => ({}),
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
BusinessSchema.index({ name: 'text' });

/**
 * Business model
 */
export const Business: Model<IBusiness> = mongoose.model<IBusiness>(
  'Business',
  BusinessSchema
);
