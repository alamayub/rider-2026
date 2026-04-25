import { createPaymentRecord, findPaymentById, updatePaymentStatus } from '../../db/store.js';

export async function createPaymentIntent({ rideId, method, amount, actorUserId }) {
  return createPaymentRecord({
    rideId,
    method: method || 'cash',
    amount,
    actorUserId
  });
}

export async function processPaymentWebhook({ paymentId, status, actorUserId }) {
  const payment = await findPaymentById(paymentId);
  if (!payment) {
    throw new Error('Payment not found');
  }

  await updatePaymentStatus({ paymentId, status: status || 'succeeded', actorUserId });
  return { ok: true };
}
