import { Router } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const healthRouter = Router();

healthRouter.get('/health', asyncHandler(controller.getHealth));

