/**
 * @file BusinessMember model
 * @description Maps users to businesses with per-business roles.
 * Replaces global Supabase realm roles for business-scoped authorization.
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { UserRole } from '../config/roles';

/**
 * BusinessMember document interface
 */
export interface IBusinessMember extends Document {
  /** Reference to the Business */
  businessId: Types.ObjectId;
  /** Supabase user ID */
  userId: string;
  /** User email (denormalized for display) */
  email: string;
  /** User display name (denormalized for display) */
  name?: string;
  /** Role within this specific business */
  role: UserRole;
  /** When the user joined the business */
  joinedAt: Date;
  /** Supabase user ID of the person who invited this member */
  invitedBy?: string;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * BusinessMember schema
 */
const BusinessMemberSchema = new Schema<IBusinessMember>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: [true, 'Business ID is required'],
      index: true,
    },
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: ['owner', 'manager', 'staff', 'accountant', 'viewer', 'client-portal'],
      default: 'viewer',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    invitedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

BusinessMemberSchema.index({ businessId: 1, userId: 1 }, { unique: true });
BusinessMemberSchema.index({ businessId: 1, email: 1 });

/**
 * BusinessMember model
 */
export const BusinessMember: Model<IBusinessMember> = mongoose.model<IBusinessMember>(
  'BusinessMember',
  BusinessMemberSchema
);
