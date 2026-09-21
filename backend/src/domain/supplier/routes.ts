import { Router } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const supplierRouter = Router();

supplierRouter.get('/suppliers', asyncHandler(controller.list));
supplierRouter.post('/suppliers', asyncHandler(controller.create));
supplierRouter.post('/suppliers/merge', asyncHandler(controller.merge));
supplierRouter.put('/suppliers/:supplierId', asyncHandler(controller.update));
supplierRouter.delete('/suppliers/:supplierId', asyncHandler(controller.remove));

