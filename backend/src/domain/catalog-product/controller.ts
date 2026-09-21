import type { Request, Response } from 'express';
import {
  createCatalogProduct,
  deleteCatalogProduct,
  listCatalogProducts,
  mergeCatalogProducts,
  updateCatalogProduct,
  type CatalogProductPayload,
} from './service';
import type { MergeCatalogProductsPayload } from '../shared/types';
import {
  requireAnyPermission,
  requirePermission,
  routeParam,
} from '../../shared/lib/http';

export const catalogReadPermissions = [
  'inventory.manage',
  'orders.view',
  'sales.manage',
] as const;

export const list = async (req: Request, res: Response): Promise<void> => {
  await requireAnyPermission(req, catalogReadPermissions);
  res.json(await listCatalogProducts(req.query.query));
};

export const create = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'inventory.manage');
  res.status(201).json(await createCatalogProduct(req.body as CatalogProductPayload));
};

export const merge = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'inventory.manage');
  const payload = req.body as MergeCatalogProductsPayload;
  res.json(
    await mergeCatalogProducts(
      payload.targetCatalogProductId,
      payload.sourceCatalogProductId,
      payload.draftNote,
    ),
  );
};

export const update = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'inventory.manage');
  res.json(
    await updateCatalogProduct(
      routeParam(req, 'catalogProductId'),
      req.body as CatalogProductPayload,
    ),
  );
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'inventory.manage');
  res.json(await deleteCatalogProduct(routeParam(req, 'catalogProductId')));
};

