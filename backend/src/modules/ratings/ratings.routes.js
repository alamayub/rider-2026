import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { createRatingController } from './ratings.controller.js';

export const ratingsRouter = Router();
ratingsRouter.use(requireAuth);

ratingsRouter.post('/', createRatingController);
