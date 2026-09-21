import { Router } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const clientDeviceRouter = Router();

clientDeviceRouter.get('/client-devices', asyncHandler(controller.list));
clientDeviceRouter.post('/client-devices', asyncHandler(controller.create));
clientDeviceRouter.post('/client-devices/merge', asyncHandler(controller.merge));
clientDeviceRouter.put('/client-devices/:deviceId', asyncHandler(controller.update));
clientDeviceRouter.delete('/client-devices/:deviceId', asyncHandler(controller.remove));

