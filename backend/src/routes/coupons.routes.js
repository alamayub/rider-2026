import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { applyCouponController, createCouponController, listCouponsController, validateCouponController } from '../controllers/coupons.controller.js';

export const couponsRouter = Router();

couponsRouter.use(requireAuth);
couponsRouter.post('/validate', validateCouponController);
couponsRouter.post('/apply', applyCouponController);

couponsRouter.get('/admin', requireRole('admin'), listCouponsController);
couponsRouter.post('/admin', requireRole('admin'), createCouponController);
