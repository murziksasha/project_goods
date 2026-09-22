import type { Request, Response } from 'express';
import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  mergeSuppliers,
  reorderSuppliers,
  updateSupplier,
} from './service';
import {
  exportSuppliersWorkbook,
  importSuppliersWorkbook,
} from './excel';
import type {
  MergeSuppliersPayload,
  SupplierPayload,
} from '../shared/types';
import { HttpError } from '../../shared/lib/errors';
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

export const list = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await requireAnyPermission(req, supplierReadPermissions);
  res.json(await listSuppliers(req.query.query));
};

export const create = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await requirePermission(req, 'clients.manage');
  res
    .status(201)
    .json(await createSupplier(req.body as SupplierPayload));
};

export const importSuppliers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await requirePermission(req, 'clients.manage');
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new HttpError(400, 'Excel file is required.');
  }
  res.status(201).json(await importSuppliersWorkbook(req.body));
};

export const exportSuppliers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await requirePermission(req, 'clients.manage');
  const buffer = await exportSuppliersWorkbook();
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="suppliers.xls"',
  );
  res.setHeader('Content-Type', 'application/vnd.ms-excel');
  res.send(buffer);
};

export const merge = async (
  req: Request,
  res: Response,
): Promise<void> => {
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

export const update = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await requirePermission(req, 'clients.manage');
  res.json(
    await updateSupplier(
      routeParam(req, 'supplierId'),
      req.body as SupplierPayload,
    ),
  );
};

export const remove = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await requirePermission(req, 'clients.manage');
  res.json(await deleteSupplier(routeParam(req, 'supplierId')));
};

export const reorder = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await requireAnyPermission(req, [
    'clients.manage',
    'supplierOrders.manage',
    'orders.manage',
  ]);
  const payload = req.body as {
    items: Array<{ id: string; sortOrder: number }>;
  };
  res.json(await reorderSuppliers(payload?.items));
};
