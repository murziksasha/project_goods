import { Router } from 'express';
import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  mergeSuppliers,
  updateSupplier,
} from '../domain/supplier/service';
import type { MergeSuppliersPayload, SupplierPayload } from '../domain/shared/types';
import {
  asyncHandler,
  requireAnyPermission,
  requirePermission,
  routeParam,
} from '../shared/lib/http';

export const supplierRouter = Router();

const supplierReadPermissions = [
  'clients.manage',
  'supplierOrders.view',
  'supplierOrders.manage',
] as const;

supplierRouter.get('/suppliers', asyncHandler(async (req, res) => {
  await requireAnyPermission(req, supplierReadPermissions);
  res.json(await listSuppliers(req.query.query));
}));

supplierRouter.post('/suppliers', asyncHandler(async (req, res) => {
  await requirePermission(req, 'clients.manage');
  res.status(201).json(await createSupplier(req.body as SupplierPayload));
}));

supplierRouter.post('/suppliers/merge', asyncHandler(async (req, res) => {
  await requirePermission(req, 'clients.manage');
  const payload = req.body as MergeSuppliersPayload;
  res.json(
    await mergeSuppliers(payload.targetSupplierId, payload.sourceSupplierId),
  );
}));

supplierRouter.put('/suppliers/:supplierId', asyncHandler(async (req, res) => {
  await requirePermission(req, 'clients.manage');
  res.json(await updateSupplier(routeParam(req, 'supplierId'), req.body as SupplierPayload));
}));

supplierRouter.delete('/suppliers/:supplierId', asyncHandler(async (req, res) => {
  await requirePermission(req, 'clients.manage');
  res.json(await deleteSupplier(routeParam(req, 'supplierId')));
}));