import { Router } from 'express';
import { createClientDevice, deleteClientDevice, listClientDevices, updateClientDevice } from '../domain/client-device/service';
import type { ClientDevicePayload } from '../domain/shared/types';

export const clientDeviceRouter = Router();

clientDeviceRouter.get('/client-devices', async (req, res, next) => {
  try {
    res.json(await listClientDevices(req.query.query));
  } catch (error) {
    next(error);
  }
});

clientDeviceRouter.post('/client-devices', async (req, res, next) => {
  try {
    res.status(201).json(await createClientDevice(req.body as ClientDevicePayload));
  } catch (error) {
    next(error);
  }
});

clientDeviceRouter.put('/client-devices/:deviceId', async (req, res, next) => {
  try {
    res.json(await updateClientDevice(req.params.deviceId, req.body as ClientDevicePayload));
  } catch (error) {
    next(error);
  }
});

clientDeviceRouter.delete('/client-devices/:deviceId', async (req, res, next) => {
  try {
    res.json(await deleteClientDevice(req.params.deviceId));
  } catch (error) {
    next(error);
  }
});
