import { Router } from 'express';
import {
  createCatalogProduct,
  deleteCatalogProduct,
  listCatalogProducts,
  mergeCatalogProducts,
  updateCatalogProduct,
  type CatalogProductPayload,
} from '../domain/catalog-product/service';
import type { MergeCatalogProductsPayload } from '../domain/shared/types';
import {
  asyncHandler,
  requireAnyPermission,
  requirePermission,
  routeParam,
} from '../shared/lib/http';

export const catalogProductRouter = Router();

const catalogReadPermissions = [
  'inventory.manage',
  'orders.view',
  'sales.manage',
] as const;

catalogProductRouter.get(
  '/catalog-products',
  asyncHandler(async (req, res) => {
    await requireAnyPermission(req, catalogReadPermissions);
    res.json(await listCatalogProducts(req.query.query));
  }),
);

catalogProductRouter.post(
  '/catalog-products',
  asyncHandler(async (req, res) => {
    await requirePermission(req, 'inventory.manage');
    res
      .status(201)
      .json(
        await createCatalogProduct(req.body as CatalogProductPayload),
      );
  }),
);

catalogProductRouter.post(
  '/catalog-products/merge',
  asyncHandler(async (req, res) => {
    await requirePermission(req, 'inventory.manage');
    const payload = req.body as MergeCatalogProductsPayload;
    res.json(
      await mergeCatalogProducts(
        payload.targetCatalogProductId,
        payload.sourceCatalogProductId,
        payload.draftNote,
      ),
    );
  }),
);

catalogProductRouter.put(
  '/catalog-products/:catalogProductId',
  asyncHandler(async (req, res) => {
    await requirePermission(req, 'inventory.manage');
    res.json(
      await updateCatalogProduct(
        routeParam(req, 'catalogProductId'),
        req.body as CatalogProductPayload,
      ),
    );
  }),
);

catalogProductRouter.delete(
  '/catalog-products/:catalogProductId',
  asyncHandler(async (req, res) => {
    await requirePermission(req, 'inventory.manage');
    res.json(
      await deleteCatalogProduct(routeParam(req, 'catalogProductId')),
    );
  }),
);
