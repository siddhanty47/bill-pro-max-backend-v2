/**
 * @file Employee model
 * @description Mongoose schema for business employees (transporters, workers, etc.)
 * Separate from BusinessMember which tracks app users with Supabase login.
 * These are real-world personnel records who don't need app accounts.
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/**
 * Employee type — extend this union as new types are added
 */
export type EmployeeType = 'transporter' | 'general' | 'worker' | 'operator' | 'supervisor';

/**
 * Salary type
 */
export type SalaryType = 'monthly' | 'daily';

/**
 * Transporter-specific details
 */
export interface ITransporterDetails {
  vehicleNumber: string;
}

/**
 * Emergency contact
 */
export interface IEmergencyContact {
  name: string;
  phone: string;
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
  /** Type-specific details (only for transporters) */
  details?: ITransporterDetails;
  /** Role / job title */
  designation?: string;
  /** Address */
  address?: string;
  /** Date of joining */
  joiningDate?: Date;
  /** Salary type */
  salaryType?: SalaryType;
  /** Fixed monthly salary */
  monthlySalary?: number;
  /** Daily wage rate */
  dailyRate?: number;
  /** Overtime rate per hour */
  overtimeRatePerHour?: number;
  /** Emergency contact */
  emergencyContact?: IEmergencyContact;
  /** Notes */
  notes?: string;
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
 * Emergency contact schema
 */
const EmergencyContactSchema = new Schema<IEmergencyContact>(
  {
    name: { type: String, trim: true, maxlength: 100 },
    phone: { type: String, trim: true, maxlength: 20 },
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
      enum: ['transporter', 'general', 'worker', 'operator', 'supervisor'],
      required: [true, 'Employee type is required'],
    },
    details: {
      type: TransporterDetailsSchema,
    },
    designation: {
      type: String,
      trim: true,
      maxlength: [100, 'Designation cannot exceed 100 characters'],
    },
    address: {
      type: String,
      trim: true,
      maxlength: [500, 'Address cannot exceed 500 characters'],
    },
    joiningDate: {
      type: Date,
    },
    salaryType: {
      type: String,
      enum: ['monthly', 'daily'],
    },
    monthlySalary: {
      type: Number,
      min: [0, 'Monthly salary cannot be negative'],
    },
    dailyRate: {
      type: Number,
      min: [0, 'Daily rate cannot be negative'],
    },
    overtimeRatePerHour: {
      type: Number,
      min: [0, 'Overtime rate cannot be negative'],
      default: 0,
    },
    emergencyContact: {
      type: EmergencyContactSchema,
    },
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
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
