import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createRatingController, listMyRatingsController, myRatingSummaryController, userRatingSummaryController } from '../controllers/ratings.controller.js';

export const ratingsRouter = Router();
ratingsRouter.use(requireAuth);

ratingsRouter.post('/', createRatingController);
ratingsRouter.get('/me', listMyRatingsController);
ratingsRouter.get('/me/summary', myRatingSummaryController);
ratingsRouter.get('/users/:userId/summary', userRatingSummaryController);
