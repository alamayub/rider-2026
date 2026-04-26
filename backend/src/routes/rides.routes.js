import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createRideController,
  estimateFareController,
  getRideByIdController,
  listCitiesController,
  listVehicleTypesController,
  listMyRidesController,
  updateRideStatusController
} from '../controllers/rides.controller.js';

export const ridesRouter = Router();

ridesRouter.use(requireAuth);

ridesRouter.post('/estimate', estimateFareController);
ridesRouter.get('/cities', listCitiesController);
ridesRouter.get('/vehicle-types', listVehicleTypesController);
ridesRouter.post('/', createRideController);
ridesRouter.post('/:rideId/status', updateRideStatusController);
ridesRouter.get('/me', listMyRidesController);
ridesRouter.get('/:rideId', getRideByIdController);
