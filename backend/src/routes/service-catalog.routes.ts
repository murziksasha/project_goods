import { Router } from 'express';
import {
  archiveServiceCatalogItem,
  createServiceCatalogItem,
  deleteServiceCatalogItem,
  listServiceCatalogItems,
  updateServiceCatalogItem,
} from '../domain/service-catalog/service';
import type { ServiceCatalogPayload } from '../domain/shared/types';
import { asyncHandler, routeParam } from '../shared/lib/http';

export const serviceCatalogRouter = Router();

serviceCatalogRouter.get('/services', asyncHandler(async (req, res) => {
  res.json(await listServiceCatalogItems(req.query.query));
}));

serviceCatalogRouter.post('/services', asyncHandler(async (req, res) => {
  res.status(201).json(
    await createServiceCatalogItem(req.body as ServiceCatalogPayload),
  );
}));

serviceCatalogRouter.put('/services/:serviceId', asyncHandler(async (req, res) => {
  res.json(
    await updateServiceCatalogItem(
        routeParam(req, 'serviceId'),
      req.body as ServiceCatalogPayload,
    ),
  );
}));

serviceCatalogRouter.delete('/services/:serviceId', asyncHandler(async (req, res) => {
  res.json(await deleteServiceCatalogItem(routeParam(req, 'serviceId')));
}));

serviceCatalogRouter.post('/services/:serviceId/archive', asyncHandler(async (req, res) => {
  res.json(await archiveServiceCatalogItem(routeParam(req, 'serviceId')));
}));
