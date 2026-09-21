import { Router } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const saleRouter = Router();

export {
  getSaleFavoritePermission,
  getSaleManagePermission,
  isAwayStatusWorkspacePatch,
  isKanbanBoardWorkspacePatch,
  isManualCommentWorkspacePatch,
} from './controller';

saleRouter.get('/sales', asyncHandler(controller.list));
saleRouter.get('/sales/occupied-serials', asyncHandler(controller.listOccupiedSerials));
saleRouter.get('/sales/:saleId', asyncHandler(controller.getById));
saleRouter.post('/sales', asyncHandler(controller.create));
saleRouter.put('/sales/:saleId', asyncHandler(controller.update));
saleRouter.patch('/sales/:saleId/favorite', asyncHandler(controller.updateFavorite));
saleRouter.patch('/sales/:saleId/workspace', asyncHandler(controller.updateWorkspace));
saleRouter.patch('/sales/:saleId/payment', asyncHandler(controller.acceptPayment));
saleRouter.patch('/sales/:saleId/refund', asyncHandler(controller.refundPayment));
saleRouter.patch('/sales/:saleId/return-line-item', asyncHandler(controller.returnLineItem));
saleRouter.patch('/sales/:saleId/return-line-item-serials', asyncHandler(controller.returnLineItemSerials));
saleRouter.patch('/sales/:saleId/return-line-item-stock', asyncHandler(controller.returnLineItemStock));
saleRouter.patch('/sales/:saleId/return', asyncHandler(controller.returnSaleHandler));
saleRouter.delete('/sales/:saleId', asyncHandler(controller.remove));

