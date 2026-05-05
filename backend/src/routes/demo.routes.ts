import { Router } from 'express';
import {
  eraseAllDataExceptEmployees,
  seedDemoData,
} from '../domain/demo/service';

export const demoRouter = Router();

demoRouter.post('/demo/seed', async (_req, res, next) => {
  try {
    if (_req.query.kind === 'erase') {
      res.status(200).json(await eraseAllDataExceptEmployees());
      return;
    }

    res.status(201).json(await seedDemoData(_req.query.kind));
  } catch (error) {
    next(error);
  }
});

demoRouter.post('/demo/seed/sales', async (_req, res, next) => {
  try {
    res.status(201).json(await seedDemoData('sales'));
  } catch (error) {
    next(error);
  }
});

demoRouter.post('/demo/seed/repairs', async (_req, res, next) => {
  try {
    res.status(201).json(await seedDemoData('repairs'));
  } catch (error) {
    next(error);
  }
});

demoRouter.post('/demo/erase', async (_req, res, next) => {
  try {
    res.status(200).json(await eraseAllDataExceptEmployees());
  } catch (error) {
    next(error);
  }
});
