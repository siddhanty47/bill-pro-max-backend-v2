/**
 * @file Inventory Preset model
 * @description Mongoose schema for inventory preset templates
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/**
 * Preset item interface
 */
export interface IPresetItem {
  code: string;
  name: string;
  category: string;
  unit: string;
  description?: string;
  defaultRatePerDay?: number;
  damageRate?: number;
}

/**
 * Inventory preset document interface
 */
export interface IInventoryPreset extends Document {
  /** Preset name (unique) */
  name: string;
  /** Description of the preset */
  description?: string;
  /** Tags for categorization */
  tags: string[];
  /** Preset items */
  items: IPresetItem[];
  /** Whether this is a system-provided preset */
  isSystem: boolean;
  /** Whether this preset is visible to all businesses */
  isPublic: boolean;
  /** Business that created this preset (null for system presets) */
  createdBy?: Types.ObjectId;
  /** Is preset active */
  isActive: boolean;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Preset item sub-schema
 */
const PresetItemSchema = new Schema<IPresetItem>(
  {
    code: {
      type: String,
      required: [true, 'Item code is required'],
      trim: true,
      uppercase: true,
      maxlength: [20, 'Item code cannot exceed 20 characters'],
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
      maxlength: [50, 'Category cannot exceed 50 characters'],
    },
    unit: {
      type: String,
      required: true,
      trim: true,
      default: 'pcs',
      maxlength: [20, 'Unit cannot exceed 20 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    defaultRatePerDay: {
      type: Number,
      min: 0,
    },
    damageRate: {
      type: Number,
      min: 0,
    },
  },
  { _id: false }
);

/**
 * Inventory preset schema
 */
const InventoryPresetSchema = new Schema<IInventoryPreset>(
  {
    name: {
      type: String,
      required: [true, 'Preset name is required'],
      trim: true,
      maxlength: [100, 'Preset name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    tags: {
      type: [String],
      default: [],
    },
    items: {
      type: [PresetItemSchema],
      required: true,
      validate: {
        validator: (v: IPresetItem[]) => v.length > 0,
        message: 'Preset must have at least one item',
      },
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
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
InventoryPresetSchema.index({ name: 1 }, { unique: true });
InventoryPresetSchema.index({ isSystem: 1, isActive: 1 });
InventoryPresetSchema.index({ name: 'text' });

/**
 * Inventory preset model
 */
export const InventoryPreset: Model<IInventoryPreset> = mongoose.model<IInventoryPreset>(
  'InventoryPreset',
  InventoryPresetSchema
);
