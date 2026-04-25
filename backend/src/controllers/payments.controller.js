import {
  createDriverPayout,
  createPaymentIntent,
  createRefund,
  getGroupedPaymentMethodsForApps,
  getPaymentMethodsForApps,
  getPaymentTimeline,
  getPaymentsReconciliation,
  listAdminPayoutLedger,
  markPaymentStatus,
  processPaymentWebhook
} from '../services/payments.service.js';
import { upsertPaymentMethod } from '../services/payments.service.js';

export async function createPaymentIntentController(req, res) {
  try {
    const payment = await createPaymentIntent({
      rideId: req.body.rideId,
      method: req.body.method,
      provider: req.body.provider,
      amount: req.body.amount,
      currency: req.body.currency,
      providerPaymentId: req.body.providerPaymentId,
      actorUserId: req.user.sub
    });
    return res.status(201).json(payment);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function updatePaymentStatusController(req, res) {
  try {
    const payment = await markPaymentStatus({
      paymentId: req.params.paymentId,
      status: req.body.status,
      providerPaymentId: req.body.providerPaymentId,
      failureCode: req.body.failureCode,
      failureReason: req.body.failureReason,
      actorUserId: req.user.sub
    });
    return res.json(payment);
  } catch (error) {
    if (error.message === 'Payment not found') return res.status(404).json({ error: error.message });
    return res.status(400).json({ error: error.message });
  }
}

export async function createRefundController(req, res) {
  try {
    const result = await createRefund({
      paymentId: req.params.paymentId,
      amount: req.body.amount,
      reason: req.body.reason,
      providerRefundId: req.body.providerRefundId,
      actorUserId: req.user.sub
    });
    return res.status(201).json(result);
  } catch (error) {
    if (error.message === 'Payment not found') return res.status(404).json({ error: error.message });
    return res.status(400).json({ error: error.message });
  }
}

export async function paymentTimelineController(req, res) {
  try {
    const timeline = await getPaymentTimeline({ paymentId: req.params.paymentId });
    return res.json(timeline);
  } catch (error) {
    if (error.message === 'Payment not found') return res.status(404).json({ error: error.message });
    return res.status(400).json({ error: error.message });
  }
}

export async function paymentWebhookController(req, res) {
  try {
    const result = await processPaymentWebhook({
      provider: req.body.provider,
      eventId: req.body.eventId,
      eventType: req.body.eventType,
      paymentId: req.body.paymentId,
      payload: req.body.payload,
      timestamp: req.headers['x-webhook-timestamp'] || req.body.timestamp,
      signature: req.headers['x-webhook-signature'] || req.body.signature,
      actorUserId: req.user?.sub || 'system'
    });

    return res.json(result);
  } catch (error) {
    if (error.message === 'Payment not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('signature') || error.message.includes('timestamp')) {
      return res.status(401).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message });
  }
}

export async function createPayoutController(req, res) {
  try {
    const payout = await createDriverPayout({
      paymentId: req.params.paymentId,
      driverId: req.body.driverId,
      amount: req.body.amount,
      currency: req.body.currency || 'INR',
      note: req.body.note,
      actorUserId: req.user.sub
    });
    return res.status(201).json(payout);
  } catch (error) {
    if (error.message === 'Payment not found') return res.status(404).json({ error: error.message });
    return res.status(400).json({ error: error.message });
  }
}

export async function paymentsReconciliationController(req, res) {
  const data = await getPaymentsReconciliation();
  return res.json(data);
}

export async function payoutLedgerController(req, res) {
  try {
    const ledger = await listAdminPayoutLedger({
      driverId: req.query.driverId,
      status: req.query.status,
      limit: req.query.limit
    });
    return res.json({ ledger });
  } catch (error) {
    return res.status(400).json({ error: error?.message || 'Failed to load payout ledger' });
  }
}

export async function paymentMethodsController(req, res) {
  const app = req.query.app || 'rider';
  const methods = await getPaymentMethodsForApps({
    app,
    country: req.query.country || 'np',
    currency: req.query.currency || 'NPR'
  });
  return res.json({ methods });
}

export async function groupedPaymentMethodsController(req, res) {
  const app = req.query.app || 'rider';
  const grouped = await getGroupedPaymentMethodsForApps({
    app,
    country: req.query.country || 'np',
    currency: req.query.currency || 'NPR'
  });
  return res.json(grouped);
}

export async function upsertPaymentMethodController(req, res) {
  try {
    const method = await upsertPaymentMethod(req.body, req.user.sub);
    return res.status(201).json(method);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
