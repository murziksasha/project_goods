import { Router } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const financeRouter = Router();

financeRouter.get('/finance/cashboxes', asyncHandler(controller.listCashboxes));
financeRouter.post('/finance/cashboxes', asyncHandler(controller.createCashbox));
financeRouter.patch('/finance/cashboxes/:cashboxId', asyncHandler(controller.updateCashbox));
financeRouter.get('/finance/currencies', asyncHandler(controller.listCurrencies));
financeRouter.post('/finance/currencies', asyncHandler(controller.createCurrency));
financeRouter.patch('/finance/currencies/:currencyCode', asyncHandler(controller.updateCurrency));
financeRouter.get('/finance/categories', asyncHandler(controller.listCategories));
financeRouter.post('/finance/categories', asyncHandler(controller.createCategory));
financeRouter.patch('/finance/categories/:categorySlug', asyncHandler(controller.updateCategory));
financeRouter.delete('/finance/categories/:categorySlug', asyncHandler(controller.deleteCategory));
financeRouter.get('/finance/transactions', asyncHandler(controller.listTransactions));
financeRouter.get('/finance/period-snapshots', asyncHandler(controller.listPeriodSnapshots));
financeRouter.post('/finance/transactions', asyncHandler(controller.createTransaction));
financeRouter.patch('/finance/transactions/:transactionId', asyncHandler(controller.updateTransactionNote));
financeRouter.post('/finance/transactions/:transactionId/cancel', asyncHandler(controller.cancelTransaction));
financeRouter.get('/finance/report', asyncHandler(controller.getReport));
financeRouter.get('/finance/profit-report', asyncHandler(controller.getProfitReport));
financeRouter.get('/finance/supplier-orders', asyncHandler(controller.listSupplierOrders));
financeRouter.post('/finance/supplier-orders/:supplierOrderId/pay', asyncHandler(controller.paySupplierOrder));
financeRouter.post(
  '/finance/supplier-orders/:supplierOrderId/issue-without-payment',
  asyncHandler(controller.issueSupplierOrderWithoutPayment),
);

