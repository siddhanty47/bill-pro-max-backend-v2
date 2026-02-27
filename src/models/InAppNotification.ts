/**
 * @file InAppNotification model
 * @description Schema for in-app notifications (distinct from the email/WhatsApp NotificationService).
 * Stored per-user and displayed in the notification bell dropdown.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * In-app notification types
 */
export const InAppNotificationTypes = {
  INVITATION: 'invitation',
  SYSTEM: 'system',
  INFO: 'info',
} as const;

export type InAppNotificationType =
  (typeof InAppNotificationTypes)[keyof typeof InAppNotificationTypes];

/**
 * InAppNotification document interface
 */
export interface IInAppNotification extends Document {
  /** Keycloak user ID of the recipient */
  userId: string;
  /** Notification type */
  type: InAppNotificationType;
  /** Short title */
  title: string;
  /** Notification message body */
  message: string;
  /** Arbitrary metadata (e.g. invitationToken, businessId) */
  data?: Record<string, string>;
  /** Whether the user has read this notification */
  isRead: boolean;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * InAppNotification schema
 */
const InAppNotificationSchema = new Schema<IInAppNotification>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
    },
    type: {
      type: String,
      enum: ['invitation', 'system', 'info'],
      default: 'info',
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
    },
    data: {
      type: Schema.Types.Mixed,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

InAppNotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

/**
 * InAppNotification model
 */
export const InAppNotification: Model<IInAppNotification> = mongoose.model<IInAppNotification>(
  'InAppNotification',
  InAppNotificationSchema
);
