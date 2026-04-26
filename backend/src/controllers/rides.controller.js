import {
  createRide,
  estimateFare,
  getRideByIdForUser,
  listAvailableVehicleTypes,
  listBookingCities,
  listRidesByUserForViewer,
  toRideResponseForUser,
  updateRideStatus
} from '../services/rides.service.js';

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
    return res.status(201).json(toRideResponseForUser(ride, req.user.sub, req.user.role));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function updateRideStatusController(req, res) {
  try {
    const ride = await updateRideStatus({ rideId: req.params.rideId, status: req.body.status, otp: req.body.otp, actorUserId: req.user.sub });
    return res.json(toRideResponseForUser(ride, req.user.sub, req.user.role));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function listMyRidesController(req, res) {
  return res.json(await listRidesByUserForViewer(req.user.sub, req.user.role));
}

export async function getRideByIdController(req, res) {
  try {
    const ride = await getRideByIdForUser(req.params.rideId, req.user.sub, req.user.role);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    return res.json(ride);
  } catch (err) {
    if (err.message === 'FORBIDDEN_GET_RIDE') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return res.status(500).json({ error: err.message || 'Failed to get ride' });
  }
}

export async function listVehicleTypesController(_req, res) {
  return res.json(await listAvailableVehicleTypes());
}

export async function listCitiesController(_req, res) {
  return res.json(await listBookingCities());
}
