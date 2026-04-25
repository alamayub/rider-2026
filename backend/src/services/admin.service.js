import { createCity, createVehicleTypeRecord, listActiveRides, listAllReports, listAuditLogs, listCities, listVehicleTypes } from '../db/store.js';

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
