import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { requestContext } from './middleware/request-context.js';
import { httpLogger } from './middleware/http-logger.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { couponsRouter } from './modules/coupons/coupons.routes.js';
import { offersRouter } from './modules/offers/offers.routes.js';
import { paymentsRouter } from './modules/payments/payments.routes.js';
import { ratingsRouter } from './modules/ratings/ratings.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { ridesRouter } from './modules/rides/rides.routes.js';
import { captureException } from './utils/error-tracker.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());
  app.use(requestContext);
  app.use(httpLogger);

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/auth', authRouter);
  app.use('/rides', ridesRouter);
  app.use('/coupons', couponsRouter);
  app.use('/offers', offersRouter);
  app.use('/payments', paymentsRouter);
  app.use('/ratings', ratingsRouter);
  app.use('/reports', reportsRouter);
  app.use('/admin', adminRouter);

  app.use((error, req, res, _next) => {
    captureException(error, { requestId: req.requestId, path: req.path, method: req.method });
    res.status(500).json({ error: 'Internal server error', requestId: req.requestId, details: error.message });
  });

  return app;
}
