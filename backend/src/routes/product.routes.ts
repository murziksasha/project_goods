import { Router } from 'express';
import {
  archiveProduct,
  createProduct,
  deleteProduct,
  exportProductsWorkbook,
  getNextProductSerialNumber,
  listProducts,
  updateProduct,
  updateProductModelByName,
} from '../domain/product/service';
import type {
  ProductModelUpdatePayload,
  ProductPayload,
} from '../domain/shared/types';
import { asyncHandler, requireAnyPermission, requirePermission, routeParam } from '../shared/lib/http';

export const productRouter = Router();

const productReadPermissions = [
  'orders.view',
  'inventory.manage',
  'supplierOrders.view',
  'supplierOrders.manage',
] as const;

productRouter.get('/products', asyncHandler(async (req, res) => {
  await requireAnyPermission(req, productReadPermissions);
  res.json(await listProducts(req.query.query));
}));

productRouter.post('/products', asyncHandler(async (req, res) => {
  await requirePermission(req, 'inventory.manage');
  res.status(201).json(await createProduct(req.body as ProductPayload));
}));

productRouter.post('/products/serial-number/next', asyncHandler(async (req, res) => {
  await requirePermission(req, 'inventory.manage');
  res.json(await getNextProductSerialNumber());
}));

productRouter.patch('/products/model-by-name', asyncHandler(async (req, res) => {
  await requirePermission(req, 'inventory.manage');
  res.json(
    await updateProductModelByName(req.body as ProductModelUpdatePayload),
  );
}));

productRouter.put('/products/:productId', asyncHandler(async (req, res) => {
  await requirePermission(req, 'inventory.manage');
  res.json(await updateProduct(routeParam(req, 'productId'), req.body as ProductPayload));
}));

productRouter.delete('/products/:productId', asyncHandler(async (req, res) => {
  await requirePermission(req, 'inventory.manage');
  res.json(await deleteProduct(routeParam(req, 'productId')));
}));

productRouter.post('/products/:productId/archive', asyncHandler(async (req, res) => {
  await requirePermission(req, 'inventory.manage');
  res.json(await archiveProduct(routeParam(req, 'productId')));
}));

productRouter.get('/products/export', asyncHandler(async (req, res) => {
  await requirePermission(req, 'inventory.manage');
  const buffer = await exportProductsWorkbook();
  res.setHeader('Content-Disposition', 'attachment; filename="products.xlsx"');
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.send(buffer);
}));

productRouter.post('/products/import', asyncHandler(async (req, res) => {
  await requirePermission(req, 'inventory.manage');
  res.status(501).json({
    message: 'Excel import is not implemented yet.',
  });
}));