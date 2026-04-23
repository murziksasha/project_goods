import { Router } from 'express';
import {
  createClient,
  deleteClient,
  getClientHistory,
  listClients,
  updateClient,
} from '../domain/client/service';
import type { ClientPayload } from '../domain/shared/types';

export const clientRouter = Router();

clientRouter.get('/clients', async (req, res, next) => {
  try {
    res.json(await listClients(req.query.query, req.query.status));
  } catch (error) {
    next(error);
  }
});

clientRouter.post('/clients', async (req, res, next) => {
  try {
    res.status(201).json(await createClient(req.body as ClientPayload));
  } catch (error) {
    next(error);
  }
});

clientRouter.put('/clients/:clientId', async (req, res, next) => {
  try {
    res.json(await updateClient(req.params.clientId, req.body as ClientPayload));
  } catch (error) {
    next(error);
  }
});

clientRouter.delete('/clients/:clientId', async (req, res, next) => {
  try {
    res.json(await deleteClient(req.params.clientId));
  } catch (error) {
    next(error);
  }
});

clientRouter.get('/clients/:clientId/history', async (req, res, next) => {
  try {
    res.json(await getClientHistory(req.params.clientId));
  } catch (error) {
    next(error);
  }
});
