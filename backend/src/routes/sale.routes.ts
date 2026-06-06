import { Router } from 'express';
import {
  createSale,
  deleteSale,
  listSales,
  returnSale,
  returnSaleLineItem,
  returnSaleLineItemBySerials,
  returnSaleLineItemToStock,
  updateSaleWorkspace,
  updateSale,
} from '../domain/sale/service';
import { getBearerToken, requirePermissionByToken } from '../domain/auth/service';
import type { SalePayload } from '../domain/shared/types';
import { asyncHandler, routeParam } from '../shared/lib/http';

export const saleRouter = Router();

saleRouter.get('/sales', asyncHandler(async (_req, res) => {
  res.json(await listSales());
}));

saleRouter.post('/sales', asyncHandler(async (req, res) => {
  res.status(201).json(await createSale(req.body as SalePayload));
}));

saleRouter.put('/sales/:saleId', asyncHandler(async (req, res) => {
  res.json(await updateSale(routeParam(req, 'saleId'), req.body as SalePayload));
}));

saleRouter.patch('/sales/:saleId/workspace', asyncHandler(async (req, res) => {
  res.json(await updateSaleWorkspace(routeParam(req, 'saleId'), req.body as SalePayload));
}));

saleRouter.patch('/sales/:saleId/return-line-item', asyncHandler(async (req, res) => {
  await requirePermissionByToken(getBearerToken(req.headers.authorization), 'finance.transactions.withdraw');
  res.json(await returnSaleLineItem(routeParam(req, 'saleId'), req.body));
}));

saleRouter.patch('/sales/:saleId/return-line-item-serials', asyncHandler(async (req, res) => {
  await requirePermissionByToken(getBearerToken(req.headers.authorization), 'finance.transactions.withdraw');
  res.json(await returnSaleLineItemBySerials(routeParam(req, 'saleId'), req.body));
}));

saleRouter.patch('/sales/:saleId/return-line-item-stock', asyncHandler(async (req, res) => {
  res.json(await returnSaleLineItemToStock(routeParam(req, 'saleId'), req.body));
}));

saleRouter.patch('/sales/:saleId/return', asyncHandler(async (req, res) => {
  await requirePermissionByToken(getBearerToken(req.headers.authorization), 'finance.transactions.withdraw');
  res.json(await returnSale(routeParam(req, 'saleId'), req.body));
}));

saleRouter.delete('/sales/:saleId', asyncHandler(async (req, res) => {
  res.json(await deleteSale(routeParam(req, 'saleId')));
}));
