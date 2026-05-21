import { Router } from 'express';
import {
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

export const financeRouter = Router();

financeRouter.get('/finance/cashboxes', async (req, res, next) => {
  try {
    const includeArchived = String(req.query.includeArchived ?? '').toLowerCase();
    res.json(await listCashboxes({ includeArchived: includeArchived === '1' || includeArchived === 'true' }));
  } catch (error) {
    next(error);
  }
});

financeRouter.post('/finance/cashboxes', async (req, res, next) => {
  try {
    res.status(201).json(await createCashbox(req.body));
  } catch (error) {
    next(error);
  }
});

financeRouter.patch('/finance/cashboxes/:cashboxId', async (req, res, next) => {
  try {
    res.json(await updateCashbox(req.params.cashboxId, req.body as { name?: unknown; isArchived?: unknown }));
  } catch (error) {
    next(error);
  }
});

financeRouter.get('/finance/transactions', async (_req, res, next) => {
  try {
    res.json(await listFinanceTransactions());
  } catch (error) {
    next(error);
  }
});

financeRouter.post('/finance/transactions', async (req, res, next) => {
  try {
    res.status(201).json(await createFinanceTransaction(req.body));
  } catch (error) {
    next(error);
  }
});

financeRouter.get('/finance/report', async (_req, res, next) => {
  try {
    res.json(await getFinanceReport());
  } catch (error) {
    next(error);
  }
});

financeRouter.get('/finance/supplier-orders', async (_req, res, next) => {
  try {
    res.json(await listSupplierOrdersForAccounting());
  } catch (error) {
    next(error);
  }
});

financeRouter.post('/finance/supplier-orders/:supplierOrderId/pay', async (req, res, next) => {
  try {
    res.json(await paySupplierOrder(req.params.supplierOrderId, req.body as { cashboxId?: unknown; note?: unknown; transactionDate?: unknown }));
  } catch (error) {
    next(error);
  }
});

financeRouter.post('/finance/supplier-orders/:supplierOrderId/issue-without-payment', async (req, res, next) => {
  try {
    res.json(await issueSupplierOrderWithoutPayment(req.params.supplierOrderId));
  } catch (error) {
    next(error);
  }
});
