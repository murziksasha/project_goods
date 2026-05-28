import { Router } from 'express';
import {
  cancelSupplierOrder,
  createSupplierOrder,
  issueSupplierOrderWithoutPayment,
  listSupplierOrders,
  takeOnChargeSupplierOrder,
  updateSupplierOrder,
  type SupplierOrderPayload,
} from '../domain/supplier-order/service';
import { getBearerToken, requirePermissionByToken } from '../domain/auth/service';

export const supplierOrderRouter = Router();

supplierOrderRouter.get('/supplier-orders', async (req, res, next) => {
  try {
    res.json(await listSupplierOrders(req.query.query));
  } catch (error) {
    next(error);
  }
});

supplierOrderRouter.post('/supplier-orders', async (req, res, next) => {
  try {
    res.status(201).json(await createSupplierOrder(req.body as SupplierOrderPayload));
  } catch (error) {
    next(error);
  }
});

supplierOrderRouter.put('/supplier-orders/:supplierOrderId', async (req, res, next) => {
  try {
    res.json(await updateSupplierOrder(req.params.supplierOrderId, req.body as SupplierOrderPayload));
  } catch (error) {
    next(error);
  }
});

supplierOrderRouter.post('/supplier-orders/:supplierOrderId/cancel', async (req, res, next) => {
  try {
    res.json(await cancelSupplierOrder(req.params.supplierOrderId));
  } catch (error) {
    next(error);
  }
});

supplierOrderRouter.post('/supplier-orders/:supplierOrderId/take-on-charge', async (req, res, next) => {
  try {
    res.json(
      await takeOnChargeSupplierOrder(
        req.params.supplierOrderId,
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
  } catch (error) {
    next(error);
  }
});

supplierOrderRouter.post('/supplier-orders/:supplierOrderId/issue-without-payment', async (req, res, next) => {
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
