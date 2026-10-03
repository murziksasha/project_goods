import { Router } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const employeeRouter = Router();

employeeRouter.get('/employees', asyncHandler(controller.list));
employeeRouter.post('/employees', asyncHandler(controller.create));
employeeRouter.put('/employees/:employeeId', asyncHandler(controller.update));
employeeRouter.delete('/employees/:employeeId', asyncHandler(controller.remove));

