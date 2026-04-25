import { Router } from 'express';
import { registerController, requestSignInOtpController, signInController } from '../controllers/auth.controller.js';

export const authRouter = Router();

authRouter.post('/register', registerController);
authRouter.post('/signin', signInController);
authRouter.post('/request-otp', requestSignInOtpController);
