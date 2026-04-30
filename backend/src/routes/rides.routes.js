import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createRideController,
  estimateFareController,
  estimateFareOptionsController,
  getRideByIdController,
  listCitiesController,
  listVehicleTypesController,
  listMyRidesController,
  resolveCityController,
  reversePlaceController,
  searchPlacesController,
  updateRideStatusController
} from '../controllers/rides.controller.js';

export const ridesRouter = Router();

ridesRouter.use(requireAuth);

ridesRouter.post('/estimate', estimateFareController);
ridesRouter.post('/estimate/options', estimateFareOptionsController);
ridesRouter.get('/cities', listCitiesController);
ridesRouter.get('/cities/resolve', resolveCityController);
ridesRouter.get('/places/search', searchPlacesController);
ridesRouter.get('/places/reverse', reversePlaceController);
ridesRouter.get('/vehicle-types', listVehicleTypesController);
ridesRouter.post('/', createRideController);
ridesRouter.post('/:rideId/status', updateRideStatusController);
ridesRouter.get('/me', listMyRidesController);
ridesRouter.get('/:rideId', getRideByIdController);
