import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  createCityController,
  listUsersController,
  createVehicleTypeController,
  getAuditLogsController,
  getCitiesController,
  getLiveRidesController,
  getReportsController,
  getVehicleTypesController,
  rebuildCountersController,
  updateUserStatusController,
  userAccountActionsController
} from '../controllers/admin.controller.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));

adminRouter.get('/cities', getCitiesController);
adminRouter.post('/cities', createCityController);
adminRouter.get('/rides/live', getLiveRidesController);
adminRouter.get('/reports', getReportsController);
adminRouter.get('/audit-logs', getAuditLogsController);
adminRouter.get('/vehicle-types', getVehicleTypesController);
adminRouter.post('/vehicle-types', createVehicleTypeController);
adminRouter.get('/users', listUsersController);
adminRouter.post('/users/:userId/status', updateUserStatusController);
adminRouter.get('/users/:userId/account-actions', userAccountActionsController);
adminRouter.post('/counters/rebuild', rebuildCountersController);
