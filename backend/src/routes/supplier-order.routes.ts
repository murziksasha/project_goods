import { Router } from 'express';
import {
  cancelSupplierOrder,
  cancelSupplierOrderItem,
  createSupplierOrder,
  issueSupplierOrderWithoutPayment,
  listSupplierOrders,
  takeOnChargeSupplierOrder,
  updateSupplierOrder,
  updateSupplierOrderFavorite,
  type SupplierOrderPayload,
} from '../domain/supplier-order/service';
import {
  asyncHandler,
  requireAnyPermission,
  requirePermission,
  routeParam,
} from '../shared/lib/http';

export const supplierOrderRouter = Router();

supplierOrderRouter.get('/supplier-orders', asyncHandler(async (req, res) => {
  await requireAnyPermission(req, ['supplierOrders.view', 'supplierOrders.manage']);
  res.json(await listSupplierOrders(req.query.query));
}));

supplierOrderRouter.post('/supplier-orders', asyncHandler(async (req, res) => {
  await requirePermission(req, 'supplierOrders.manage');
  res.status(201).json(await createSupplierOrder(req.body as SupplierOrderPayload));
}));

supplierOrderRouter.put('/supplier-orders/:supplierOrderId', asyncHandler(async (req, res) => {
  await requirePermission(req, 'supplierOrders.manage');
  res.json(await updateSupplierOrder(routeParam(req, 'supplierOrderId'), req.body as SupplierOrderPayload));
}));

supplierOrderRouter.patch('/supplier-orders/:supplierOrderId/favorite', asyncHandler(async (req, res) => {
  await requirePermission(req, 'supplierOrders.manage');
  res.json(await updateSupplierOrderFavorite(routeParam(req, 'supplierOrderId'), req.body as { isFavorite?: unknown }));
}));

supplierOrderRouter.post('/supplier-orders/:supplierOrderId/cancel', asyncHandler(async (req, res) => {
  await requirePermission(req, 'supplierOrders.manage');
  res.json(await cancelSupplierOrder(routeParam(req, 'supplierOrderId')));
}));

supplierOrderRouter.post('/supplier-orders/:supplierOrderId/cancel-item', asyncHandler(async (req, res) => {
  await requirePermission(req, 'supplierOrders.manage');
  res.json(
    await cancelSupplierOrderItem(routeParam(req, 'supplierOrderId'), req.body as {
      itemIndex?: unknown;
      reason?: unknown;
    }),
  );
}));

supplierOrderRouter.post('/supplier-orders/:supplierOrderId/take-on-charge', asyncHandler(async (req, res) => {
  await requirePermission(req, 'supplierOrders.manage');
  res.json(
    await takeOnChargeSupplierOrder(
      routeParam(req, 'supplierOrderId'),
      req.body as {
        autoGenerateSerialNumbers?: unknown;
        serialNumbers?: unknown;
        autoGenerateArticles?: unknown;
        articleBase?: unknown;
        itemIndex?: unknown;
        warehouseId?: unknown;
        locationId?: unknown;
      },
    ),
  );
}));

supplierOrderRouter.post('/supplier-orders/:supplierOrderId/issue-without-payment', asyncHandler(async (req, res) => {
  await requirePermission(req, 'finance.supplierOrders.issueWithoutPayment');
  res.json(await issueSupplierOrderWithoutPayment(routeParam(req, 'supplierOrderId')));
}));
