import { Router } from 'express';
import {
  changePasswordController,
  getMyProfileController,
  registerController,
  requestSignInOtpController,
  signInController,
  updateMyProfileController
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/register', registerController);
authRouter.post('/signin', signInController);
authRouter.post('/request-otp', requestSignInOtpController);
authRouter.get('/me', requireAuth, getMyProfileController);
authRouter.post('/me', requireAuth, updateMyProfileController);
authRouter.post('/change-password', requireAuth, changePasswordController);
