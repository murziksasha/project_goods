import { Router } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const warehouseSettingsRouter = Router();

warehouseSettingsRouter.get('/warehouse-settings', asyncHandler(controller.get));
warehouseSettingsRouter.put('/warehouse-settings', asyncHandler(controller.update));

