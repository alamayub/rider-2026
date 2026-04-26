import { createOfferRecord, deleteOfferRecord, listActiveOffers, listOffers, updateOfferRecord } from '../db/store.js';

export async function createOffer(payload, actorUserId) {
  if (!payload.title || !payload.startsAt || !payload.endsAt) {
    throw new Error('title, startsAt, endsAt are required');
  }
  return createOfferRecord(payload, actorUserId);
}

export async function getActiveOffers(cityId) {
  return listActiveOffers(cityId || null);
}

export async function getAllOffers() {
  return listOffers();
}

export async function updateOffer(offerId, payload, actorUserId) {
  return updateOfferRecord(offerId, payload, actorUserId);
}

export async function removeOffer(offerId, actorUserId) {
  return deleteOfferRecord(offerId, actorUserId);
}
