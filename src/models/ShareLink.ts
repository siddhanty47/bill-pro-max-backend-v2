/**
 * @file ShareLink model
 * @description Schema for shareable party portal links. Allows business owners
 * to share read-only portals with parties (clients/suppliers) via token-based URLs.
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/**
 * ShareLink status values
 */
export const ShareLinkStatuses = {
  ACTIVE: 'active',
  REVOKED: 'revoked',
} as const;

export type ShareLinkStatus = (typeof ShareLinkStatuses)[keyof typeof ShareLinkStatuses];

/**
 * ShareLink document interface
 */
export interface IShareLink extends Document {
  /** Reference to the Business */
  businessId: Types.ObjectId;
  /** Reference to the Party this link is for */
  partyId: Types.ObjectId;
  /** Unique token for public access (64 hex chars, 256-bit entropy) */
  token: string;
  /** Optional site code to scope portal to a specific site's agreements */
  siteCode?: string;
  /** Human-friendly label (e.g., "For Rajesh - Main site") */
  label?: string;
  /** Expiry date (null = never expires) */
  expiresAt?: Date;
  /** Current status */
  status: ShareLinkStatus;
  /** Keycloak userId of the creator */
  createdBy: string;
  /** Last time the portal was accessed via this link */
  lastAccessedAt?: Date;
  /** Number of times the portal was accessed */
  accessCount: number;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * ShareLink schema
 */
const ShareLinkSchema = new Schema<IShareLink>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: [true, 'Business ID is required'],
      index: true,
    },
    partyId: {
      type: Schema.Types.ObjectId,
      ref: 'Party',
      required: [true, 'Party ID is required'],
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    siteCode: {
      type: String,
      trim: true,
    },
    label: {
      type: String,
      trim: true,
    },
    expiresAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['active', 'revoked'],
      default: 'active',
    },
    createdBy: {
      type: String,
      required: [true, 'Created by is required'],
    },
    lastAccessedAt: {
      type: Date,
    },
    accessCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ShareLinkSchema.index({ token: 1 }, { unique: true });
ShareLinkSchema.index({ businessId: 1, partyId: 1 });

/**
 * ShareLink model
 */
export const ShareLink: Model<IShareLink> = mongoose.model<IShareLink>(
  'ShareLink',
  ShareLinkSchema
);
