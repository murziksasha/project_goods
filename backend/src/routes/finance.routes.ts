import { Router } from 'express';
import {
  cancelFinanceTransaction,
  createCashbox,
  createFinanceCurrency,
  createFinanceTransaction,
  getFinanceReport,
  listCashboxes,
  listFinanceCurrencies,
  listFinanceTransactions,
  updateCashbox,
  updateFinanceCurrency,
  updateFinanceTransactionNote,
} from '../domain/finance/service';
import {
  issueSupplierOrderWithoutPayment,
  listSupplierOrdersForAccounting,
  paySupplierOrder,
} from '../domain/supplier-order/service';
import {
  asyncHandler,
  requireAnyPermission,
  requirePermission,
  routeParam,
} from '../shared/lib/http';
import type { EmployeePermission } from '../domain/employee/constants';
import type { TransactionType } from '../domain/finance/model';
import { validateFinanceTransactionPayload } from '../domain/finance/validators';

export const financeRouter = Router();

const transactionPermissionByType: Record<TransactionType, EmployeePermission> = {
  deposit: 'finance.transactions.deposit',
  withdraw: 'finance.transactions.withdraw',
  transfer: 'finance.transactions.transfer',
};

financeRouter.get('/finance/cashboxes', asyncHandler(async (req, res) => {
  await requireAnyPermission(req, ['finance.cashboxes.view', 'finance.view']);
  const includeArchived = String(req.query.includeArchived ?? '').toLowerCase();
  res.json(await listCashboxes({ includeArchived: includeArchived === '1' || includeArchived === 'true' }));
}));

financeRouter.post('/finance/cashboxes', asyncHandler(async (req, res) => {
  await requirePermission(req, 'finance.cashboxes.manage');
  res.status(201).json(await createCashbox(req.body));
}));

financeRouter.patch('/finance/cashboxes/:cashboxId', asyncHandler(async (req, res) => {
  await requirePermission(req, 'finance.cashboxes.manage');
  res.json(await updateCashbox(routeParam(req, 'cashboxId'), req.body as { name?: unknown; isArchived?: unknown; enabledCurrencies?: unknown }));
}));

financeRouter.get('/finance/currencies', asyncHandler(async (req, res) => {
  await requirePermission(req, 'finance.view');
  const includeArchived = String(req.query.includeArchived ?? '').toLowerCase();
  res.json(await listFinanceCurrencies({ includeArchived: includeArchived === '1' || includeArchived === 'true' }));
}));

financeRouter.post('/finance/currencies', asyncHandler(async (req, res) => {
  await requirePermission(req, 'finance.cashboxes.manage');
  res.status(201).json(await createFinanceCurrency(req.body));
}));

financeRouter.patch('/finance/currencies/:currencyCode', asyncHandler(async (req, res) => {
  await requirePermission(req, 'finance.cashboxes.manage');
  res.json(await updateFinanceCurrency(routeParam(req, 'currencyCode'), req.body as { isArchived?: unknown }));
}));

financeRouter.get('/finance/transactions', asyncHandler(async (req, res) => {
  await requirePermission(req, 'finance.view');
  res.json(await listFinanceTransactions());
}));

financeRouter.post('/finance/transactions', asyncHandler(async (req, res) => {
  const payload = validateFinanceTransactionPayload(req.body);
  const type = String(payload.type ?? '') as TransactionType;
  const permission = transactionPermissionByType[type];
  await requirePermission(req, permission ?? 'finance.transactions.deposit');
  res.status(201).json(await createFinanceTransaction(payload));
}));

financeRouter.patch('/finance/transactions/:transactionId', asyncHandler(async (req, res) => {
  await requirePermission(req, 'finance.view');
  res.json(await updateFinanceTransactionNote(routeParam(req, 'transactionId'), req.body as { note?: unknown }));
}));

financeRouter.post('/finance/transactions/:transactionId/cancel', asyncHandler(async (req, res) => {
  await requirePermission(req, 'finance.transactions.transfer');
  res.json(await cancelFinanceTransaction(routeParam(req, 'transactionId')));
}));

financeRouter.get('/finance/report', asyncHandler(async (req, res) => {
  await requirePermission(req, 'finance.view');
  res.json(await getFinanceReport());
}));

financeRouter.get('/finance/supplier-orders', asyncHandler(async (req, res) => {
  await requirePermission(req, 'finance.view');
  res.json(await listSupplierOrdersForAccounting());
}));

financeRouter.post('/finance/supplier-orders/:supplierOrderId/pay', asyncHandler(async (req, res) => {
  await requirePermission(req, 'finance.supplierOrders.pay');
  res.json(await paySupplierOrder(routeParam(req, 'supplierOrderId'), req.body as { cashboxId?: unknown; note?: unknown; transactionDate?: unknown }));
}));

financeRouter.post('/finance/supplier-orders/:supplierOrderId/issue-without-payment', asyncHandler(async (req, res) => {
  await requirePermission(req, 'finance.supplierOrders.issueWithoutPayment');
  res.json(await issueSupplierOrderWithoutPayment(routeParam(req, 'supplierOrderId')));
}));
