import type { Request, Response } from 'express';
import {
  createClient,
  deleteClient,
  getClientHistory,
  listClients,
  mergeClients,
  updateClient,
} from './service';
import {
  exportClientsWorkbook,
  importClientsWorkbook,
} from './excel';
import type { ClientPayload, MergeClientsPayload } from '../shared/types';
import { HttpError } from '../../shared/lib/errors';
import {
  requireAnyPermission,
  requirePermission,
  routeParam,
} from '../../shared/lib/http';

export const clientReadPermissions = [
  'clients.manage',
  'orders.view',
  'sales.manage',
] as const;

export const list = async (req: Request, res: Response): Promise<void> => {
  await requireAnyPermission(req, clientReadPermissions);
  res.json(await listClients(req.query.query, req.query.status));
};

export const create = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'clients.manage');
  res.status(201).json(await createClient(req.body as ClientPayload));
};

export const importClients = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'clients.manage');
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new HttpError(400, 'Excel file is required.');
  }
  res.status(201).json(await importClientsWorkbook(req.body));
};

export const exportClients = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'clients.manage');
  const buffer = await exportClientsWorkbook();
  res.setHeader('Content-Disposition', 'attachment; filename="clients.xls"');
  res.setHeader('Content-Type', 'application/vnd.ms-excel');
  res.send(buffer);
};

export const merge = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'clients.manage');
  const payload = req.body as MergeClientsPayload;
  res.json(await mergeClients(payload.targetClientId, payload.sourceClientId));
};

export const update = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'clients.manage');
  res.json(await updateClient(routeParam(req, 'clientId'), req.body as ClientPayload));
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'clients.manage');
  res.json(await deleteClient(routeParam(req, 'clientId')));
};

export const getHistory = async (req: Request, res: Response): Promise<void> => {
  await requireAnyPermission(req, clientReadPermissions);
  res.json(await getClientHistory(routeParam(req, 'clientId')));
};

