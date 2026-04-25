import { addCity, addVehicleType, getAllReports, getAuditLogs, getCities, getLiveRides, getVehicleTypes } from '../services/admin.service.js';

export async function getCitiesController(_req, res) {
  return res.json(await getCities());
}

export async function createCityController(req, res) {
  const city = await addCity(req.body, req.user.sub);
  return res.status(201).json(city);
}

export async function getLiveRidesController(_req, res) {
  return res.json(await getLiveRides());
}

export async function getReportsController(_req, res) {
  return res.json(await getAllReports());
}

export async function getAuditLogsController(req, res) {
  const limit = Number(req.query.limit || 200);
  return res.json(await getAuditLogs(Number.isNaN(limit) ? 200 : limit));
}

export async function getVehicleTypesController(_req, res) {
  return res.json(await getVehicleTypes());
}

export async function createVehicleTypeController(req, res) {
  try {
    const { id, code, name, capacity, fareMultiplier } = req.body;
    if (!code || !name || capacity == null || fareMultiplier == null) {
      return res.status(400).json({ error: 'code, name, capacity, fareMultiplier are required (id optional)' });
    }
    return res.status(201).json(await addVehicleType({ id, code, name, capacity, fareMultiplier, isActive: req.body.isActive }, req.user.sub));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
