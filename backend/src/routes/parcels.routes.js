import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createParcelController,
  estimateParcelFareController,
  estimateParcelFareOptionsController,
  getParcelByIdController,
  listMyParcelsController,
  updateParcelStatusController
} from '../controllers/parcels.controller.js';

export const parcelsRouter = Router();
parcelsRouter.use(requireAuth);

parcelsRouter.post('/estimate', estimateParcelFareController);
parcelsRouter.post('/estimate/options', estimateParcelFareOptionsController);
parcelsRouter.post('/', createParcelController);
parcelsRouter.post('/:parcelId/status', updateParcelStatusController);
parcelsRouter.get('/me', listMyParcelsController);
parcelsRouter.get('/:parcelId', getParcelByIdController);
