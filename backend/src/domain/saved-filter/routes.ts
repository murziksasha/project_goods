import { Router } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const savedFilterRouter = Router();

savedFilterRouter.get('/saved-filters', asyncHandler(controller.list));
savedFilterRouter.post('/saved-filters', asyncHandler(controller.create));
savedFilterRouter.delete('/saved-filters/:filterId', asyncHandler(controller.remove));

