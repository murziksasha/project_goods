import { Router } from 'express';
import {
  createCatalogProduct,
  deleteCatalogProduct,
  listCatalogProducts,
  updateCatalogProduct,
  type CatalogProductPayload,
} from '../domain/catalog-product/service';
import { asyncHandler, routeParam } from '../shared/lib/http';

export const catalogProductRouter = Router();

catalogProductRouter.get('/catalog-products', asyncHandler(async (req, res) => {
  res.json(await listCatalogProducts(req.query.query));
}));

catalogProductRouter.post('/catalog-products', asyncHandler(async (req, res) => {
  res.status(201).json(await createCatalogProduct(req.body as CatalogProductPayload));
}));

catalogProductRouter.put('/catalog-products/:catalogProductId', asyncHandler(async (req, res) => {
  res.json(
    await updateCatalogProduct(
      routeParam(req, 'catalogProductId'),
      req.body as CatalogProductPayload,
    ),
  );
}));

catalogProductRouter.delete('/catalog-products/:catalogProductId', asyncHandler(async (req, res) => {
  res.json(await deleteCatalogProduct(routeParam(req, 'catalogProductId')));
}));
