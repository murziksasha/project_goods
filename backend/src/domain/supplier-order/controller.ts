import type { Request, Response } from 'express';
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
} from './service';
import {
  requireAnyPermission,
  requirePermission,
  routeParam,
} from '../../shared/lib/http';

export const list = async (req: Request, res: Response): Promise<void> => {
  await requireAnyPermission(req, ['supplierOrders.view', 'supplierOrders.manage']);
  res.json(await listSupplierOrders(req.query.query));
};

export const create = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'supplierOrders.manage');
  res.status(201).json(await createSupplierOrder(req.body as SupplierOrderPayload));
};

export const update = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'supplierOrders.manage');
  res.json(await updateSupplierOrder(routeParam(req, 'supplierOrderId'), req.body as SupplierOrderPayload));
};

export const updateFavorite = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'supplierOrders.manage');
  res.json(await updateSupplierOrderFavorite(routeParam(req, 'supplierOrderId'), req.body as { isFavorite?: unknown }));
};

export const cancel = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'supplierOrders.manage');
  res.json(await cancelSupplierOrder(routeParam(req, 'supplierOrderId')));
};

export const cancelItem = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'supplierOrders.manage');
  res.json(
    await cancelSupplierOrderItem(routeParam(req, 'supplierOrderId'), req.body as {
      itemIndex?: unknown;
      reason?: unknown;
    }),
  );
};

export const takeOnCharge = async (req: Request, res: Response): Promise<void> => {
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
};

export const issueWithoutPayment = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'finance.supplierOrders.issueWithoutPayment');
  res.json(await issueSupplierOrderWithoutPayment(routeParam(req, 'supplierOrderId')));
};

