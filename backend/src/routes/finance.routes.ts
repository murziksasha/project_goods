import { Router } from 'express';
import {
  cancelFinanceTransaction,
  createCashbox,
  createFinanceTransaction,
  getFinanceReport,
  listCashboxes,
  listFinanceTransactions,
  updateCashbox,
} from '../domain/finance/service';
import {
  issueSupplierOrderWithoutPayment,
  listSupplierOrdersForAccounting,
  paySupplierOrder,
} from '../domain/supplier-order/service';
import {
  getBearerToken,
  requireAnyPermissionByToken,
  requirePermissionByToken,
} from '../domain/auth/service';
import type { EmployeePermission } from '../domain/employee/constants';
import type { TransactionType } from '../domain/finance/model';

export const financeRouter = Router();

const transactionPermissionByType: Record<TransactionType, EmployeePermission> = {
  deposit: 'finance.transactions.deposit',
  withdraw: 'finance.transactions.withdraw',
  transfer: 'finance.transactions.transfer',
};

financeRouter.get('/finance/cashboxes', async (req, res, next) => {
  try {
    await requireAnyPermissionByToken(
      getBearerToken(req.headers.authorization),
      ['finance.cashboxes.view', 'finance.view'],
    );
    const includeArchived = String(req.query.includeArchived ?? '').toLowerCase();
    res.json(await listCashboxes({ includeArchived: includeArchived === '1' || includeArchived === 'true' }));
  } catch (error) {
    next(error);
  }
});

financeRouter.post('/finance/cashboxes', async (req, res, next) => {
  try {
    await requirePermissionByToken(getBearerToken(req.headers.authorization), 'finance.cashboxes.manage');
    res.status(201).json(await createCashbox(req.body));
  } catch (error) {
    next(error);
  }
});

financeRouter.patch('/finance/cashboxes/:cashboxId', async (req, res, next) => {
  try {
    await requirePermissionByToken(getBearerToken(req.headers.authorization), 'finance.cashboxes.manage');
    res.json(await updateCashbox(req.params.cashboxId, req.body as { name?: unknown; isArchived?: unknown }));
  } catch (error) {
    next(error);
  }
});

financeRouter.get('/finance/transactions', async (req, res, next) => {
  try {
    await requirePermissionByToken(getBearerToken(req.headers.authorization), 'finance.view');
    res.json(await listFinanceTransactions());
  } catch (error) {
    next(error);
  }
});

financeRouter.post('/finance/transactions', async (req, res, next) => {
  try {
    const type = String((req.body as { type?: unknown })?.type ?? '') as TransactionType;
    const permission = transactionPermissionByType[type];
    await requirePermissionByToken(
      getBearerToken(req.headers.authorization),
      permission ?? 'finance.transactions.deposit',
    );
    res.status(201).json(await createFinanceTransaction(req.body));
  } catch (error) {
    next(error);
  }
});

financeRouter.post('/finance/transactions/:transactionId/cancel', async (req, res, next) => {
  try {
    await requirePermissionByToken(
      getBearerToken(req.headers.authorization),
      'finance.transactions.transfer',
    );
    res.json(await cancelFinanceTransaction(req.params.transactionId));
  } catch (error) {
    next(error);
  }
});

financeRouter.get('/finance/report', async (req, res, next) => {
  try {
    await requirePermissionByToken(getBearerToken(req.headers.authorization), 'finance.view');
    res.json(await getFinanceReport());
  } catch (error) {
    next(error);
  }
});

financeRouter.get('/finance/supplier-orders', async (req, res, next) => {
  try {
    await requirePermissionByToken(getBearerToken(req.headers.authorization), 'finance.view');
    res.json(await listSupplierOrdersForAccounting());
  } catch (error) {
    next(error);
  }
});

financeRouter.post('/finance/supplier-orders/:supplierOrderId/pay', async (req, res, next) => {
  try {
    await requirePermissionByToken(getBearerToken(req.headers.authorization), 'finance.supplierOrders.pay');
    res.json(await paySupplierOrder(req.params.supplierOrderId, req.body as { cashboxId?: unknown; note?: unknown; transactionDate?: unknown }));
  } catch (error) {
    next(error);
  }
});

financeRouter.post('/finance/supplier-orders/:supplierOrderId/issue-without-payment', async (req, res, next) => {
  try {
    await requirePermissionByToken(
      getBearerToken(req.headers.authorization),
      'finance.supplierOrders.issueWithoutPayment',
    );
    res.json(await issueSupplierOrderWithoutPayment(req.params.supplierOrderId));
  } catch (error) {
    next(error);
  }
});
