import { createHmac } from 'crypto';
import { env } from '../config/env.js';
import { assertProviderEnabled, buildGatewaySession } from './payment-providers.js';
import {
  createPaymentEventRecord,
  createPayoutLedgerRecord,
  createPaymentRecord,
  createPaymentRefundRecord,
  createProcessedWebhookRecord,
  findPaymentById,
  findRideById,
  getPaymentsReconciliationSummary,
  listPaymentEvents,
  listPaymentMethods,
  listPayoutLedger,
  listPaymentRefunds,
  upsertPaymentMethodRecord,
  updatePaymentGatewayDetails,
  updatePaymentStatus
} from '../db/store.js';

function commissionAmount(amount) {
  return Math.round((Number(amount || 0) * env.commissionRatePercent) / 100);
}

function webhookMessage({ provider, eventId, eventType, paymentId, payload, timestamp }) {
  return JSON.stringify({
    provider: provider || 'manual',
    eventId,
    eventType,
    paymentId: paymentId || null,
    payload: payload || {},
    timestamp: Number(timestamp || 0)
  });
}

export function buildWebhookSignature({ provider, eventId, eventType, paymentId, payload, timestamp }) {
  return createHmac('sha256', env.webhookSecret).update(webhookMessage({ provider, eventId, eventType, paymentId, payload, timestamp })).digest('hex');
}

function verifyWebhookSignature({ provider, eventId, eventType, paymentId, payload, timestamp, signature }) {
  if (!signature) throw new Error('Missing webhook signature');
  const ts = Number(timestamp || 0);
  if (!Number.isFinite(ts)) throw new Error('Invalid webhook timestamp');
  const skew = Math.abs(Date.now() - ts);
  if (skew > env.webhookMaxSkewSeconds * 1000) throw new Error('Webhook timestamp outside allowed skew');
  const expected = buildWebhookSignature({ provider, eventId, eventType, paymentId, payload, timestamp: ts });
  if (expected !== signature) throw new Error('Invalid webhook signature');
}

export async function createPaymentIntent({ rideId, method, provider, amount, currency, providerPaymentId, actorUserId }) {
  const normalizedProvider = assertProviderEnabled(provider || 'esewa');
  const availableMethods = await listPaymentMethods({ activeOnly: true, country: 'np', currency: currency || 'NPR' });
  const matched = availableMethods.find((m) => m.provider === normalizedProvider && m.methodCode === String(method || 'wallet'));
  if (!matched) {
    throw new Error(`Payment method not enabled for provider ${normalizedProvider}`);
  }
  const payment = await createPaymentRecord({
    rideId,
    method: matched.methodCode,
    provider: normalizedProvider,
    amount,
    currency: currency || 'NPR',
    providerPaymentId: providerPaymentId || null,
    actorUserId
  });
  const session = buildGatewaySession({
    provider: normalizedProvider,
    paymentId: payment.id,
    amount,
    currency: payment.currency
  });
  const updatedPayment = await updatePaymentGatewayDetails({
    paymentId: payment.id,
    providerOrderId: session.providerOrderId,
    providerMetadata: { checkoutUrl: session.checkoutUrl },
    actorUserId
  });
  await createPaymentEventRecord({
    paymentId: updatedPayment.id,
    type: 'payment.intent.created',
    payload: { amount, currency: payment.currency, provider: normalizedProvider, providerOrderId: session.providerOrderId, checkoutUrl: session.checkoutUrl },
    actorUserId
  });
  return {
    ...updatedPayment,
    provider: normalizedProvider,
    providerOrderId: session.providerOrderId,
    providerMetadata: { ...(updatedPayment.providerMetadata || {}), checkoutUrl: session.checkoutUrl },
    gatewaySession: session
  };
}

export async function getPaymentMethodsForApps({ app = 'rider', country = 'np', currency = 'NPR' } = {}) {
  return listPaymentMethods({ activeOnly: true, app, country, currency });
}

export async function getGroupedPaymentMethodsForApps({ app = 'rider', country = 'np', currency = 'NPR' } = {}) {
  const methods = await getPaymentMethodsForApps({ app, country, currency });
  const grouped = {
    wallets: [],
    bankTransfer: [],
    cards: [],
    others: []
  };

  for (const method of methods) {
    if (method.category === 'wallet') grouped.wallets.push(method);
    else if (method.category === 'bank' || method.methodCode === 'bank_transfer') grouped.bankTransfer.push(method);
    else if (method.category === 'card') grouped.cards.push(method);
    else grouped.others.push(method);
  }

  return grouped;
}

export async function upsertPaymentMethod(data, actorUserId) {
  assertProviderEnabled(data.provider);
  return upsertPaymentMethodRecord(data, actorUserId);
}

export async function getPaymentTimeline({ paymentId }) {
  const payment = await findPaymentById(paymentId);
  if (!payment) throw new Error('Payment not found');
  const [events, refunds] = await Promise.all([listPaymentEvents(paymentId), listPaymentRefunds(paymentId)]);
  return { payment, events, refunds };
}

