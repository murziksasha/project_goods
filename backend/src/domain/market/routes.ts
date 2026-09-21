import { Router } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const marketRouter = Router();

marketRouter.get('/market/rates', asyncHandler(controller.getRates));

