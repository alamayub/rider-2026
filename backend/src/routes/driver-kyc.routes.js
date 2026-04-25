import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  getMyKycController,
  listDriverKycController,
  reviewDriverKycController,
  submitDriverKycController
} from '../controllers/driver-kyc.controller.js';

export const driverKycRouter = Router();

driverKycRouter.use(requireAuth);
driverKycRouter.get('/me', requireRole('driver'), getMyKycController);
driverKycRouter.post('/submit', requireRole('driver'), submitDriverKycController);

driverKycRouter.get('/admin', requireRole('admin'), listDriverKycController);
driverKycRouter.post('/admin/:driverId/review', requireRole('admin'), reviewDriverKycController);
