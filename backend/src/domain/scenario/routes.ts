import { Router } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const scenarioRouter = Router();

scenarioRouter.get('/scenarios', asyncHandler(controller.list));
scenarioRouter.post('/scenarios', asyncHandler(controller.create));
scenarioRouter.put('/scenarios/:scenarioId', asyncHandler(controller.update));
scenarioRouter.delete('/scenarios/:scenarioId', asyncHandler(controller.remove));
