import type { Request, Response } from 'express';
import {
  archiveServiceCatalogItem,
  createServiceCatalogItem,
  deleteServiceCatalogItem,
  listServiceCatalogItems,
  mergeServices,
  updateServiceCatalogItem,
} from './service';
import type {
  MergeServicesPayload,
  ServiceCatalogPayload,
} from '../shared/types';
import {
  requireAnyPermission,
  requirePermission,
  routeParam,
} from '../../shared/lib/http';

export const serviceReadPermissions = [
  'inventory.manage',
  'orders.view',
  'orders.manage',
  'finance.view',
] as const;

export const list = async (req: Request, res: Response): Promise<void> => {
  await requireAnyPermission(req, serviceReadPermissions);
  res.json(await listServiceCatalogItems(req.query.query));
};

export const create = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'inventory.manage');
  res.status(201).json(await createServiceCatalogItem(req.body as ServiceCatalogPayload));
};

export const merge = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'inventory.manage');
  const payload = req.body as MergeServicesPayload;
  res.json(
    await mergeServices(
      payload.targetServiceId,
      payload.sourceServiceId,
      payload.draftNote,
    ),
  );
};

export const update = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'inventory.manage');
  res.json(
    await updateServiceCatalogItem(
      routeParam(req, 'serviceId'),
      req.body as ServiceCatalogPayload,
    ),
  );
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'inventory.manage');
  res.json(await deleteServiceCatalogItem(routeParam(req, 'serviceId')));
};

export const archive = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'inventory.manage');
  res.json(await archiveServiceCatalogItem(routeParam(req, 'serviceId')));
};

