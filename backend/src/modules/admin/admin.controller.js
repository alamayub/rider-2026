import { addCity, getAllReports, getAuditLogs, getCities, getLiveRides } from './admin.service.js';

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
