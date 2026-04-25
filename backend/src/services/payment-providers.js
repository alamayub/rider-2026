import { env } from '../config/env.js';

export const PAYMENT_PROVIDER_CONFIG = {
  esewa: { name: 'eSewa', countries: ['np'], wallet: true },
  khalti: { name: 'Khalti', countries: ['np'], wallet: true },
  fonepay: { name: 'Fonepay', countries: ['np'], wallet: true },
  connectips: { name: 'ConnectIPS', countries: ['np'], bank: true },
  stripe: { name: 'Stripe', countries: ['global'], cards: true },
  razorpay: { name: 'Razorpay', countries: ['in'], cards: true, upi: true }
};

export function isProviderEnabled(provider) {
  const key = String(provider || '').toLowerCase();
  return env.enabledPaymentProviders.includes(key);
}

export function assertProviderEnabled(provider) {
  const key = String(provider || '').toLowerCase();
  if (!PAYMENT_PROVIDER_CONFIG[key]) {
    throw new Error(`Unsupported payment provider: ${provider}`);
  }
  if (!isProviderEnabled(key)) {
    throw new Error(`Provider not enabled: ${provider}`);
  }
  return key;
}

export function buildGatewaySession({ provider, paymentId, amount, currency }) {
  const key = assertProviderEnabled(provider);
  const base = env.paymentGatewayBaseUrls[key] || '';
  const providerOrderId = `${key}_${paymentId}`;
  const checkoutUrl = `${base}/checkout?paymentId=${encodeURIComponent(paymentId)}&amount=${encodeURIComponent(
    amount
  )}&currency=${encodeURIComponent(currency || 'NPR')}`;

  return {
    provider: key,
    providerOrderId,
    checkoutUrl
  };
}
