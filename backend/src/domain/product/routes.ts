import { Router } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const productRouter = Router();

productRouter.get('/products', asyncHandler(controller.list));
productRouter.post('/products', asyncHandler(controller.create));
productRouter.post('/products/serial-number/next', asyncHandler(controller.getNextSerialNumber));
productRouter.patch('/products/model-by-name', asyncHandler(controller.updateModelByName));
productRouter.put('/products/:productId', asyncHandler(controller.update));
productRouter.delete('/products/:productId', asyncHandler(controller.remove));
productRouter.post('/products/:productId/archive', asyncHandler(controller.archive));
productRouter.get('/products/export', asyncHandler(controller.exportProducts));
productRouter.post('/products/import', asyncHandler(controller.importProducts));

