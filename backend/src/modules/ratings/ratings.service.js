import { createRatingRecord, findDirectionalRating, findRideById, getUserRatingStats, listRatingsForUser } from '../../db/store.js';

export async function createRating({ rideId, fromUserId, toUserId, score, comment }) {
  if (!rideId || !toUserId) {
    throw new Error('rideId and toUserId are required');
  }
  if (typeof score !== 'number' || score < 1 || score > 5) {
    throw new Error('score must be between 1 and 5');
  }
  if (fromUserId === toUserId) {
    throw new Error('Cannot rate yourself');
  }

  const ride = await findRideById(rideId);
  if (!ride) {
    throw new Error('Ride not found');
  }
  if (ride.status !== 'completed') {
    throw new Error('Ratings are allowed only after ride completion');
  }

  const isRiderToDriver = fromUserId === ride.riderId && toUserId === ride.driverId;
  const isDriverToRider = fromUserId === ride.driverId && toUserId === ride.riderId;
  if (!isRiderToDriver && !isDriverToRider) {
    throw new Error('Only ride participants can rate each other');
  }

  const existing = await findDirectionalRating({ rideId, fromUserId, toUserId });
  if (existing) {
    throw new Error('Rating already submitted for this direction');
  }

  const rating = await createRatingRecord({
    rideId,
    fromUserId,
    toUserId,
    score,
    comment: comment || '',
    actorUserId: fromUserId
  });
  const recipientStats = await getUserRatingStats(toUserId);
  return { ...rating, recipientStats };
}

export async function getMyReceivedRatings(userId) {
  return listRatingsForUser(userId);
}

export async function getMyRatingSummary(userId) {
  return getUserRatingStats(userId);
}
