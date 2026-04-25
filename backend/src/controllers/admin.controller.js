import {
  addCity,
  addVehicleType,
  getAllReports,
  getAuditLogs,
  getCities,
  getLiveRides,
  getUserAccountActions,
  getUsers,
  searchUsersForAdmin,
  getVehicleTypes,
  rebuildCounters,
  setUserAccountStatus
} from '../services/admin.service.js';

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

export async function listUsersController(req, res) {
  const limit = Number(req.query.limit || 200);
  return res.json(
    await getUsers({
      role: req.query.role || null,
      status: req.query.status || null,
      limit: Number.isNaN(limit) ? 200 : limit
    })
  );
}

export async function searchUsersController(req, res) {
  const q = String(req.query.q || '').trim();
  const rawLimit = Number(req.query.limit || 25);
  const limit = Math.min(50, Math.max(1, Number.isNaN(rawLimit) ? 25 : rawLimit));
  if (q.length < 2) {
    return res.json([]);
  }
  return res.json(
    await searchUsersForAdmin({
      q,
      role: req.query.role || null,
      status: req.query.status || null,
      limit
    })
  );
}

export async function updateUserStatusController(req, res) {
  try {
    const userId = req.params.userId;
    const status = req.body.status;
    const reason = req.body.reason;
    return res.json(await setUserAccountStatus({ userId, status, reason, actorUserId: req.user.sub }));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function userAccountActionsController(req, res) {
  const limit = Number(req.query.limit || 100);
  return res.json(await getUserAccountActions(req.params.userId, Number.isNaN(limit) ? 100 : limit));
}

export async function rebuildCountersController(req, res) {
  return res.json(await rebuildCounters(req.user.sub));
}
