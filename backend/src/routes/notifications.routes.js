import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  globalNotificationStatsController,
  listMyNotificationsController,
  markNotificationDeliveredController,
  markNotificationReadController,
  markNotificationReceivedController,
  myNotificationStatsController,
  registerDeviceTokenController,
  sendNotificationController
} from '../controllers/notifications.controller.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/me', listMyNotificationsController);
notificationsRouter.get('/me/stats', myNotificationStatsController);
notificationsRouter.post('/me/device-token', registerDeviceTokenController);
notificationsRouter.post('/:notificationId/received', markNotificationReceivedController);
notificationsRouter.post('/:notificationId/delivered', markNotificationDeliveredController);
notificationsRouter.post('/:notificationId/read', markNotificationReadController);

notificationsRouter.post('/admin/send', requireRole('admin'), sendNotificationController);
notificationsRouter.get('/admin/stats', requireRole('admin'), globalNotificationStatsController);

