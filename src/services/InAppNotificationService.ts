/**
 * @file InAppNotification Service
 * @description Business logic for in-app notifications.
 * Distinct from the existing NotificationService which handles email/WhatsApp.
 */

import { InAppNotificationRepository } from '../repositories/InAppNotificationRepository';
import { IInAppNotification, InAppNotificationType } from '../models/InAppNotification';
import { logger } from '../utils/logger';

/**
 * InAppNotification Service class.
 * Manages creation, retrieval, and read-state of in-app notifications.
 */
export class InAppNotificationService {
  private repository: InAppNotificationRepository;

  constructor() {
    this.repository = new InAppNotificationRepository();
  }

  /**
   * Create a new in-app notification for a user.
   * @param userId - Keycloak user ID of the recipient
   * @param type - Notification type
   * @param title - Short title
   * @param message - Message body
   * @param data - Optional metadata
   * @returns The created notification
   */
  async createNotification(
    userId: string,
    type: InAppNotificationType,
    title: string,
    message: string,
    data?: Record<string, string>
  ): Promise<IInAppNotification> {
    const notification = await this.repository.create({
      userId,
      type,
      title,
      message,
      data,
      isRead: false,
    } as Partial<IInAppNotification>);

    logger.info('In-app notification created', {
      userId,
      type,
      notificationId: notification._id,
    });

    return notification;
  }

  /**
   * Get notifications for a user (paginated, most recent first).
   * @param userId - Keycloak user ID
   * @param limit - Max number of results
   * @param offset - Skip this many results
   * @returns Array of notifications
   */
  async getNotifications(
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<IInAppNotification[]> {
    return this.repository.findByUser(userId, limit, offset);
  }

  /**
   * Get the unread notification count for a user.
   * @param userId - Keycloak user ID
   * @returns Unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.repository.countUnread(userId);
  }

  /**
   * Mark a single notification as read.
   * @param notificationId - Notification document ID
   * @param userId - Keycloak user ID
   * @returns Updated notification
   */
  async markAsRead(
    notificationId: string,
    userId: string
  ): Promise<IInAppNotification | null> {
    return this.repository.markAsRead(notificationId, userId);
  }

  /**
   * Mark all notifications as read for a user.
   * @param userId - Keycloak user ID
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.repository.markAllAsRead(userId);
  }
}

export default InAppNotificationService;
