import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { requestContext } from './middleware/request-context.js';
import { httpLogger } from './middleware/http-logger.js';
import { adminRouter } from './routes/admin.routes.js';
import { analyticsRouter } from './routes/analytics.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { couponsRouter } from './routes/coupons.routes.js';
import { driverKycRouter } from './routes/driver-kyc.routes.js';
import { driverVehiclesRouter } from './routes/driver-vehicles.routes.js';
import { messagesRouter } from './routes/messages.routes.js';
import { notificationsRouter } from './routes/notifications.routes.js';
import { offersRouter } from './routes/offers.routes.js';
import { paymentsRouter } from './routes/payments.routes.js';
import { parcelsRouter } from './routes/parcels.routes.js';
import { ratingsRouter } from './routes/ratings.routes.js';
import { reportsRouter } from './routes/reports.routes.js';
import { ridesRouter } from './routes/rides.routes.js';
import { captureException } from './utils/error-tracker.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  // app.use(cors({ origin: env.corsOrigin }));
  app.use(cors({ origin: '*' }));
  app.use(express.json());
  app.use(requestContext);
  app.use(httpLogger);

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/auth', authRouter);
  app.use('/analytics', analyticsRouter);
  app.use('/driver-kyc', driverKycRouter);
  app.use('/driver-vehicles', driverVehiclesRouter);
  app.use('/messages', messagesRouter);
  app.use('/notifications', notificationsRouter);
  app.use('/rides', ridesRouter);
  app.use('/coupons', couponsRouter);
  app.use('/offers', offersRouter);
  app.use('/parcels', parcelsRouter);
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
