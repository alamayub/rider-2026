import assert from 'node:assert/strict';
import test from 'node:test';
import { signIn } from '../services/auth.service.js';
import {
  buildWebhookSignature,
  createDriverPayout,
  createPaymentIntent,
  createRefund,
  getGroupedPaymentMethodsForApps,
  getPaymentMethodsForApps,
  getPaymentTimeline,
  getPaymentsReconciliation,
  markPaymentStatus,
  processPaymentWebhook
} from '../services/payments.service.js';
import { registerDbHooks } from './test-db-hooks.js';

registerDbHooks();

test('payment lifecycle tracks success failure and timeline events', async () => {
  const rider = (await signIn({ phone: '+919111111111', role: 'rider', password: 'Pass@123' })).user;
  const payment = await createPaymentIntent({
    rideId: 'ride-pay-1',
    method: 'wallet',
    provider: 'esewa',
    amount: 500,
    actorUserId: rider.id
  });

  assert.equal(payment.status, 'created');
  await markPaymentStatus({
    paymentId: payment.id,
    status: 'failed',
    providerPaymentId: 'pay_1',
    failureCode: 'BANK_TIMEOUT',
    failureReason: 'Issuer timeout',
    actorUserId: rider.id
  });
  await markPaymentStatus({
    paymentId: payment.id,
    status: 'succeeded',
    providerPaymentId: 'pay_1',
    actorUserId: rider.id
  });

  const timeline = await getPaymentTimeline({ paymentId: payment.id });
  assert.equal(timeline.payment.status, 'succeeded');
  assert.equal(timeline.events.length, 3);
  assert.equal(timeline.events[0].type, 'payment.intent.created');
  assert.equal(timeline.events[1].type, 'payment.status.failed');
  assert.equal(timeline.events[2].type, 'payment.status.succeeded');
});

test('nepal gateway provider session is generated and unsupported provider is rejected', async () => {
  const rider = (await signIn({ phone: '+919111111116', role: 'rider', password: 'Pass@123' })).user;
  const payment = await createPaymentIntent({
    rideId: 'ride-pay-np-1',
    method: 'wallet',
    provider: 'esewa',
    amount: 250,
    currency: 'NPR',
    actorUserId: rider.id
  });

  assert.equal(payment.provider, 'esewa');
  assert.ok(payment.providerOrderId);
  assert.ok(payment.gatewaySession?.checkoutUrl);

  await assert.rejects(
    () =>
      createPaymentIntent({
        rideId: 'ride-pay-np-2',
        method: 'card',
        provider: 'stripe',
        amount: 250,
        currency: 'NPR',
        actorUserId: rider.id
      }),
    /Provider not enabled/
  );
});

test('payment methods are stored and listable for apps', async () => {
  const methods = await getPaymentMethodsForApps({ app: 'rider', country: 'np', currency: 'NPR' });
  const providers = methods.map((m) => m.provider);
  assert.ok(providers.includes('esewa'));
  assert.ok(providers.includes('khalti'));
  assert.ok(providers.includes('fonepay'));
  assert.ok(providers.includes('connectips'));
});

test('payment methods can be grouped for app UI', async () => {
  const grouped = await getGroupedPaymentMethodsForApps({ app: 'rider', country: 'np', currency: 'NPR' });
  assert.ok(Array.isArray(grouped.wallets));
  assert.ok(Array.isArray(grouped.bankTransfer));
  assert.ok(Array.isArray(grouped.cards));
  assert.ok(Array.isArray(grouped.others));
  assert.ok(grouped.wallets.length >= 3);
  assert.ok(grouped.bankTransfer.some((m) => m.provider === 'connectips'));
});

test('payment methods can be filtered per app scope', async () => {
  const riderMethods = await getPaymentMethodsForApps({ app: 'rider', country: 'np', currency: 'NPR' });
  const adminMethods = await getPaymentMethodsForApps({ app: 'admin', country: 'np', currency: 'NPR' });

  assert.ok(riderMethods.some((m) => m.provider === 'esewa'));
  assert.ok(adminMethods.every((m) => (m.appScopes || []).includes('admin')));
  assert.ok(!adminMethods.some((m) => m.provider === 'esewa'));
});

