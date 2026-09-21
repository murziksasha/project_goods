import { Router } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const demoRouter = Router();

demoRouter.post('/demo/seed', asyncHandler(controller.seed));
demoRouter.post('/demo/seed/sales', asyncHandler(controller.seedSales));
demoRouter.post('/demo/seed/repairs', asyncHandler(controller.seedRepairs));
demoRouter.post('/demo/erase', asyncHandler(controller.erase));

