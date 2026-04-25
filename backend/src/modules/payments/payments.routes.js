import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { createPaymentIntentController, paymentWebhookController } from './payments.controller.js';

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

paymentsRouter.post('/intent', createPaymentIntentController);
paymentsRouter.post('/webhook', paymentWebhookController);
