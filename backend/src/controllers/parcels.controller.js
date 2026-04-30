import {
  createParcel,
  estimateParcelFare,
  estimateParcelFareOptions,
  getParcelById,
  listParcelsByUser,
  updateParcelStatus
} from '../services/parcels.service.js';

export async function estimateParcelFareController(req, res) {
  try {
    return res.json(await estimateParcelFare(req.body));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function estimateParcelFareOptionsController(req, res) {
  try {
    return res.json(await estimateParcelFareOptions(req.body));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function createParcelController(req, res) {
  try {
    if (!req.body.senderName || !req.body.senderPhone || !req.body.receiverName || !req.body.receiverPhone) {
      return res.status(400).json({ error: 'senderName, senderPhone, receiverName, receiverPhone are required' });
    }
    const parcel = await createParcel({ ...req.body, senderUserId: req.user.sub });
    return res.status(201).json(parcel);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function updateParcelStatusController(req, res) {
  try {
    const parcel = await updateParcelStatus({
      parcelId: req.params.parcelId,
      status: req.body.status,
      otp: req.body.otp,
      actorUserId: req.user.sub
    });
    return res.json(parcel);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function listMyParcelsController(req, res) {
  return res.json(await listParcelsByUser(req.user.sub, req.user.role));
}

export async function getParcelByIdController(req, res) {
  const parcel = await getParcelById(req.params.parcelId);
  if (!parcel) return res.status(404).json({ error: 'Parcel not found' });
  return res.json(parcel);
}
