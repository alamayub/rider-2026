import { createOffer, getActiveOffers } from './offers.service.js';

export async function listOffersController(req, res) {
  return res.json(await getActiveOffers(req.query.cityId));
}

export async function createOfferController(req, res) {
  try {
    const offer = await createOffer(req.body, req.user.sub);
    return res.status(201).json(offer);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
