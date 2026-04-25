import { Router } from 'express';
import { requestSignInOtpController, signInController } from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/signin', signInController);
authRouter.post('/request-otp', requestSignInOtpController);
