import type { Request, Response } from 'express';
import {
  cancelFinanceTransaction,
  getFinanceTransactionTypeForCancel,
  createCashbox as createCashboxService,
  createFinanceCategory,
  createFinanceCurrency,
  createFinanceTransaction as createFinanceTransactionService,
  deleteFinanceCategory as deleteFinanceCategoryService,
  getFinanceReport,
  getFinanceProfitReport,
  listCashboxes as listCashboxesService,
  listFinanceCategories,
  listFinanceCurrencies,
  listFinancePeriodSnapshots,
  listFinanceTransactions,
  updateCashbox as updateCashboxService,
  updateFinanceCategory,
  updateFinanceCurrency,
  updateFinanceTransactionNote,
} from './service';
import {
  issueSupplierOrderWithoutPayment as issueSupplierOrderWithoutPaymentService,
  listSupplierOrdersForAccounting,
  paySupplierOrder as paySupplierOrderService,
} from '../supplier-order/service';
import {
  requireAnyPermission,
  requirePermission,
  routeParam,
} from '../../shared/lib/http';
import type { EmployeePermission } from '../employee/constants';
import type { TransactionType } from './model';
import { validateFinanceTransactionPayload } from './validators';

const transactionPermissionByType: Record<TransactionType, EmployeePermission> = {
  deposit: 'finance.transactions.deposit',
  withdraw: 'finance.transactions.withdraw',
  transfer: 'finance.transactions.transfer',
};

export const listCashboxes = async (req: Request, res: Response): Promise<void> => {
  await requireAnyPermission(req, ['finance.cashboxes.view', 'finance.view']);
  const includeArchived = String(req.query.includeArchived ?? '').toLowerCase();
  res.json(await listCashboxesService({ includeArchived: includeArchived === '1' || includeArchived === 'true' }));
};

export const createCashbox = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'finance.cashboxes.manage');
  res.status(201).json(await createCashboxService(req.body));
};

export const updateCashbox = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'finance.cashboxes.manage');
  res.json(await updateCashboxService(routeParam(req, 'cashboxId'), req.body as { name?: unknown; isArchived?: unknown; enabledCurrencies?: unknown }));
};

export const listCurrencies = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'finance.view');
  const includeArchived = String(req.query.includeArchived ?? '').toLowerCase();
  res.json(await listFinanceCurrencies({ includeArchived: includeArchived === '1' || includeArchived === 'true' }));
};

export const createCurrency = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'finance.cashboxes.manage');
  res.status(201).json(await createFinanceCurrency(req.body));
};

export const updateCurrency = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'finance.cashboxes.manage');
  res.json(await updateFinanceCurrency(routeParam(req, 'currencyCode'), req.body as { isArchived?: unknown }));
};

export const listCategories = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'finance.view');
  res.json(await listFinanceCategories());
};

export const createCategory = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'finance.cashboxes.manage');
  res.status(201).json(await createFinanceCategory(req.body as { name?: unknown }));
};

export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'finance.cashboxes.manage');
  res.json(
    await updateFinanceCategory(routeParam(req, 'categorySlug'), req.body as {
      isActive?: unknown;
      name?: unknown;
    }),
  );
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'finance.cashboxes.manage');
  res.json(await deleteFinanceCategoryService(routeParam(req, 'categorySlug')));
};

export const listTransactions = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'finance.view');
  res.json(await listFinanceTransactions(req.query as Record<string, unknown>));
};

export const listPeriodSnapshots = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'finance.view');
  res.json(await listFinancePeriodSnapshots());
};

export const createTransaction = async (req: Request, res: Response): Promise<void> => {
  const payload = validateFinanceTransactionPayload(req.body);
  const type = String(payload.type ?? '') as TransactionType;
  const permission = transactionPermissionByType[type];
  await requirePermission(req, permission ?? 'finance.transactions.deposit');
  res.status(201).json(await createFinanceTransactionService(payload));
};

export const updateTransactionNote = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'finance.view');
  res.json(await updateFinanceTransactionNote(routeParam(req, 'transactionId'), req.body as { note?: unknown }));
};

export const cancelTransaction = async (req: Request, res: Response): Promise<void> => {
  const transactionId = routeParam(req, 'transactionId');
  const transactionType = await getFinanceTransactionTypeForCancel(transactionId);
  const permission = transactionPermissionByType[transactionType];
  await requirePermission(req, permission ?? 'finance.transactions.deposit');
  res.json(await cancelFinanceTransaction(transactionId));
};

export const getReport = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'finance.view');
  res.json(await getFinanceReport());
};

export const getProfitReport = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'finance.view');
  res.json(
    await getFinanceProfitReport(req.query as {
      period?: string;
      dateFrom?: string;
      dateTo?: string;
      source?: string;
    }),
  );
};

export const listSupplierOrders = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'finance.view');
  res.json(await listSupplierOrdersForAccounting());
};

export const paySupplierOrder = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'finance.supplierOrders.pay');
  res.json(await paySupplierOrderService(routeParam(req, 'supplierOrderId'), req.body as { cashboxId?: unknown; note?: unknown; transactionDate?: unknown }));
};

export const issueSupplierOrderWithoutPayment = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'finance.supplierOrders.issueWithoutPayment');
  res.json(await issueSupplierOrderWithoutPaymentService(routeParam(req, 'supplierOrderId')));
};

