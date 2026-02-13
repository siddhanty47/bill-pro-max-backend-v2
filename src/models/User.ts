/**
 * @file User model
 * @description Mongoose schema for user entity (synced from Keycloak)
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/**
 * User document interface
 */
export interface IUser extends Document {
  /** Keycloak user ID */
  keycloakUserId: string;
  /** Email address */
  email: string;
  /** Username */
  username: string;
  /** First name */
  firstName: string;
  /** Last name */
  lastName: string;
  /** Full name */
  name: string;
  /** Phone number */
  phone?: string;
  /** Business IDs user has access to */
  businessIds: Types.ObjectId[];
  /** User roles */
  roles: string[];
  /** Is user active */
  isActive: boolean;
  /** Last login timestamp */
  lastLogin?: Date;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * User schema
 */
const UserSchema = new Schema<IUser>(
  {
    keycloakUserId: {
      type: String,
      required: [true, 'Keycloak user ID is required'],
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
    },
    firstName: {
      type: String,
      trim: true,
      default: '',
    },
    lastName: {
      type: String,
      trim: true,
      default: '',
    },
    name: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
    },
    businessIds: [{
      type: Schema.Types.ObjectId,
      ref: 'Business',
    }],
    roles: [{
      type: String,
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
UserSchema.index({ businessIds: 1 });
UserSchema.index({ email: 'text', name: 'text' });

// Virtual for full name
UserSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`.trim() || this.name;
});

/**
 * User model
 */
export const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
