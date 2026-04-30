import { reversePlace, searchPlaces } from '../services/places.service.js';
import { fetchDrivingRoutePreview } from '../services/routing.service.js';
import {
  createRide,
  estimateFare,
  estimateFareOptions,
  getRideByIdForUser,
  listAvailableVehicleTypes,
  listBookingCities,
  listRidesByUserForViewer,
  resolveCityForLocation,
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

export async function estimateFareOptionsController(req, res) {
  try {
    return res.json(await estimateFareOptions(req.body));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function createRideController(req, res) {
  try {
    const ride = await createRide({ ...req.body, riderId: req.user.sub });
    return res.status(201).json(toRideResponseForUser(ride, req.user.sub, req.user.role));
  } catch (error) {
    const msg = error?.message || String(error);
    if (/active ride/i.test(msg)) {
      return res.status(409).json({ error: msg, code: 'ACTIVE_RIDE_EXISTS' });
    }
    return res.status(400).json({ error: msg });
  }
}

export async function updateRideStatusController(req, res) {
  try {
    const ride = await updateRideStatus({
      rideId: req.params.rideId,
      status: req.body.status,
      otp: req.body.otp,
      cancellationReason: req.body.cancellationReason,
      actorUserId: req.user.sub
    });
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

export async function resolveCityController(req, res) {
  try {
    const resolved = await resolveCityForLocation(req.query.lat, req.query.lng);
    if (!resolved) {
      return res.status(404).json({
        error: 'We do not operate in this area yet.',
        code: 'OUT_OF_SERVICE_AREA'
      });
    }
    return res.json(resolved);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function searchPlacesController(req, res) {
  try {
    const q = req.query.q;
    const limit = req.query.limit;
    return res.json(await searchPlaces({ query: q, limit }));
  } catch (error) {
    return res.status(502).json({ error: error.message || 'Place search failed' });
  }
}

export async function reversePlaceController(req, res) {
  try {
    return res.json(await reversePlace({ lat: req.query.lat, lng: req.query.lng }));
  } catch (error) {
    const msg = error?.message || 'Reverse geocode failed';
    const status = /Invalid coordinates/i.test(msg) ? 400 : 502;
    return res.status(status).json({ error: msg });
  }
}

function queryFloat(name, v) {
  if (v === undefined || v === null || v === '') {
    throw new Error(`Invalid ${name}`);
  }
  const raw = Array.isArray(v) ? v[0] : v;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid ${name}`);
  }
  return n;
}

/** Proxied OSRM driving route for map preview (auth required). */
export async function drivingRouteController(req, res) {
  try {
    const body = await fetchDrivingRoutePreview({
      pickupLat: queryFloat('pickupLat', req.query.pickupLat),
      pickupLng: queryFloat('pickupLng', req.query.pickupLng),
      dropLat: queryFloat('dropLat', req.query.dropLat),
      dropLng: queryFloat('dropLng', req.query.dropLng)
    });
    return res.json(body);
  } catch (error) {
    const msg = error?.message || 'Routing failed';
    const isClient =
      /Invalid|out of range|must differ|too short/i.test(msg) ||
      msg.includes('Latitude') ||
      msg.includes('Longitude') ||
      msg.includes('No driving route found');
    return res.status(isClient ? 400 : 502).json({ error: msg });
  }
}
