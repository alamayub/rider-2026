import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { createCityController, getAuditLogsController, getCitiesController, getLiveRidesController, getReportsController } from './admin.controller.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));

adminRouter.get('/cities', getCitiesController);
adminRouter.post('/cities', createCityController);
adminRouter.get('/rides/live', getLiveRidesController);
adminRouter.get('/reports', getReportsController);
adminRouter.get('/audit-logs', getAuditLogsController);
