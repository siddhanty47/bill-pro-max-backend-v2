/**
 * @file Employee model
 * @description Mongoose schema for business employees (transporters, workers, etc.)
 * Separate from BusinessMember which tracks app users with Keycloak login.
 * These are real-world personnel records who don't need app accounts.
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/**
 * Employee type — extend this union as new types are added
 */
export type EmployeeType = 'transporter';

/**
 * Transporter-specific details
 */
export interface ITransporterDetails {
  vehicleNumber: string;
}

/**
 * Employee document interface
 */
export interface IEmployee extends Document {
  /** Business ID (multi-tenant key) */
  businessId: Types.ObjectId;
  /** Employee name */
  name: string;
  /** Phone number */
  phone?: string;
  /** Employee type discriminator */
  type: EmployeeType;
  /** Type-specific details (union as more types are added) */
  details: ITransporterDetails;
  /** Is employee active */
  isActive: boolean;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Transporter details schema
 */
const TransporterDetailsSchema = new Schema<ITransporterDetails>(
  {
    vehicleNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
  },
  { _id: false }
);

/**
 * Employee schema
 */
const EmployeeSchema = new Schema<IEmployee>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: [true, 'Business ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Employee name is required'],
      trim: true,
      maxlength: [100, 'Employee name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['transporter'],
      required: [true, 'Employee type is required'],
    },
    details: {
      type: TransporterDetailsSchema,
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

EmployeeSchema.index({ businessId: 1, type: 1 });
EmployeeSchema.index({ businessId: 1, name: 1, type: 1 }, { unique: true });

/**
 * Employee model
 */
export const Employee: Model<IEmployee> = mongoose.model<IEmployee>(
  'Employee',
  EmployeeSchema
);
