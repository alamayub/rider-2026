import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

function getSecretEnv(name, fallback) {
  const value = process.env[name] || fallback;
  if (isProduction && (!value || value === fallback || String(value).toLowerCase().includes('change-me'))) {
    throw new Error(`${name} must be set to a strong secret in production`);
  }
  return value;
}

function getCorsOrigin() {
  const value = process.env.CORS_ORIGIN || 'http://localhost:3000';
  if (isProduction && value.trim() === '*') {
    throw new Error('CORS_ORIGIN cannot be "*" in production');
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv,
  jwtSecret: getSecretEnv('JWT_SECRET', 'dev-secret'),
  corsOrigin: getCorsOrigin(),
  commissionRatePercent: Number(process.env.COMMISSION_RATE_PERCENT || 20),
  webhookSecret: getSecretEnv('WEBHOOK_SECRET', 'dev-webhook-secret'),
  webhookMaxSkewSeconds: Number(process.env.WEBHOOK_MAX_SKEW_SECONDS || 300),
  enabledPaymentProviders: (process.env.ENABLED_PAYMENT_PROVIDERS || 'esewa,khalti,fonepay,connectips')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean),
  paymentGatewayBaseUrls: {
    esewa: process.env.ESEWA_BASE_URL || 'https://epay.esewa.com.np',
    khalti: process.env.KHALTI_BASE_URL || 'https://khalti.com',
    fonepay: process.env.FONEPAY_BASE_URL || 'https://merchantapi.fonepay.com',
    connectips: process.env.CONNECTIPS_BASE_URL || 'https://www.connectips.com',
    stripe: process.env.STRIPE_BASE_URL || 'https://checkout.stripe.com',
    razorpay: process.env.RAZORPAY_BASE_URL || 'https://checkout.razorpay.com'
  },
  fcm: {
    enabled: String(process.env.FCM_ENABLED || 'false').toLowerCase() === 'true',
    serverKey: process.env.FCM_SERVER_KEY || '',
    endpoint: process.env.FCM_ENDPOINT || 'https://fcm.googleapis.com/fcm/send'
  },
  dbClient: 'mysql',
  /**
   * OSRM-compatible service root (no trailing slash), before `/route/v1/driving/...`.
   * Default is FOSSGIS `routed-car` (see https://routing.openstreetmap.de ); override with OSRM_BASE_URL.
   */
  osrmBaseUrl: (process.env.OSRM_BASE_URL || 'https://routing.openstreetmap.de/routed-car').replace(/\/$/, ''),
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'ride',
    password: process.env.MYSQL_PASSWORD || 'root',
    database: process.env.MYSQL_DATABASE || 'password'
  }
};
