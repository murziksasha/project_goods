import { Router } from 'express';
import {
  createCashbox,
  createFinanceTransaction,
  getFinanceReport,
  listCashboxes,
  listFinanceTransactions,
} from '../domain/finance/service';

export const financeRouter = Router();

financeRouter.get('/finance/cashboxes', async (_req, res, next) => {
  try {
    res.json(await listCashboxes());
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
