import { listMyReports, submitReport } from '../services/reports.service.js';

export async function createReportController(req, res) {
  const { rideId, reportedUserId, reason, description } = req.body;

  if (!reportedUserId || !reason) {
    return res.status(400).json({ error: 'reportedUserId and reason are required' });
  }

  try {
    const result = await submitReport({
      rideId,
      reporterUserId: req.user.sub,
      reportedUserId,
      reason,
      description
    });

    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function listMyReportsController(req, res) {
  return res.json(await listMyReports(req.user.sub));
}
