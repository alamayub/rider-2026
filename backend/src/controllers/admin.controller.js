import {
  addCity,
  addVehicleType,
  getAllReports,
  getAuditLogs,
  getCities,
  getLiveRides,
  getUserAccountActions,
  getUsers,
  removeCity,
  searchUsersForAdmin,
  getVehicleTypes,
  rebuildCounters,
  removeVehicleType,
  setUserAccountStatus,
  updateCity,
  updateVehicleType
} from '../services/admin.service.js';

export async function getCitiesController(_req, res) {
  return res.json(await getCities());
}

export async function createCityController(req, res) {
  try {
    const city = await addCity(req.body, req.user.sub);
    return res.status(201).json(city);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to create city' });
  }
}

export async function updateCityController(req, res) {
  try {
    const city = await updateCity(req.params.cityId, req.body, req.user.sub);
    return res.json(city);
  } catch (error) {
    if (error.message === 'City not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Failed to update city' });
  }
}

export async function deleteCityController(req, res) {
  try {
    const result = await removeCity(req.params.cityId, req.user.sub);
    return res.json(result);
  } catch (error) {
    if (error.message === 'City not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Failed to delete city' });
  }
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

export async function updateVehicleTypeController(req, res) {
  try {
    const v = await updateVehicleType(req.params.vehicleTypeId, req.body, req.user.sub);
    return res.json(v);
  } catch (error) {
    if (error.message === 'Vehicle type not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Failed to update vehicle type' });
  }
}

export async function deleteVehicleTypeController(req, res) {
  try {
    const result = await removeVehicleType(req.params.vehicleTypeId, req.user.sub);
    return res.json(result);
  } catch (error) {
    if (error.message === 'Vehicle type not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Failed to delete vehicle type' });
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
