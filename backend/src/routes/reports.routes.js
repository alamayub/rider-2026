import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createReportController, listMyReportsController } from '../controllers/reports.controller.js';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

reportsRouter.post('/', createReportController);
reportsRouter.get('/me', listMyReportsController);
