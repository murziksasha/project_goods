import { Router } from 'express';
import {
  createSale,
  deleteSale,
  listSales,
  returnSale,
  returnSaleLineItem,
  updateSaleWorkspace,
  updateSale,
} from '../domain/sale/service';
import type { SalePayload } from '../domain/shared/types';

export const saleRouter = Router();

saleRouter.get('/sales', async (_req, res, next) => {
  try {
    res.json(await listSales());
  } catch (error) {
    next(error);
  }
});

saleRouter.post('/sales', async (req, res, next) => {
  try {
    res.status(201).json(await createSale(req.body as SalePayload));
  } catch (error) {
    next(error);
  }
});

saleRouter.put('/sales/:saleId', async (req, res, next) => {
  try {
    res.json(await updateSale(req.params.saleId, req.body as SalePayload));
  } catch (error) {
    next(error);
  }
});

saleRouter.patch('/sales/:saleId/workspace', async (req, res, next) => {
  try {
    res.json(await updateSaleWorkspace(req.params.saleId, req.body as SalePayload));
  } catch (error) {
    next(error);
  }
});

saleRouter.patch('/sales/:saleId/return-line-item', async (req, res, next) => {
  try {
    res.json(await returnSaleLineItem(req.params.saleId, req.body));
  } catch (error) {
    next(error);
  }
});

saleRouter.patch('/sales/:saleId/return', async (req, res, next) => {
  try {
    res.json(await returnSale(req.params.saleId, req.body));
  } catch (error) {
    next(error);
  }
});

saleRouter.delete('/sales/:saleId', async (req, res, next) => {
  try {
    res.json(await deleteSale(req.params.saleId));
  } catch (error) {
    next(error);
  }
});
