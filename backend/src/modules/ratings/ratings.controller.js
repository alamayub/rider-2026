import { createRating, getMyRatingSummary, getMyReceivedRatings } from './ratings.service.js';

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
