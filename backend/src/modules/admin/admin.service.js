import { createCity, listActiveRides, listAllReports, listAuditLogs, listCities } from '../../db/store.js';

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
