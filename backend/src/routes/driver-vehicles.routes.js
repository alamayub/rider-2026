import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createDriverVehicleController, listDriverVehiclesController } from '../controllers/driver-vehicles.controller.js';

export const driverVehiclesRouter = Router();
driverVehiclesRouter.use(requireAuth, requireRole('driver'));

driverVehiclesRouter.post('/', createDriverVehicleController);
driverVehiclesRouter.get('/', listDriverVehiclesController);
