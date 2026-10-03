import { Router } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const weatherRouter = Router();

weatherRouter.get('/weather/forecast', asyncHandler(controller.getForecast));

