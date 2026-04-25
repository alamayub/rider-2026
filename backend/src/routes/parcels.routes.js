import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createParcelController,
  estimateParcelFareController,
  getParcelByIdController,
  listMyParcelsController,
  updateParcelStatusController
} from '../controllers/parcels.controller.js';

export const parcelsRouter = Router();
parcelsRouter.use(requireAuth);

parcelsRouter.post('/estimate', estimateParcelFareController);
parcelsRouter.post('/', createParcelController);
parcelsRouter.post('/:parcelId/status', updateParcelStatusController);
parcelsRouter.get('/me', listMyParcelsController);
parcelsRouter.get('/:parcelId', getParcelByIdController);