test('refund flow supports partial and full refunds with history', async () => {
  const rider = (await signIn({ phone: '+919111111112', role: 'rider', password: 'Pass@123' })).user;
  const payment = await createPaymentIntent({
    rideId: 'ride-pay-2',
    method: 'wallet',
    provider: 'khalti',
    amount: 1000,
    actorUserId: rider.id
  });
  await markPaymentStatus({ paymentId: payment.id, status: 'succeeded', actorUserId: rider.id });

  const first = await createRefund({ paymentId: payment.id, amount: 300, reason: 'promo adjustment', actorUserId: rider.id });
  assert.equal(first.payment.status, 'partially_refunded');
  assert.equal(Number(first.payment.refundedAmount), 300);

  const second = await createRefund({ paymentId: payment.id, amount: 700, reason: 'trip dispute', actorUserId: rider.id });
  assert.equal(second.payment.status, 'refunded');
  assert.equal(Number(second.payment.refundedAmount), 1000);

  const timeline = await getPaymentTimeline({ paymentId: payment.id });
  assert.equal(timeline.refunds.length, 2);
  assert.equal(timeline.events.filter((e) => e.type === 'payment.refund.succeeded').length, 2);
});

test('webhook processing is idempotent by provider event id', async () => {
  const rider = (await signIn({ phone: '+919111111113', role: 'rider', password: 'Pass@123' })).user;
  const payment = await createPaymentIntent({
    rideId: 'ride-pay-3',
    method: 'wallet',
    provider: 'esewa',
    amount: 450,
    actorUserId: rider.id
  });

  const ts = Date.now();
  const sig = buildWebhookSignature({
    provider: 'razorpay',
    eventId: 'evt_123',
    eventType: 'payment.succeeded',
    paymentId: payment.id,
    payload: { providerPaymentId: 'rp_pay_1' },
    timestamp: ts
  });
  const first = await processPaymentWebhook({
    provider: 'razorpay',
    eventId: 'evt_123',
    eventType: 'payment.succeeded',
    paymentId: payment.id,
    payload: { providerPaymentId: 'rp_pay_1' },
    timestamp: ts,
    signature: sig,
    actorUserId: rider.id
  });
  const duplicate = await processPaymentWebhook({
    provider: 'razorpay',
    eventId: 'evt_123',
    eventType: 'payment.succeeded',
    paymentId: payment.id,
    payload: { providerPaymentId: 'rp_pay_1' },
    timestamp: ts,
    signature: sig,
    actorUserId: rider.id
  });

  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  const timeline = await getPaymentTimeline({ paymentId: payment.id });
  assert.equal(timeline.payment.status, 'succeeded');
  assert.equal(timeline.events.filter((e) => e.type === 'payment.status.succeeded').length, 1);
});

test('reconciliation returns pending payout ledger data', async () => {
  const rider = (await signIn({ phone: '+919111111114', role: 'rider', password: 'Pass@123' })).user;
  const admin = (await signIn({ phone: '+919111111115', role: 'admin', password: 'Pass@123' })).user;
  const payment = await createPaymentIntent({
    rideId: 'ride-pay-4',
    method: 'wallet',
    provider: 'fonepay',
    amount: 700,
    actorUserId: rider.id
  });
  await markPaymentStatus({ paymentId: payment.id, status: 'succeeded', actorUserId: rider.id });
  await createDriverPayout({
    paymentId: payment.id,
    driverId: 'driver-123',
    amount: 560,
    actorUserId: admin.id
  });

  const result = await getPaymentsReconciliation();
  assert.equal(result.summary.totalPayments, 1);
  assert.ok(result.summary.totalPendingPayoutAmount >= 560);
  assert.equal(result.pendingPayouts.length, 1);
});
