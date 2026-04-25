import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  commissionRatePercent: Number(process.env.COMMISSION_RATE_PERCENT || 20),
  webhookSecret: process.env.WEBHOOK_SECRET || 'dev-webhook-secret',
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
  dbClient: 'mysql',
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'ride',
    password: process.env.MYSQL_PASSWORD || 'ride',
    database: process.env.MYSQL_DATABASE || 'ride'
  }
};
