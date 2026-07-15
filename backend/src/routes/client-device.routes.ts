import { Router } from 'express';
import { createClientDevice, deleteClientDevice, listClientDevices, updateClientDevice } from '../domain/client-device/service';
import type { ClientDevicePayload } from '../domain/shared/types';
import {
  asyncHandler,
  requireAnyPermission,
  requirePermission,
  routeParam,
} from '../shared/lib/http';

export const clientDeviceRouter = Router();

const clientDeviceReadPermissions = [
  'clients.manage',
  'orders.view',
  'orders.manage',
  'repairs.execute',
] as const;

clientDeviceRouter.get('/client-devices', asyncHandler(async (req, res) => {
  await requireAnyPermission(req, clientDeviceReadPermissions);
  res.json(await listClientDevices(req.query.query));
}));

clientDeviceRouter.post('/client-devices', asyncHandler(async (req, res) => {
  await requirePermission(req, 'clients.manage');
  res.status(201).json(await createClientDevice(req.body as ClientDevicePayload));
}));

clientDeviceRouter.put('/client-devices/:deviceId', asyncHandler(async (req, res) => {
  await requirePermission(req, 'clients.manage');
  res.json(await updateClientDevice(routeParam(req, 'deviceId'), req.body as ClientDevicePayload));
}));

clientDeviceRouter.delete('/client-devices/:deviceId', asyncHandler(async (req, res) => {
  await requirePermission(req, 'clients.manage');
  res.json(await deleteClientDevice(routeParam(req, 'deviceId')));
}));