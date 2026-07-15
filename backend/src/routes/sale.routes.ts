import { Router } from 'express';
import {
  acceptSalePayment,
  createSale,
  deleteSale,
  listSales,
  refundSalePayment,
  returnSale,
  returnSaleLineItem,
  returnSaleLineItemBySerials,
  returnSaleLineItemToStock,
  updateSaleFavorite,
  updateSaleWorkspace,
  updateSale,
} from '../domain/sale/service';
import { Sale } from '../domain/sale/model';
import {
  getSaleFavoritePermission,
  getSaleManagePermission,
  isManualCommentWorkspacePatch,
} from '../domain/sale/workspace-permissions';
import type { SalePayload } from '../domain/shared/types';
import { HttpError } from '../shared/lib/errors';
import {
  asyncHandler,
  requireAnyPermission,
  requirePermission,
  routeParam,
} from '../shared/lib/http';

export const saleRouter = Router();

/** Re-export for tests that import helpers from the route module. */
export {
  getSaleFavoritePermission,
  getSaleManagePermission,
  isManualCommentWorkspacePatch,
};

const saleReadPermissions = [
  'orders.view',
  'sales.manage',
  'repairs.execute',
  'supplierOrders.view',
  'supplierOrders.manage',
] as const;

saleRouter.get('/sales', asyncHandler(async (req, res) => {
  await requireAnyPermission(req, saleReadPermissions);
  res.json(await listSales());
}));

saleRouter.post('/sales', asyncHandler(async (req, res) => {
  const payload = req.body as SalePayload;
  await requirePermission(req, getSaleManagePermission(payload.kind));
  res.status(201).json(await createSale(payload));
}));

saleRouter.put('/sales/:saleId', asyncHandler(async (req, res) => {
  const saleId = routeParam(req, 'saleId');
  const existingSale = await Sale.findById(saleId).lean();
  if (!existingSale) {
    throw new HttpError(404, 'Sale not found.');
  }
  await requirePermission(req, getSaleManagePermission(existingSale.kind));
  res.json(await updateSale(saleId, req.body as SalePayload));
}));

saleRouter.patch('/sales/:saleId/favorite', asyncHandler(async (req, res) => {
  const saleId = routeParam(req, 'saleId');
  const existingSale = await Sale.findById(saleId).lean();
  if (!existingSale) {
    throw new HttpError(404, 'Sale not found.');
  }
  await requirePermission(
    req,
    getSaleFavoritePermission(existingSale.kind),
    existingSale.kind === 'sale'
      ? 'Current employee does not have permission to manage sales.'
      : 'Current employee does not have permission to manage orders.',
  );
  res.json(await updateSaleFavorite(saleId, req.body as { isFavorite?: unknown }));
}));

saleRouter.patch('/sales/:saleId/workspace', asyncHandler(async (req, res) => {
  const saleId = routeParam(req, 'saleId');
  const existingSale = await Sale.findById(saleId).lean();
  if (!existingSale) {
    throw new HttpError(404, 'Sale not found.');
  }
  const payload = req.body as SalePayload;
  if (isManualCommentWorkspacePatch(existingSale, payload)) {
    await requirePermission(
      req,
      'orders.chat',
      'Current employee does not have permission to add live feed comments.',
    );
  } else {
    await requirePermission(req, getSaleManagePermission(existingSale.kind));
  }
  res.json(await updateSaleWorkspace(saleId, payload));
}));

saleRouter.patch('/sales/:saleId/payment', asyncHandler(async (req, res) => {
  if ((req.body as { action?: unknown }).action !== 'issueWithoutPayment') {
    await requirePermission(req, 'finance.transactions.deposit');
  }
  res.json(await acceptSalePayment(routeParam(req, 'saleId'), req.body));
}));

saleRouter.patch('/sales/:saleId/refund', asyncHandler(async (req, res) => {
  await requirePermission(req, 'finance.transactions.withdraw');
  res.json(await refundSalePayment(routeParam(req, 'saleId'), req.body));
}));

saleRouter.patch('/sales/:saleId/return-line-item', asyncHandler(async (req, res) => {
  await requirePermission(req, 'finance.transactions.withdraw');
  res.json(await returnSaleLineItem(routeParam(req, 'saleId'), req.body));
}));

saleRouter.patch('/sales/:saleId/return-line-item-serials', asyncHandler(async (req, res) => {
  await requirePermission(req, 'finance.transactions.withdraw');
  res.json(await returnSaleLineItemBySerials(routeParam(req, 'saleId'), req.body));
}));

saleRouter.patch('/sales/:saleId/return-line-item-stock', asyncHandler(async (req, res) => {
  await requireAnyPermission(req, ['orders.manage', 'inventory.manage']);
  res.json(await returnSaleLineItemToStock(routeParam(req, 'saleId'), req.body));
}));

saleRouter.patch('/sales/:saleId/return', asyncHandler(async (req, res) => {
  await requirePermission(req, 'finance.transactions.withdraw');
  res.json(await returnSale(routeParam(req, 'saleId'), req.body));
}));

saleRouter.delete('/sales/:saleId', asyncHandler(async (req, res) => {
  const saleId = routeParam(req, 'saleId');
  const existingSale = await Sale.findById(saleId).lean();
  if (!existingSale) {
    throw new HttpError(404, 'Sale not found.');
  }
  await requirePermission(req, getSaleManagePermission(existingSale.kind));
  res.json(await deleteSale(saleId));
}));
