import { Router } from 'express';
import {
  archiveServiceCatalogItem,
  createServiceCatalogItem,
  deleteServiceCatalogItem,
  listServiceCatalogItems,
  updateServiceCatalogItem,
} from '../domain/service-catalog/service';
import type { ServiceCatalogPayload } from '../domain/shared/types';

export const serviceCatalogRouter = Router();

serviceCatalogRouter.get('/services', async (req, res, next) => {
  try {
    res.json(await listServiceCatalogItems(req.query.query));
  } catch (error) {
    next(error);
  }
});

serviceCatalogRouter.post('/services', async (req, res, next) => {
  try {
    res.status(201).json(
      await createServiceCatalogItem(req.body as ServiceCatalogPayload),
    );
  } catch (error) {
    next(error);
  }
});

serviceCatalogRouter.put('/services/:serviceId', async (req, res, next) => {
  try {
    res.json(
      await updateServiceCatalogItem(
        req.params.serviceId,
        req.body as ServiceCatalogPayload,
      ),
    );
  } catch (error) {
    next(error);
  }
});

serviceCatalogRouter.delete('/services/:serviceId', async (req, res, next) => {
  try {
    res.json(await deleteServiceCatalogItem(req.params.serviceId));
  } catch (error) {
    next(error);
  }
});

serviceCatalogRouter.post('/services/:serviceId/archive', async (req, res, next) => {
  try {
    res.json(await archiveServiceCatalogItem(req.params.serviceId));
  } catch (error) {
    next(error);
  }
});
