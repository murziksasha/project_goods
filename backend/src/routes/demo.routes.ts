import { Router } from 'express';
import { seedDemoData } from '../domain/demo/service';

export const demoRouter = Router();

demoRouter.post('/demo/seed', async (_req, res, next) => {
  try {
    res.status(201).json(await seedDemoData());
  } catch (error) {
    next(error);
  }
});
