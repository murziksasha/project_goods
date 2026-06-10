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
  updateSaleWorkspace,
  updateSale,
} from '../domain/sale/service';
import { Sale } from '../domain/sale/model';
import { getBearerToken, requirePermissionByToken } from '../domain/auth/service';
import type { SalePayload } from '../domain/shared/types';
import { normalizeSalePayload } from '../shared/lib/parsers';
import { asyncHandler, routeParam } from '../shared/lib/http';

export const saleRouter = Router();

type WorkspaceComparableSale = {
  kind?: string;
  status?: string;
  paidAmount?: number;
  master?: { toString: () => string } | string | null;
  issuedBy?: { toString: () => string } | string | null;
  productSnapshot?: {
    name?: string;
    serialNumber?: string | null;
  } | null;
  discount?: unknown;
  paymentHistory?: unknown[];
  lineItems?: unknown[];
  timeline?: unknown[];
};

const toComparableWorkspaceState = (
  sale: WorkspaceComparableSale,
  payloadInput: SalePayload,
) => {
  const payload = normalizeSalePayload(payloadInput);
  const current = {
    kind: sale.kind === 'sale' ? 'sale' : 'repair',
    status: String(sale.status ?? ''),
    paidAmount: sale.paidAmount ?? 0,
    masterId: sale.master ? String(sale.master) : '',
    issuedById: sale.issuedBy ? String(sale.issuedBy) : '',
    deviceName: sale.productSnapshot?.name ?? '',
    serialNumber: sale.productSnapshot?.serialNumber ?? '',
    discount: sale.discount ?? { mode: 'amount', value: 0 },
    paymentHistory: sale.paymentHistory ?? [],
    lineItems: sale.lineItems ?? [],
    timeline: sale.timeline ?? [],
  };

  return {
    current,
    next: {
      kind: payloadInput.kind === undefined ? current.kind : payload.kind,
      status: payloadInput.status === undefined ? current.status : payload.status,
      paidAmount:
        payloadInput.paidAmount === undefined ? current.paidAmount : payload.paidAmount,
      masterId:
        payloadInput.masterId === undefined ? current.masterId : payload.masterId,
      issuedById:
        payloadInput.issuedById === undefined ? current.issuedById : payload.issuedById,
      deviceName:
        payloadInput.deviceName === undefined ? current.deviceName : payload.deviceName,
      serialNumber:
        payloadInput.serialNumber === undefined
          ? current.serialNumber
          : payload.serialNumber,
      discount:
        payloadInput.discount === undefined ? current.discount : payload.discount,
      paymentHistory:
        payloadInput.paymentHistory === undefined
          ? current.paymentHistory
          : payload.paymentHistory,
      lineItems:
        payloadInput.lineItems === undefined ? current.lineItems : payload.lineItems,
      timeline: payload.timeline,
    },
  };
};

export const isManualCommentWorkspacePatch = (
  sale: WorkspaceComparableSale,
  payloadInput: SalePayload,
) => {
  const { current, next } = toComparableWorkspaceState(sale, payloadInput);
  if (JSON.stringify(current.timeline) === JSON.stringify(next.timeline)) {
    return false;
  }

  return (
    current.kind === next.kind &&
    current.status === next.status &&
    current.paidAmount === next.paidAmount &&
    current.masterId === next.masterId &&
    current.issuedById === next.issuedById &&
    current.deviceName === next.deviceName &&
    current.serialNumber === next.serialNumber &&
    JSON.stringify(current.discount) === JSON.stringify(next.discount) &&
    JSON.stringify(current.paymentHistory) ===
      JSON.stringify(next.paymentHistory) &&
    JSON.stringify(current.lineItems) === JSON.stringify(next.lineItems)
  );
};

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
  const saleId = routeParam(req, 'saleId');
  const existingSale = await Sale.findById(saleId).lean();
  if (!existingSale) {
    throw new Error('Sale not found.');
  }
  if (isManualCommentWorkspacePatch(existingSale, req.body as SalePayload)) {
    await requirePermissionByToken(
      getBearerToken(req.headers.authorization),
      'orders.chat',
      'Current employee does not have permission to add live feed comments.',
    );
  }
  res.json(await updateSaleWorkspace(routeParam(req, 'saleId'), req.body as SalePayload));
}));

saleRouter.patch('/sales/:saleId/payment', asyncHandler(async (req, res) => {
  if ((req.body as { action?: unknown }).action !== 'issueWithoutPayment') {
    await requirePermissionByToken(
      getBearerToken(req.headers.authorization),
      'finance.transactions.deposit',
    );
  }
  res.json(await acceptSalePayment(routeParam(req, 'saleId'), req.body));
}));

saleRouter.patch('/sales/:saleId/refund', asyncHandler(async (req, res) => {
  await requirePermissionByToken(getBearerToken(req.headers.authorization), 'finance.transactions.withdraw');
  res.json(await refundSalePayment(routeParam(req, 'saleId'), req.body));
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
