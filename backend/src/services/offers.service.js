import { createOfferRecord, listActiveOffers } from '../db/store.js';

export async function createOffer(payload, actorUserId) {
  if (!payload.title || !payload.startsAt || !payload.endsAt) {
    throw new Error('title, startsAt, endsAt are required');
  }
  return createOfferRecord(payload, actorUserId);
}

export async function getActiveOffers(cityId) {
  return listActiveOffers(cityId || null);
}
