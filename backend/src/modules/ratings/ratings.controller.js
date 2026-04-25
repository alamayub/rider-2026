import { createRating } from './ratings.service.js';

export async function createRatingController(req, res) {
  const rating = await createRating({
    rideId: req.body.rideId,
    fromUserId: req.user.sub,
    toUserId: req.body.toUserId,
    score: req.body.score,
    comment: req.body.comment
  });

  return res.status(201).json(rating);
}
