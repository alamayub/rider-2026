import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  createCityController,
  createAdminCouponController,
  createAdminOfferController,
  deleteCityController,
  deleteAdminCouponController,
  deleteAdminOfferController,
  listAdminCouponsController,
  listAdminOffersController,
  listUsersController,
  searchUsersController,
  createVehicleTypeController,
  deleteVehicleTypeController,
  getAuditLogsController,
  getCitiesController,
  getLiveRidesController,
  getReportsController,
  getVehicleTypesController,
  rebuildCountersController,
  updateCityController,
  updateUserStatusController,
  updateAdminCouponController,
  updateAdminOfferController,
  updateVehicleTypeController,
  userAccountActionsController
} from '../controllers/admin.controller.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));

adminRouter.get('/cities', getCitiesController);
adminRouter.post('/cities', createCityController);
adminRouter.patch('/cities/:cityId', updateCityController);
adminRouter.delete('/cities/:cityId', deleteCityController);
adminRouter.get('/rides/live', getLiveRidesController);
adminRouter.get('/reports', getReportsController);
adminRouter.get('/audit-logs', getAuditLogsController);
adminRouter.get('/vehicle-types', getVehicleTypesController);
adminRouter.post('/vehicle-types', createVehicleTypeController);
adminRouter.patch('/vehicle-types/:vehicleTypeId', updateVehicleTypeController);
adminRouter.delete('/vehicle-types/:vehicleTypeId', deleteVehicleTypeController);
adminRouter.get('/coupons', listAdminCouponsController);
adminRouter.post('/coupons', createAdminCouponController);
adminRouter.patch('/coupons/:couponId', updateAdminCouponController);
adminRouter.delete('/coupons/:couponId', deleteAdminCouponController);
adminRouter.get('/offers', listAdminOffersController);
adminRouter.post('/offers', createAdminOfferController);
adminRouter.patch('/offers/:offerId', updateAdminOfferController);
adminRouter.delete('/offers/:offerId', deleteAdminOfferController);
adminRouter.get('/users/search', searchUsersController);
adminRouter.get('/users', listUsersController);
adminRouter.post('/users/:userId/status', updateUserStatusController);
adminRouter.get('/users/:userId/account-actions', userAccountActionsController);
adminRouter.post('/counters/rebuild', rebuildCountersController);
