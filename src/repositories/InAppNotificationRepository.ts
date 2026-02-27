/**
 * @file InAppNotification Repository
 * @description Data access layer for in-app notification operations.
 */

import { BaseRepository } from './BaseRepository';
import { InAppNotification, IInAppNotification } from '../models/InAppNotification';

/**
 * InAppNotification repository class
 */
export class InAppNotificationRepository extends BaseRepository<IInAppNotification> {
  constructor() {
    super(InAppNotification);
  }

  /**
   * Find notifications for a user (most recent first)
   * @param userId - Keycloak user ID
   * @param limit - Max number of results
   * @param offset - Skip this many results
   * @returns Array of notifications
   */
  async findByUser(
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<IInAppNotification[]> {
    return this.model
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .exec();
  }

  /**
   * Count unread notifications for a user
   * @param userId - Keycloak user ID
   * @returns Number of unread notifications
   */
  async countUnread(userId: string): Promise<number> {
    return this.count({ userId, isRead: false });
  }

  /**
   * Mark a single notification as read
   * @param notificationId - Notification document ID
   * @param userId - Keycloak user ID (for authorization)
   * @returns Updated notification
   */
  async markAsRead(
    notificationId: string,
    userId: string
  ): Promise<IInAppNotification | null> {
    return this.updateOne(
      { _id: notificationId, userId },
      { isRead: true }
    );
  }

  /**
   * Mark all notifications as read for a user
   * @param userId - Keycloak user ID
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.updateMany({ userId, isRead: false }, { isRead: true });
  }
}

export default InAppNotificationRepository;
