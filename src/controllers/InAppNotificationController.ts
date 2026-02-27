/**
 * @file InAppNotification Controller
 * @description HTTP request handlers for in-app notifications.
 */

import { Request, Response, NextFunction } from 'express';
import { InAppNotificationService } from '../services/InAppNotificationService';
import { AuthenticatedRequest } from '../middleware';

/**
 * InAppNotification Controller class.
 * All endpoints are user-scoped (no business scope needed).
 */
export class InAppNotificationController {
  private service: InAppNotificationService;

  constructor() {
    this.service = new InAppNotificationService();
  }

  /**
   * Get notifications for the current user.
   * GET /notifications?limit=20&offset=0
   */
  getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const notifications = await this.service.getNotifications(
        authReq.user.id,
        limit,
        offset
      );

      res.status(200).json({
        success: true,
        data: notifications,
        message: 'Notifications retrieved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get unread notification count.
   * GET /notifications/unread-count
   */
  getUnreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const count = await this.service.getUnreadCount(authReq.user.id);

      res.status(200).json({
        success: true,
        data: { count },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Mark a single notification as read.
   * PATCH /notifications/:id/read
   */
  markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = req.params;

      await this.service.markAsRead(id, authReq.user.id);

      res.status(200).json({
        success: true,
        message: 'Notification marked as read',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Mark all notifications as read.
   * PATCH /notifications/read-all
   */
  markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      await this.service.markAllAsRead(authReq.user.id);

      res.status(200).json({
        success: true,
        message: 'All notifications marked as read',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}

export default InAppNotificationController;
