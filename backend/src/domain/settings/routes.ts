import { Router } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const settingsRouter = Router();

settingsRouter.get('/settings', asyncHandler(controller.get));
settingsRouter.put('/settings', asyncHandler(controller.update));
settingsRouter.put('/settings/print-forms', asyncHandler(controller.updatePrintForms));

