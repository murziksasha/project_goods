import { Router } from 'express';
import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  mergeSuppliers,
  updateSupplier,
} from '../domain/supplier/service';
import type { MergeSuppliersPayload, SupplierPayload } from '../domain/shared/types';

export const supplierRouter = Router();

supplierRouter.get('/suppliers', async (req, res, next) => {
  try {
    res.json(await listSuppliers(req.query.query));
  } catch (error) {
    next(error);
  }
});

supplierRouter.post('/suppliers', async (req, res, next) => {
  try {
    res.status(201).json(await createSupplier(req.body as SupplierPayload));
  } catch (error) {
    next(error);
  }
});

supplierRouter.post('/suppliers/merge', async (req, res, next) => {
  try {
    const payload = req.body as MergeSuppliersPayload;
    res.json(
      await mergeSuppliers(payload.targetSupplierId, payload.sourceSupplierId),
    );
  } catch (error) {
    next(error);
  }
});

supplierRouter.put('/suppliers/:supplierId', async (req, res, next) => {
  try {
    res.json(await updateSupplier(req.params.supplierId, req.body as SupplierPayload));
  } catch (error) {
    next(error);
  }
});

supplierRouter.delete('/suppliers/:supplierId', async (req, res, next) => {
  try {
    res.json(await deleteSupplier(req.params.supplierId));
  } catch (error) {
    next(error);
  }
});
