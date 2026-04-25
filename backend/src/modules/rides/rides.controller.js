import { createRide, estimateFare, getRideById, listAvailableVehicleTypes, listRidesByUser, updateRideStatus } from './rides.service.js';

export async function estimateFareController(req, res) {
  try {
    return res.json(await estimateFare(req.body));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function createRideController(req, res) {
  try {
    const ride = await createRide({ ...req.body, riderId: req.user.sub });
    return res.status(201).json(ride);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function updateRideStatusController(req, res) {
  try {
    const ride = await updateRideStatus({ rideId: req.params.rideId, status: req.body.status, otp: req.body.otp, actorUserId: req.user.sub });
    return res.json(ride);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function listMyRidesController(req, res) {
  return res.json(await listRidesByUser(req.user.sub, req.user.role));
}

export async function getRideByIdController(req, res) {
  const ride = await getRideById(req.params.rideId);
  if (!ride) return res.status(404).json({ error: 'Ride not found' });
  return res.json(ride);
}

export async function listVehicleTypesController(_req, res) {
  return res.json(await listAvailableVehicleTypes());
}
