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
  updateSaleLineCosts,
  updateSaleWorkspace,
  updateSale,
} from './service';
import { employeeHasAllPermissions } from './costing';
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
  const employee = await requireAnyPermission(req, saleReadPermissions);
  res.json(await listSales(req.query as Record<string, unknown>, employee));
};

export const listOccupiedSerials = async (req: Request, res: Response): Promise<void> => {
  await requireAnyPermission(req, saleReadPermissions);
  res.json(await listOccupiedSerialNumbers(req.query as Record<string, unknown>));
};

export const getById = async (req: Request, res: Response): Promise<void> => {
  const employee = await requireAnyPermission(req, saleReadPermissions);
  res.json(await getSaleById(routeParam(req, 'saleId'), employee));
};

export const create = async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as SalePayload;
  const employee = await requirePermission(req, getSaleManagePermission(payload.kind));
  res.status(201).json(await createSale(payload, employee));
};

export const update = async (req: Request, res: Response): Promise<void> => {
  const saleId = routeParam(req, 'saleId');
  const existingSale = await Sale.findById(saleId).lean();
  if (!existingSale) {
    throw new HttpError(404, 'Sale not found.');
  }
  const employee = await requirePermission(req, getSaleManagePermission(existingSale.kind));
  res.json(await updateSale(saleId, req.body as SalePayload, employee));
};

export const updateFavorite = async (req: Request, res: Response): Promise<void> => {
  const saleId = routeParam(req, 'saleId');
  const existingSale = await Sale.findById(saleId).lean();
  if (!existingSale) {
    throw new HttpError(404, 'Sale not found.');
  }
  const employee = await requirePermission(
    req,
    getSaleFavoritePermission(existingSale.kind),
    existingSale.kind === 'sale'
      ? 'Current employee does not have permission to manage sales.'
      : 'Current employee does not have permission to manage orders.',
  );
  res.json(await updateSaleFavorite(saleId, req.body as { isFavorite?: unknown }, employee));
};

export const updateWorkspace = async (req: Request, res: Response): Promise<void> => {
  const saleId = routeParam(req, 'saleId');
  const existingSale = await Sale.findById(saleId).lean();
  if (!existingSale) {
    throw new HttpError(404, 'Sale not found.');
  }
  const payload = req.body as SalePayload;
  let employee;
  if (isManualCommentWorkspacePatch(existingSale, payload)) {
    employee = await requirePermission(
      req,
      'orders.chat',
      'Current employee does not have permission to add live feed comments.',
    );
  } else if (isAwayStatusWorkspacePatch(existingSale, payload)) {
    employee = await requireAnyPermission(req, saleReadPermissions);
  } else if (isKanbanBoardWorkspacePatch(existingSale, payload)) {
    employee = await requireAnyPermission(req, [
      'kanban.use',
      getSaleManagePermission(existingSale.kind),
    ]);
  } else {
    employee = await requirePermission(req, getSaleManagePermission(existingSale.kind));
  }
  res.json(await updateSaleWorkspace(saleId, payload, employee));
};

export const updateCosts = async (req: Request, res: Response): Promise<void> => {
  const saleId = routeParam(req, 'saleId');
  const existingSale = await Sale.findById(saleId).lean();
  if (!existingSale) {
    throw new HttpError(404, 'Sale not found.');
  }
  const managePermission = getSaleManagePermission(existingSale.kind);
  const employee = await requirePermission(req, managePermission);
  if (!employeeHasAllPermissions(employee, [managePermission, 'finance.view'])) {
    throw new HttpError(
      403,
      'Updating order costs requires order/sale management and finance.view permissions.',
    );
  }
  res.json(
    await updateSaleLineCosts(
      saleId,
      req.body as { items?: unknown; reason?: unknown },
      employee,
    ),
  );
};

export const acceptPayment = async (req: Request, res: Response): Promise<void> => {
  const saleId = routeParam(req, 'saleId');
  const existingSale = await Sale.findById(saleId).lean();
  if (!existingSale) {
    throw new HttpError(404, 'Sale not found.');
  }
  const isRepair = existingSale.kind !== 'sale';

  let employee;
  if ((req.body as { action?: unknown }).action !== 'issueWithoutPayment') {
    employee = await requirePermission(
      req,
      isRepair ? 'finance.orders.pay' : 'finance.sales.pay',
    );
  } else {
    employee = await requirePermission(
      req,
      isRepair ? 'orders.manage' : 'sales.manage',
    );
  }
  res.json(await acceptSalePayment(saleId, req.body, employee));
};

export const refundPayment = async (req: Request, res: Response): Promise<void> => {
  const employee = await requirePermission(req, 'finance.transactions.withdraw');
  res.json(await refundSalePayment(routeParam(req, 'saleId'), req.body, employee));
};

export const returnLineItem = async (req: Request, res: Response): Promise<void> => {
  const employee = await requirePermission(req, 'finance.transactions.withdraw');
  res.json(await returnSaleLineItem(routeParam(req, 'saleId'), req.body, employee));
};

export const returnLineItemSerials = async (req: Request, res: Response): Promise<void> => {
  const employee = await requirePermission(req, 'finance.transactions.withdraw');
  res.json(await returnSaleLineItemBySerials(routeParam(req, 'saleId'), req.body, employee));
};

export const returnLineItemStock = async (req: Request, res: Response): Promise<void> => {
  const employee = await requireAnyPermission(req, ['orders.manage', 'inventory.manage']);
  res.json(await returnSaleLineItemToStock(routeParam(req, 'saleId'), req.body, employee));
};

export const returnSaleHandler = async (req: Request, res: Response): Promise<void> => {
  const employee = await requirePermission(req, 'finance.transactions.withdraw');
  res.json(await returnSale(routeParam(req, 'saleId'), req.body, employee));
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

