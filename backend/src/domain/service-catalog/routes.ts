import { Router } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const serviceCatalogRouter = Router();

serviceCatalogRouter.get('/services', asyncHandler(controller.list));
serviceCatalogRouter.post('/services', asyncHandler(controller.create));
serviceCatalogRouter.post('/services/merge', asyncHandler(controller.merge));
serviceCatalogRouter.put('/services/:serviceId', asyncHandler(controller.update));
serviceCatalogRouter.delete('/services/:serviceId', asyncHandler(controller.remove));
serviceCatalogRouter.post('/services/:serviceId/archive', asyncHandler(controller.archive));

