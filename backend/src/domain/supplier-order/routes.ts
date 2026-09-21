import { Router } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const supplierOrderRouter = Router();

supplierOrderRouter.get('/supplier-orders', asyncHandler(controller.list));
supplierOrderRouter.post('/supplier-orders', asyncHandler(controller.create));
supplierOrderRouter.put('/supplier-orders/:supplierOrderId', asyncHandler(controller.update));
supplierOrderRouter.patch('/supplier-orders/:supplierOrderId/favorite', asyncHandler(controller.updateFavorite));
supplierOrderRouter.post('/supplier-orders/:supplierOrderId/cancel', asyncHandler(controller.cancel));
supplierOrderRouter.post('/supplier-orders/:supplierOrderId/cancel-item', asyncHandler(controller.cancelItem));
supplierOrderRouter.post('/supplier-orders/:supplierOrderId/take-on-charge', asyncHandler(controller.takeOnCharge));
supplierOrderRouter.post(
  '/supplier-orders/:supplierOrderId/issue-without-payment',
  asyncHandler(controller.issueWithoutPayment),
);

