import { Router } from 'express';
import {
  archiveProduct,
  createProduct,
  deleteProduct,
  exportProductsWorkbook,
  listProducts,
  updateProduct,
} from '../domain/product/service';
import type { ProductPayload } from '../domain/shared/types';

export const productRouter = Router();

productRouter.get('/products', async (req, res, next) => {
  try {
    res.json(await listProducts(req.query.query));
  } catch (error) {
    next(error);
  }
});

productRouter.post('/products', async (req, res, next) => {
  try {
    res.status(201).json(await createProduct(req.body as ProductPayload));
  } catch (error) {
    next(error);
  }
});

productRouter.put('/products/:productId', async (req, res, next) => {
  try {
    res.json(await updateProduct(req.params.productId, req.body as ProductPayload));
  } catch (error) {
    next(error);
  }
});

productRouter.delete('/products/:productId', async (req, res, next) => {
  try {
    res.json(await deleteProduct(req.params.productId));
  } catch (error) {
    next(error);
  }
});

productRouter.post('/products/:productId/archive', async (req, res, next) => {
  try {
    res.json(await archiveProduct(req.params.productId));
  } catch (error) {
    next(error);
  }
});

productRouter.get('/products/export', async (_req, res, next) => {
  try {
    const buffer = await exportProductsWorkbook();
    res.setHeader('Content-Disposition', 'attachment; filename="products.xlsx"');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

productRouter.post('/products/import', (_req, res) => {
  res.status(501).json({
    message: 'Excel import is not implemented yet.',
  });
});
