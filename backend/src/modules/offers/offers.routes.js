import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { createOfferController, listOffersController } from './offers.controller.js';

export const offersRouter = Router();

offersRouter.use(requireAuth);
offersRouter.get('/', listOffersController);
offersRouter.post('/admin', requireRole('admin'), createOfferController);
