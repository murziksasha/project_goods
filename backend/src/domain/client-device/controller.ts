import type { Request, Response } from 'express';
import {
  createClientDevice,
  deleteClientDevice,
  listClientDevices,
  mergeClientDevices,
  updateClientDevice,
} from './service';
import type {
  ClientDevicePayload,
  MergeClientDevicesPayload,
} from '../shared/types';
import {
  requireAnyPermission,
  requirePermission,
  routeParam,
} from '../../shared/lib/http';

export const clientDeviceReadPermissions = [
  'clients.manage',
  'orders.view',
  'orders.manage',
  'repairs.execute',
] as const;

export const list = async (req: Request, res: Response): Promise<void> => {
  await requireAnyPermission(req, clientDeviceReadPermissions);
  res.json(await listClientDevices(req.query.query));
};

export const create = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'clients.manage');
  res.status(201).json(await createClientDevice(req.body as ClientDevicePayload));
};

export const merge = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'clients.manage');
  const payload = req.body as MergeClientDevicesPayload;
  res.json(
    await mergeClientDevices(
      payload.targetDeviceId,
      payload.sourceDeviceId,
      payload.draftNote,
    ),
  );
};

export const update = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'clients.manage');
  res.json(
    await updateClientDevice(
      routeParam(req, 'deviceId'),
      req.body as ClientDevicePayload,
    ),
  );
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'clients.manage');
  res.json(await deleteClientDevice(routeParam(req, 'deviceId')));
};

