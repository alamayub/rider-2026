import {
  createAccountActionRecord,
  createCity,
  createVehicleTypeRecord,
  findUserById,
  listAccountActionsByUser,
  listActiveRides,
  listAllReports,
  listAuditLogs,
  listCities,
  listUsers,
  listVehicleTypes,
  rebuildPlatformCounters,
  updateUserStatus
} from '../db/store.js';

export async function getCities() {
  return listCities();
}

export async function addCity(payload, actorUserId) {
  return createCity(payload, actorUserId);
}

export async function getLiveRides() {
  return listActiveRides();
}

export async function getAllReports() {
  return listAllReports();
}

export async function getAuditLogs(limit) {
  return listAuditLogs(limit);
}

export async function getVehicleTypes() {
  return listVehicleTypes({ onlyActive: false });
}

export async function addVehicleType(payload, actorUserId) {
  return createVehicleTypeRecord(payload, actorUserId);
}

export async function getUsers({ role, status, limit }) {
  return listUsers({ role, status, limit });
}

export async function getUserAccountActions(userId, limit) {
  return listAccountActionsByUser(userId, limit);
}

export async function setUserAccountStatus({ userId, status, actorUserId, reason }) {
  const user = await findUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  if (!['active', 'suspended', 'banned'].includes(status)) {
    throw new Error('Invalid status');
  }
  const updated = await updateUserStatus(userId, status);
  await createAccountActionRecord({
    userId,
    action: status === 'active' ? 'activate' : status,
    source: 'admin_manual',
    metadata: { reason: reason || null, previousStatus: user.status, nextStatus: status },
    actorUserId
  });
  return updated;
}

export async function rebuildCounters(actorUserId) {
  return rebuildPlatformCounters(actorUserId);
}