export async function createDriverPayout({ paymentId, driverId, amount, currency = 'INR', note, actorUserId }) {
  const payment = await findPaymentById(paymentId);
  if (!payment) throw new Error('Payment not found');
  if (!['succeeded', 'partially_refunded', 'refunded'].includes(payment.status)) {
    throw new Error('Payout can be created only for captured payments');
  }
  const payoutAmount = Number(amount);
  if (!(payoutAmount > 0)) throw new Error('Payout amount must be greater than 0');
  const payout = await createPayoutLedgerRecord({
    paymentId,
    driverId,
    amount: payoutAmount,
    currency,
    status: 'pending',
    note: note || null,
    actorUserId
  });
  await createPaymentEventRecord({
    paymentId,
    type: 'payment.payout.created',
    payload: { payoutId: payout.id, driverId, amount: payoutAmount, currency, note: note || null },
    actorUserId
  });
  return payout;
}

export async function getPaymentsReconciliation() {
  const summary = await getPaymentsReconciliationSummary();
  const pendingPayouts = await listPayoutLedger({ status: 'pending' });
  return { summary, pendingPayouts };
}

export async function markPaymentStatus({ paymentId, status, providerPaymentId, failureCode, failureReason, actorUserId }) {
  const payment = await findPaymentById(paymentId);
  if (!payment) throw new Error('Payment not found');
  const updated = await updatePaymentStatus({
    paymentId,
    status,
    providerPaymentId: providerPaymentId || null,
    failureCode: failureCode || null,
    failureReason: failureReason || null,
    actorUserId
  });
  await createPaymentEventRecord({
    paymentId,
    type: `payment.status.${status}`,
    payload: { providerPaymentId: providerPaymentId || null, failureCode: failureCode || null, failureReason: failureReason || null },
    actorUserId
  });
  return updated;
}

export async function createRefund({ paymentId, amount, reason, providerRefundId, actorUserId }) {
  const payment = await findPaymentById(paymentId);
  if (!payment) throw new Error('Payment not found');
  if (!['succeeded', 'partially_refunded'].includes(payment.status)) {
    throw new Error('Refunds allowed only for captured payments');
  }
  const available = Number(payment.amount) - Number(payment.refundedAmount || 0);
  const refundAmount = Number(amount);
  if (!(refundAmount > 0)) throw new Error('Refund amount must be greater than 0');
  if (refundAmount > available) throw new Error('Refund amount exceeds available captured amount');

  const refund = await createPaymentRefundRecord({
    paymentId,
    amount: refundAmount,
    reason: reason || null,
    status: 'succeeded',
    providerRefundId: providerRefundId || null,
    actorUserId
  });
  await createPaymentEventRecord({
    paymentId,
    type: 'payment.refund.succeeded',
    payload: { refundId: refund.id, amount: refund.amount, reason: refund.reason, providerRefundId: refund.providerRefundId },
    actorUserId
  });
  return { refund, payment: await findPaymentById(paymentId) };
}

export async function processPaymentWebhook({ provider, eventId, eventType, paymentId, payload, timestamp, signature, actorUserId }) {
  verifyWebhookSignature({ provider, eventId, eventType, paymentId, payload, timestamp, signature });
  const accepted = await createProcessedWebhookRecord({
    provider: provider || 'manual',
    eventId,
    eventType,
    paymentId: paymentId || null,
    payload: payload || {},
    status: 'processed',
    actorUserId
  });
  if (!accepted) return { ok: true, duplicate: true };

  if (!paymentId) return { ok: true, ignored: true };
  if (eventType === 'payment.succeeded') {
    const updated = await markPaymentStatus({ paymentId, status: 'succeeded', providerPaymentId: payload?.providerPaymentId, actorUserId });
    const ride = updated?.rideId ? await findRideById(updated.rideId) : null;
    if (ride?.driverId) {
      const payoutAmount = Number(updated.amount) - commissionAmount(updated.amount);
      if (payoutAmount > 0) {
        await createDriverPayout({
          paymentId,
          driverId: ride.driverId,
          amount: payoutAmount,
          currency: updated.currency || 'INR',
          note: 'Auto payout created on payment capture',
          actorUserId
        });
      }
    }
  } else if (eventType === 'payment.failed') {
    await markPaymentStatus({
      paymentId,
      status: 'failed',
      providerPaymentId: payload?.providerPaymentId,
      failureCode: payload?.failureCode,
      failureReason: payload?.failureReason,
      actorUserId
    });
  } else if (eventType === 'payment.refund.succeeded') {
    await createRefund({
      paymentId,
      amount: payload?.amount,
      reason: payload?.reason,
      providerRefundId: payload?.providerRefundId,
      actorUserId
    });
  }

  return { ok: true, duplicate: false };
}
