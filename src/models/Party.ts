/**
 * @file Party model
 * @description Mongoose schema for party (clients/suppliers) entity
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/**
 * Party role type
 */
export type PartyRole = 'client' | 'supplier';

/**
 * Contact information interface
 */
export interface IContact {
  /** Contact person name */
  person: string;
  /** Phone number */
  phone: string;
  /** Email address */
  email?: string;
  /** Address */
  address?: string;
  /** GST number */
  gst?: string;
  /** 2-digit GST state code (e.g. 27 for Maharashtra) */
  stateCode?: string;
}

/**
 * Site interface - represents a physical location for a party
 */
export interface ISite {
  /** Unique site code within the party */
  code: string;
  /** Site address */
  address: string;
  /** 2-digit GST state code (e.g. 27 for Maharashtra) */
  stateCode?: string;
}

/**
 * Agreement rate interface
 */
export interface IAgreementRate {
  /** Inventory item ID */
  itemId: Types.ObjectId;
  /** Rate per day */
  ratePerDay: number;
}

/**
 * Agreement terms interface
 */
export interface IAgreementTerms {
  /** Billing cycle */
  billingCycle: 'monthly' | 'weekly' | 'yearly';
  /** Payment due days after invoice */
  paymentDueDays: number;
  /** Security deposit amount */
  securityDeposit?: number;
  /** Default cartage charge for delivery challans */
  deliveryCartage?: number;
  /** Default cartage charge for return challans */
  returnCartage?: number;
  /** Default loading charge */
  loadingCharge?: number;
  /** Default unloading charge */
  unloadingCharge?: number;
}

/**
 * Agreement interface
 */
export interface IAgreement {
  /** Unique agreement ID */
  agreementId: string;
  /** Site code - references a site in party.sites */
  siteCode: string;
  /** Start date */
  startDate: Date;
  /** End date (optional, null for ongoing) */
  endDate?: Date;
  /** Agreement status */
  status: 'active' | 'expired' | 'terminated';
  /** Agreement terms */
  terms: IAgreementTerms;
  /** Item rates */
  rates: IAgreementRate[];
  /** Created timestamp */
  createdAt: Date;
}

/**
 * Party document interface
 */
export interface IParty extends Document {
  /** Business ID (multi-tenant key) */
  businessId: Types.ObjectId;
  /** Unique party code (e.g., JOHN, HSCO) */
  code: string;
  /** Party name */
  name: string;
  /** Party roles (client, supplier, or both) */
  roles: PartyRole[];
  /** Contact information (office contact) */
  contact: IContact;
  /** Site addresses for the party */
  sites: ISite[];
  /** Agreements (for clients) - each associated with a specific site */
  agreements: IAgreement[];
  /** Auth provider user ID for client portal access */
  authProviderId?: string;
  /** Is party active */
  isActive: boolean;
  /** Notes */
  notes?: string;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Contact schema
 */
const ContactSchema = new Schema<IContact>(
  {
    person: {
      type: String,
      required: [true, 'Contact person name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      trim: true,
    },
    gst: {
      type: String,
      trim: true,
      uppercase: true,
    },
    stateCode: {
      type: String,
      trim: true,
      maxlength: 2,
    },
  },
  { _id: false }
);

/**
 * Site schema - represents a physical location for a party
 */
const SiteSchema = new Schema<ISite>(
  {
    code: {
      type: String,
      required: [true, 'Site code is required'],
      trim: true,
      uppercase: true,
      maxlength: [20, 'Site code cannot exceed 20 characters'],
    },
    address: {
      type: String,
      required: [true, 'Site address is required'],
      trim: true,
    },
    stateCode: {
      type: String,
      trim: true,
      maxlength: 2,
    },
  },
  { _id: false }
);

/**
 * Agreement rate schema
 */
const AgreementRateSchema = new Schema<IAgreementRate>(
  {
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true,
    },
    ratePerDay: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

/**
 * Agreement terms schema
 */
const AgreementTermsSchema = new Schema<IAgreementTerms>(
  {
    billingCycle: {
      type: String,
      enum: ['monthly', 'weekly', 'yearly'],
      default: 'monthly',
    },
    paymentDueDays: {
      type: Number,
      default: 15,
      min: 0,
    },
    securityDeposit: {
      type: Number,
      min: 0,
    },
    deliveryCartage: {
      type: Number,
      min: 0,
    },
    returnCartage: {
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
  { _id: false }
);

/**
 * Agreement schema
 */
const AgreementSchema = new Schema<IAgreement>(
  {
    agreementId: {
      type: String,
      required: true,
    },
    siteCode: {
      type: String,
      required: [true, 'Site code is required for agreement'],
      trim: true,
      uppercase: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'terminated'],
      default: 'active',
    },
    terms: {
      type: AgreementTermsSchema,
      required: true,
    },
    rates: [AgreementRateSchema],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

/**
 * Party schema
 */
const PartySchema = new Schema<IParty>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: [true, 'Business ID is required'],
      index: true,
    },
    code: {
      type: String,
      required: [true, 'Party code is required'],
      trim: true,
      uppercase: true,
      maxlength: [20, 'Party code cannot exceed 20 characters'],
    },
    name: {
      type: String,
      required: [true, 'Party name is required'],
      trim: true,
      maxlength: [100, 'Party name cannot exceed 100 characters'],
    },
    roles: [{
      type: String,
      enum: ['client', 'supplier'],
      required: true,
    }],
    contact: {
      type: ContactSchema,
      required: true,
    },
    sites: {
      type: [SiteSchema],
      default: [],
    },
    agreements: [AgreementSchema],
    authProviderId: {
      type: String,
      sparse: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
PartySchema.index({ businessId: 1, code: 1 }, { unique: true });
PartySchema.index({ businessId: 1, roles: 1 });
PartySchema.index({ businessId: 1, 'contact.email': 1 });
PartySchema.index({ name: 'text', 'contact.person': 'text' });

// Virtual to check if party is a client
PartySchema.virtual('isClient').get(function () {
  return this.roles.includes('client');
});

// Virtual to check if party is a supplier
PartySchema.virtual('isSupplier').get(function () {
  return this.roles.includes('supplier');
});

// Virtual to get active agreement
PartySchema.virtual('activeAgreement').get(function () {
  return this.agreements.find(a => a.status === 'active');
});

/**
 * Party model
 */
export const Party: Model<IParty> = mongoose.model<IParty>('Party', PartySchema);
