import { createDriverVehicleRecord, findVehicleTypeById, listDriverVehicles } from '../db/store.js';

export async function addDriverVehicle({ driverId, vehicleTypeId, plateNumber, modelName, color, isActive, isDefault }) {
  if (!vehicleTypeId || !plateNumber) {
    throw new Error('vehicleTypeId and plateNumber are required');
  }

  const vehicleType = await findVehicleTypeById(vehicleTypeId);
  if (!vehicleType || !vehicleType.isActive) {
    throw new Error('Vehicle type not found or inactive');
  }

  return createDriverVehicleRecord({
    driverId,
    vehicleTypeId,
    plateNumber,
    modelName,
    color,
    isActive,
    isDefault
  }, driverId);
}

export async function getMyDriverVehicles(driverId) {
  return listDriverVehicles(driverId);
}
