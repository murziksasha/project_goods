import { Router } from 'express';
import { seedDemoData } from '../domain/demo/service';

export const demoRouter = Router();

demoRouter.post('/demo/seed', async (_req, res, next) => {
  try {
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
