import { getAdminAnalytics, getDriverAnalytics, getRiderAnalytics } from '../services/analytics.service.js';

export async function driverAnalyticsController(req, res) {
  return res.json(await getDriverAnalytics(req.user.sub));
}

export async function riderAnalyticsController(req, res) {
  return res.json(await getRiderAnalytics(req.user.sub));
}

export async function adminAnalyticsController(_req, res) {
  return res.json(await getAdminAnalytics());
}
