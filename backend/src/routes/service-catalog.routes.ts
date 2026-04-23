import { Router } from 'express';
import {
  createServiceCatalogItem,
  listServiceCatalogItems,
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
