/**
 * @file Invitation model
 * @description Schema for business invitations. Tracks pending, accepted,
 * declined, expired, and cancelled invitations.
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/**
 * Invitation status values
 */
export const InvitationStatuses = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;

export type InvitationStatus = (typeof InvitationStatuses)[keyof typeof InvitationStatuses];

/**
 * Invitation document interface
 */
export interface IInvitation extends Document {
  /** Reference to the Business */
  businessId: Types.ObjectId;
  /** Invited user's email */
  email: string;
  /** Role to assign when accepted */
  role: string;
  /** Keycloak user ID of the person who sent the invitation */
  invitedBy: string;
  /** Display name of inviter (denormalized) */
  inviterName?: string;
  /** Business name (denormalized for display in emails/UI) */
  businessName?: string;
  /** Current status */
  status: InvitationStatus;
  /** Unique token for accept/decline links */
  token: string;
  /** Expiry date */
  expiresAt: Date;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Invitation schema
 */
const InvitationSchema = new Schema<IInvitation>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: [true, 'Business ID is required'],
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: ['owner', 'manager', 'staff', 'accountant', 'viewer', 'client-portal'],
    },
    invitedBy: {
      type: String,
      required: [true, 'Invited by is required'],
    },
    inviterName: {
      type: String,
      trim: true,
    },
    businessName: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired', 'cancelled'],
      default: 'pending',
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

InvitationSchema.index({ businessId: 1, email: 1, status: 1 });
InvitationSchema.index({ token: 1 });
InvitationSchema.index({ email: 1, status: 1 });

/**
 * Invitation model
 */
export const Invitation: Model<IInvitation> = mongoose.model<IInvitation>(
  'Invitation',
  InvitationSchema
);
