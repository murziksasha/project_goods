import type { Request, Response } from 'express';
import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  mergeSuppliers,
  updateSupplier,
} from './service';
import type {
  MergeSuppliersPayload,
  SupplierPayload,
} from '../shared/types';
import {
  requireAnyPermission,
  requirePermission,
  routeParam,
} from '../../shared/lib/http';

export const supplierReadPermissions = [
  'clients.manage',
  'supplierOrders.view',
  'supplierOrders.manage',
] as const;

export const list = async (req: Request, res: Response): Promise<void> => {
  await requireAnyPermission(req, supplierReadPermissions);
  res.json(await listSuppliers(req.query.query));
};

export const create = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'clients.manage');
  res.status(201).json(await createSupplier(req.body as SupplierPayload));
};

export const merge = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'clients.manage');
  const payload = req.body as MergeSuppliersPayload;
  res.json(
    await mergeSuppliers(
      payload.targetSupplierId,
      payload.sourceSupplierId,
      payload.draftNote,
    ),
  );
};

export const update = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'clients.manage');
  res.json(
    await updateSupplier(
      routeParam(req, 'supplierId'),
      req.body as SupplierPayload,
    ),
  );
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'clients.manage');
  res.json(await deleteSupplier(routeParam(req, 'supplierId')));
};

