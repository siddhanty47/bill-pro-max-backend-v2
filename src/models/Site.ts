/**
 * @file Site model (search read-model)
 * @description Flattened, denormalized projection of each `party.sites[]` entry
 * into its own document so site addresses can be indexed by Atlas Vector Search
 * (site_vector_index). NOT user-editable — kept in sync from the Party by
 * CatalogEmbeddingService whenever a party is created/updated.
 *
 * Agreements are resolved separately: a matched site yields (partyId, siteCode),
 * and the active agreement is looked up from party.agreements by siteCode.
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/**
 * Site document interface
 */
export interface ISiteDoc extends Document {
  /** Business ID (multi-tenant key) */
  businessId: Types.ObjectId;
  /** Owning party */
  partyId: Types.ObjectId;
  /** Denormalized party name (display / fallback matching) */
  partyName: string;
  /** Site code within the party (matches party.sites[].code) */
  siteCode: string;
  /** Site address (the text matched against a challan's site address) */
  address: string;
  /** 2-digit GST state code, if present */
  stateCode?: string;
  /** Semantic search vector (Atlas Vector Search: site_vector_index) */
  embedding?: number[];
  /** sha256 of the embedded source text — skip re-embedding unchanged sites */
  embeddingHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SiteDocSchema = new Schema<ISiteDoc>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    partyId: {
      type: Schema.Types.ObjectId,
      ref: 'Party',
      required: true,
      index: true,
    },
    partyName: {
      type: String,
      required: true,
      trim: true,
    },
    siteCode: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    stateCode: {
      type: String,
      trim: true,
      maxlength: 2,
    },
    embedding: {
      type: [Number],
      select: false,
    },
    embeddingHash: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: true,
    collection: 'sites',
  }
);

// One site doc per (party, siteCode). Sync upserts on this key.
SiteDocSchema.index({ partyId: 1, siteCode: 1 }, { unique: true });
SiteDocSchema.index({ address: 'text' });

export const Site: Model<ISiteDoc> = mongoose.model<ISiteDoc>('Site', SiteDocSchema);
