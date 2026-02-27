/**
 * @file In-app notification routes
 * @description Routes for in-app notification management.
 * All routes are user-scoped and require authentication.
 */

import { Router } from 'express';
import { InAppNotificationController } from '../../controllers/InAppNotificationController';
import { authenticate } from '../../middleware';

const router = Router();
const notificationController = new InAppNotificationController();

router.use(authenticate);

/** GET /notifications */
router.get('/', notificationController.getNotifications);

/** GET /notifications/unread-count */
router.get('/unread-count', notificationController.getUnreadCount);

/** PATCH /notifications/read-all (must be before /:id) */
router.patch('/read-all', notificationController.markAllAsRead);

/** PATCH /notifications/:id/read */
router.patch('/:id/read', notificationController.markAsRead);

export default router;
