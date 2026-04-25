import { addDriverVehicle, getMyDriverVehicles } from './driver-vehicles.service.js';

export async function createDriverVehicleController(req, res) {
  try {
    const vehicle = await addDriverVehicle({
      driverId: req.user.sub,
      vehicleTypeId: req.body.vehicleTypeId,
      plateNumber: req.body.plateNumber,
      modelName: req.body.modelName,
      color: req.body.color,
      isActive: req.body.isActive,
      isDefault: req.body.isDefault
    });

    return res.status(201).json(vehicle);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function listDriverVehiclesController(req, res) {
  return res.json(await getMyDriverVehicles(req.user.sub));
}
