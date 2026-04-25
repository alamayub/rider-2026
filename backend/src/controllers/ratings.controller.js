import { createRating, getMyRatingSummary, getMyReceivedRatings, getUserPublicRatingSummary } from '../services/ratings.service.js';

export async function createRatingController(req, res) {
  try {
    const rating = await createRating({
      rideId: req.body.rideId,
      fromUserId: req.user.sub,
      toUserId: req.body.toUserId,
      score: Number(req.body.score),
      comment: req.body.comment
    });

    return res.status(201).json(rating);
  } catch (error) {
    const conflictErrors = new Set(['Rating already submitted for this direction']);
    const notFoundErrors = new Set(['Ride not found']);
    if (conflictErrors.has(error.message)) return res.status(409).json({ error: error.message });
    if (notFoundErrors.has(error.message)) return res.status(404).json({ error: error.message });
    return res.status(400).json({ error: error.message });
  }
}

export async function listMyRatingsController(req, res) {
  return res.json(await getMyReceivedRatings(req.user.sub));
}

export async function myRatingSummaryController(req, res) {
  return res.json(await getMyRatingSummary(req.user.sub));
}

export async function userRatingSummaryController(req, res) {
  try {
    const summary = await getUserPublicRatingSummary({
      viewerRole: req.user.role,
      targetUserId: req.params.userId
    });
    return res.json(summary);
  } catch (error) {
    if (error.message === 'User not found') return res.status(404).json({ error: error.message });
    if (error.message === 'Forbidden rating summary access') return res.status(403).json({ error: error.message });
    return res.status(400).json({ error: error.message });
  }
}
