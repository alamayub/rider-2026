import { getMyKyc, listKycForAdmin, reviewDriverKyc, submitDriverKyc } from '../services/driver-kyc.service.js';

export async function submitDriverKycController(req, res) {
  try {
    const record = await submitDriverKyc({
      driverId: req.user.sub,
      fullName: req.body.fullName,
      licenseNumber: req.body.licenseNumber,
      documentUrl: req.body.documentUrl
    });

    return res.status(201).json(record);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function getMyKycController(req, res) {
  const record = await getMyKyc(req.user.sub);
  return res.json(record || { status: 'not_submitted' });
}

export async function listDriverKycController(req, res) {
  return res.json(await listKycForAdmin(req.query.status));
}

export async function reviewDriverKycController(req, res) {
  try {
    const record = await reviewDriverKyc({
      driverId: req.params.driverId,
      reviewerAdminId: req.user.sub,
      action: req.body.action,
      rejectionReason: req.body.rejectionReason
    });

    return res.json(record);
  } catch (error) {
    const status = error.message.includes('not found') ? 404 : 400;
    return res.status(status).json({ error: error.message });
  }
}
