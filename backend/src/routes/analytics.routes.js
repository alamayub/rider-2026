import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { adminAnalyticsController, driverAnalyticsController, riderAnalyticsController } from '../controllers/analytics.controller.js';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

analyticsRouter.get('/driver', requireRole('driver'), driverAnalyticsController);
analyticsRouter.get('/rider', requireRole('rider'), riderAnalyticsController);
analyticsRouter.get('/admin', requireRole('admin'), adminAnalyticsController);
