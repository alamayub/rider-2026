import { createRatingRecord } from '../../db/store.js';

export async function createRating({ rideId, fromUserId, toUserId, score, comment }) {
  return createRatingRecord({
    rideId,
    fromUserId,
    toUserId,
    score,
    comment: comment || '',
    actorUserId: fromUserId
  });
}
