import type { Request, Response } from 'express';
import {
  acceptSalePayment,
  createSale,
  deleteSale,
  getSaleById,
  listOccupiedSerialNumbers,
  listSales,
  refundSalePayment,
  returnSale,
  returnSaleLineItem,
  returnSaleLineItemBySerials,
  returnSaleLineItemToStock,
  updateSaleFavorite,
  updateSaleWorkspace,
  updateSale,
} from './service';
import { Sale } from './model';
import {
  getSaleFavoritePermission,
  getSaleManagePermission,
  isAwayStatusWorkspacePatch,
  isKanbanBoardWorkspacePatch,
  isManualCommentWorkspacePatch,
} from './workspace-permissions';
import type { SalePayload } from '../shared/types';
import { HttpError } from '../../shared/lib/errors';
import {
  requireAnyPermission,
  requirePermission,
  routeParam,
} from '../../shared/lib/http';

export {
  getSaleFavoritePermission,
  getSaleManagePermission,
  isAwayStatusWorkspacePatch,
  isKanbanBoardWorkspacePatch,
  isManualCommentWorkspacePatch,
};

export const saleReadPermissions = [
  'orders.view',
  'sales.manage',
  'repairs.execute',
  'kanban.use',
  'supplierOrders.view',
  'supplierOrders.manage',
] as const;

export const list = async (req: Request, res: Response): Promise<void> => {
  await requireAnyPermission(req, saleReadPermissions);
  res.json(await listSales(req.query as Record<string, unknown>));
};

export const listOccupiedSerials = async (req: Request, res: Response): Promise<void> => {
  await requireAnyPermission(req, saleReadPermissions);
  res.json(await listOccupiedSerialNumbers(req.query as Record<string, unknown>));
};

export const getById = async (req: Request, res: Response): Promise<void> => {
  await requireAnyPermission(req, saleReadPermissions);
  res.json(await getSaleById(routeParam(req, 'saleId')));
};

export const create = async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as SalePayload;
  await requirePermission(req, getSaleManagePermission(payload.kind));
  res.status(201).json(await createSale(payload));
};

export const update = async (req: Request, res: Response): Promise<void> => {
  const saleId = routeParam(req, 'saleId');
  const existingSale = await Sale.findById(saleId).lean();
  if (!existingSale) {
    throw new HttpError(404, 'Sale not found.');
  }
  await requirePermission(req, getSaleManagePermission(existingSale.kind));
  res.json(await updateSale(saleId, req.body as SalePayload));
};

export const updateFavorite = async (req: Request, res: Response): Promise<void> => {
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
};

export const updateWorkspace = async (req: Request, res: Response): Promise<void> => {
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
  } else if (isAwayStatusWorkspacePatch(existingSale, payload)) {
    await requireAnyPermission(req, saleReadPermissions);
  } else if (isKanbanBoardWorkspacePatch(existingSale, payload)) {
    await requireAnyPermission(req, [
      'kanban.use',
      getSaleManagePermission(existingSale.kind),
    ]);
  } else {
    await requirePermission(req, getSaleManagePermission(existingSale.kind));
  }
  res.json(await updateSaleWorkspace(saleId, payload));
};

export const acceptPayment = async (req: Request, res: Response): Promise<void> => {
  if ((req.body as { action?: unknown }).action !== 'issueWithoutPayment') {
    await requirePermission(req, 'finance.transactions.deposit');
  }
  res.json(await acceptSalePayment(routeParam(req, 'saleId'), req.body));
};

export const refundPayment = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'finance.transactions.withdraw');
  res.json(await refundSalePayment(routeParam(req, 'saleId'), req.body));
};

export const returnLineItem = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'finance.transactions.withdraw');
  res.json(await returnSaleLineItem(routeParam(req, 'saleId'), req.body));
};

export const returnLineItemSerials = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'finance.transactions.withdraw');
  res.json(await returnSaleLineItemBySerials(routeParam(req, 'saleId'), req.body));
};

export const returnLineItemStock = async (req: Request, res: Response): Promise<void> => {
  await requireAnyPermission(req, ['orders.manage', 'inventory.manage']);
  res.json(await returnSaleLineItemToStock(routeParam(req, 'saleId'), req.body));
};

export const returnSaleHandler = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'finance.transactions.withdraw');
  res.json(await returnSale(routeParam(req, 'saleId'), req.body));
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  const saleId = routeParam(req, 'saleId');
  const existingSale = await Sale.findById(saleId).lean();
  if (!existingSale) {
    throw new HttpError(404, 'Sale not found.');
  }
  await requirePermission(req, getSaleManagePermission(existingSale.kind));
  res.json(await deleteSale(saleId));
};

