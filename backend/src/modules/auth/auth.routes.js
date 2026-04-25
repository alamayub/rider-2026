import { Router } from 'express';
import { signInController } from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/signin', signInController);
