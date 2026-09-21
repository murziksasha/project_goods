import { Router } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const catalogProductRouter = Router();

catalogProductRouter.get('/catalog-products', asyncHandler(controller.list));
catalogProductRouter.post('/catalog-products', asyncHandler(controller.create));
catalogProductRouter.post('/catalog-products/merge', asyncHandler(controller.merge));
catalogProductRouter.put('/catalog-products/:catalogProductId', asyncHandler(controller.update));
catalogProductRouter.delete('/catalog-products/:catalogProductId', asyncHandler(controller.remove));

