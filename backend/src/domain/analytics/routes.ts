import { Router } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const analyticsRouter = Router();

analyticsRouter.get('/analytics/dashboard', asyncHandler(controller.getDashboard));

