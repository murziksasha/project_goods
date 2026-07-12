import { Router, raw } from 'express';
import {
  createClient,
  deleteClient,
  getClientHistory,
  listClients,
  mergeClients,
  updateClient,
} from '../domain/client/service';
import {
  exportClientsWorkbook,
  importClientsWorkbook,
} from '../domain/client/excel';
import type { ClientPayload, MergeClientsPayload } from '../domain/shared/types';
import { HttpError } from '../shared/lib/errors';
import { asyncHandler, requireAnyPermission, requirePermission, routeParam } from '../shared/lib/http';

export const clientRouter = Router();
const excelBodyParser = raw({
  type: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream',
  ],
  limit: '25mb',
});

const clientReadPermissions = [
  'clients.manage',
  'orders.view',
  'sales.manage',
] as const;

clientRouter.get('/clients', asyncHandler(async (req, res) => {
  await requireAnyPermission(req, clientReadPermissions);
  res.json(await listClients(req.query.query, req.query.status));
}));

clientRouter.post('/clients', asyncHandler(async (req, res) => {
  await requirePermission(req, 'clients.manage');
  res.status(201).json(await createClient(req.body as ClientPayload));
}));

clientRouter.post(
  '/clients/import',
  excelBodyParser,
  asyncHandler(async (req, res) => {
    await requirePermission(req, 'clients.manage');
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new HttpError(400, 'Excel file is required.');
    }

    res.status(201).json(await importClientsWorkbook(req.body));
  }),
);

clientRouter.get('/clients/export', asyncHandler(async (req, res) => {
  await requirePermission(req, 'clients.manage');
  const buffer = await exportClientsWorkbook();
  res.setHeader('Content-Disposition', 'attachment; filename="clients.xls"');
  res.setHeader('Content-Type', 'application/vnd.ms-excel');
  res.send(buffer);
}));

clientRouter.post('/clients/merge', asyncHandler(async (req, res) => {
  await requirePermission(req, 'clients.manage');
  const payload = req.body as MergeClientsPayload;
  res.json(
    await mergeClients(payload.targetClientId, payload.sourceClientId),
  );
}));

clientRouter.put('/clients/:clientId', asyncHandler(async (req, res) => {
  await requirePermission(req, 'clients.manage');
  res.json(await updateClient(routeParam(req, 'clientId'), req.body as ClientPayload));
}));

clientRouter.delete('/clients/:clientId', asyncHandler(async (req, res) => {
  await requirePermission(req, 'clients.manage');
  res.json(await deleteClient(routeParam(req, 'clientId')));
}));

clientRouter.get('/clients/:clientId/history', asyncHandler(async (req, res) => {
  await requireAnyPermission(req, clientReadPermissions);
  res.json(await getClientHistory(routeParam(req, 'clientId')));
}));