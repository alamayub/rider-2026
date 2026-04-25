import { createPaymentIntent, processPaymentWebhook } from './payments.service.js';

export async function createPaymentIntentController(req, res) {
  const payment = await createPaymentIntent({
    rideId: req.body.rideId,
    method: req.body.method,
    amount: req.body.amount,
    actorUserId: req.user.sub
  });

  return res.status(201).json(payment);
}

export async function paymentWebhookController(req, res) {
  try {
    const result = await processPaymentWebhook({
      paymentId: req.body.paymentId,
      status: req.body.status,
      actorUserId: req.user.sub
    });

    return res.json(result);
  } catch (error) {
    if (error.message === 'Payment not found') {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message });
  }
}
