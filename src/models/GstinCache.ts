/**
 * @file GSTIN Cache model
 * @description Caches GSTIN lookup responses to reduce paid API calls.
 * Uses MongoDB TTL index on `expiresAt` for automatic expiration (30 days).
 * On cache hit, the TTL resets so frequently-accessed GSTINs stay cached longer.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import { GstinDetails } from '../services/GstinService';

/** 30 days in milliseconds */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * GSTIN Cache document interface
 */
export interface IGstinCache extends Document {
  /** The GSTIN number (unique key) */
  gstin: string;
  /** Cached GSTIN details from the API */
  details: GstinDetails;
  /** TTL expiry — MongoDB auto-deletes docs past this date */
  expiresAt: Date;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * GSTIN Cache schema
 */
const GstinCacheSchema = new Schema<IGstinCache>(
  {
    gstin: {
      type: String,
      required: [true, 'GSTIN is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
      required: [true, 'GSTIN details are required'],
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + CACHE_TTL_MS),
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// TTL index — MongoDB background task deletes expired documents automatically
GstinCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * GSTIN Cache model
 */
export const GstinCache: Model<IGstinCache> = mongoose.model<IGstinCache>(
  'GstinCache',
  GstinCacheSchema
);

export { CACHE_TTL_MS };
