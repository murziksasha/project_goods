import { Router } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const archiveRouter = Router();

archiveRouter.get('/archive/yearly', asyncHandler(controller.getYearly));
archiveRouter.post('/archive/yearly/sales/:year', asyncHandler(controller.archiveYearlySales));
archiveRouter.post('/archive/yearly/finance/:year', asyncHandler(controller.archiveYearlyFinance));
archiveRouter.post('/archive/yearly/run', asyncHandler(controller.runScheduledArchives));
archiveRouter.post('/archive/finance/seal', asyncHandler(controller.sealFinancePeriod));
archiveRouter.post('/archive/finance/seal/auto', asyncHandler(controller.sealFinancePeriodAuto));
archiveRouter.post('/archive/finance/purge', asyncHandler(controller.purgeFinance));

