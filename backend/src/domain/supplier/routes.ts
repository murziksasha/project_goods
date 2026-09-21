import { Router } from 'express';
import { Router, raw } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const supplierRouter = Router();

const excelBodyParser = raw({
  type: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream',
  ],
  limit: '25mb',
});

supplierRouter.get('/suppliers', asyncHandler(controller.list));
supplierRouter.post('/suppliers', asyncHandler(controller.create));
supplierRouter.post('/suppliers/import', excelBodyParser, asyncHandler(controller.importSuppliers));
supplierRouter.get('/suppliers/export', asyncHandler(controller.exportSuppliers));
supplierRouter.post('/suppliers/merge', asyncHandler(controller.merge));
supplierRouter.put('/suppliers/:supplierId', asyncHandler(controller.update));
supplierRouter.delete('/suppliers/:supplierId', asyncHandler(controller.remove));

