import { Router, raw } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const clientRouter = Router();

const excelBodyParser = raw({
  type: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream',
  ],
  limit: '25mb',
});

clientRouter.get('/clients', asyncHandler(controller.list));
clientRouter.post('/clients', asyncHandler(controller.create));
clientRouter.post('/clients/import', excelBodyParser, asyncHandler(controller.importClients));
clientRouter.get('/clients/export', asyncHandler(controller.exportClients));
clientRouter.post('/clients/merge', asyncHandler(controller.merge));
clientRouter.put('/clients/:clientId', asyncHandler(controller.update));
clientRouter.delete('/clients/:clientId', asyncHandler(controller.remove));
clientRouter.get('/clients/:clientId/history', asyncHandler(controller.getHistory));

