import { Router } from 'express';
import {
  deleteCatalogProduct,
  listCatalogProducts,
  updateCatalogProduct,
  type CatalogProductPayload,
} from '../domain/catalog-product/service';

export const catalogProductRouter = Router();

catalogProductRouter.get('/catalog-products', async (req, res, next) => {
  try {
    res.json(await listCatalogProducts(req.query.query));
  } catch (error) {
    next(error);
  }
});

catalogProductRouter.put('/catalog-products/:catalogProductId', async (req, res, next) => {
  try {
    res.json(
      await updateCatalogProduct(
        req.params.catalogProductId,
        req.body as CatalogProductPayload,
      ),
    );
  } catch (error) {
    next(error);
  }
});

catalogProductRouter.delete('/catalog-products/:catalogProductId', async (req, res, next) => {
  try {
    res.json(await deleteCatalogProduct(req.params.catalogProductId));
  } catch (error) {
    next(error);
  }
});
