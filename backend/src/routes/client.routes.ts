import { Router } from 'express';
import {
  createClient,
  deleteClient,
  getClientHistory,
  listClients,
  mergeClients,
  updateClient,
} from '../domain/client/service';
import type { ClientPayload, MergeClientsPayload } from '../domain/shared/types';
import { asyncHandler, routeParam } from '../shared/lib/http';

export const clientRouter = Router();

clientRouter.get('/clients', asyncHandler(async (req, res) => {
  res.json(await listClients(req.query.query, req.query.status));
}));

clientRouter.post('/clients', asyncHandler(async (req, res) => {
  res.status(201).json(await createClient(req.body as ClientPayload));
}));

clientRouter.post('/clients/merge', asyncHandler(async (req, res) => {
  const payload = req.body as MergeClientsPayload;
  res.json(
    await mergeClients(payload.targetClientId, payload.sourceClientId),
  );
}));

clientRouter.put('/clients/:clientId', asyncHandler(async (req, res) => {
  res.json(await updateClient(routeParam(req, 'clientId'), req.body as ClientPayload));
}));

clientRouter.delete('/clients/:clientId', asyncHandler(async (req, res) => {
  res.json(await deleteClient(routeParam(req, 'clientId')));
}));

clientRouter.get('/clients/:clientId/history', asyncHandler(async (req, res) => {
  res.json(await getClientHistory(routeParam(req, 'clientId')));
}));
