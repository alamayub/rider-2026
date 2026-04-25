import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import {
  createPayoutController,
  createPaymentIntentController,
  createRefundController,
  groupedPaymentMethodsController,
  paymentsReconciliationController,
  paymentMethodsController,
  paymentTimelineController,
  paymentWebhookController,
  upsertPaymentMethodController,
  updatePaymentStatusController
} from './payments.controller.js';

export const paymentsRouter = Router();

paymentsRouter.post('/intent', requireAuth, createPaymentIntentController);
paymentsRouter.patch('/:paymentId/status', requireAuth, updatePaymentStatusController);
paymentsRouter.post('/:paymentId/refunds', requireAuth, createRefundController);
paymentsRouter.get('/:paymentId/timeline', requireAuth, paymentTimelineController);
paymentsRouter.get('/methods/list', requireAuth, paymentMethodsController);
paymentsRouter.get('/methods/grouped', requireAuth, groupedPaymentMethodsController);
paymentsRouter.post('/methods/admin', requireAuth, requireRole('admin'), upsertPaymentMethodController);
paymentsRouter.post('/:paymentId/payouts', requireAuth, requireRole('admin'), createPayoutController);
paymentsRouter.get('/admin/reconciliation', requireAuth, requireRole('admin'), paymentsReconciliationController);
paymentsRouter.post('/webhook', paymentWebhookController);
