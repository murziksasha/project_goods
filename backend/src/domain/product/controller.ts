import type { Request, Response } from 'express';
import {
  archiveProduct,
  createProduct,
  deleteProduct,
  exportProductsWorkbook,
  getNextProductSerialNumber,
  listProducts,
  reorderProducts,
  updateProduct,
  updateProductModelByName,
} from './service';
import type {
  ProductModelUpdatePayload,
  ProductPayload,
} from '../shared/types';
import {
  requireAnyPermission,
  requirePermission,
  routeParam,
} from '../../shared/lib/http';

export const productReadPermissions = [
  'orders.view',
  'inventory.manage',
  'supplierOrders.view',
  'supplierOrders.manage',
  'finance.view',
] as const;

export const list = async (req: Request, res: Response): Promise<void> => {
  await requireAnyPermission(req, productReadPermissions);
  res.json(await listProducts(req.query.query));
};

export const create = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'inventory.manage');
  res.status(201).json(await createProduct(req.body as ProductPayload));
};

export const getNextSerialNumber = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'inventory.manage');
  res.json(await getNextProductSerialNumber());
};

export const updateModelByName = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'inventory.manage');
  res.json(
    await updateProductModelByName(req.body as ProductModelUpdatePayload),
  );
};

export const reorder = async (req: Request, res: Response): Promise<void> => {
  await requireAnyPermission(req, ['inventory.manage', 'orders.manage']);
  const payload = req.body as { items: Array<{ name: string; sortOrder: number }> };
  res.json(await reorderProducts(payload?.items));
};

export const update = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'inventory.manage');
  res.json(await updateProduct(routeParam(req, 'productId'), req.body as ProductPayload));
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'inventory.manage');
  res.json(await deleteProduct(routeParam(req, 'productId')));
};

export const archive = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'inventory.manage');
  res.json(await archiveProduct(routeParam(req, 'productId')));
};

export const exportProducts = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'inventory.manage');
  const buffer = await exportProductsWorkbook();
  res.setHeader('Content-Disposition', 'attachment; filename="products.xlsx"');
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.send(buffer);
};

export const importProducts = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'inventory.manage');
  res.status(501).json({
    message: 'Excel import is not implemented yet.',
  });
};

