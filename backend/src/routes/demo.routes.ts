import { Router } from 'express';
import {
  eraseAllDataExceptEmployees,
  seedDemoData,
} from '../domain/demo/service';
import { asyncHandler } from '../shared/lib/http';

export const demoRouter = Router();

demoRouter.post('/demo/seed', asyncHandler(async (_req, res) => {
  if (_req.query.kind === 'erase') {
    res.status(200).json(await eraseAllDataExceptEmployees());
    return;
  }

  res.status(201).json(await seedDemoData(_req.query.kind));
}));

demoRouter.post('/demo/seed/sales', asyncHandler(async (_req, res) => {
  res.status(201).json(await seedDemoData('sales'));
}));

demoRouter.post('/demo/seed/repairs', asyncHandler(async (_req, res) => {
  res.status(201).json(await seedDemoData('repairs'));
}));

demoRouter.post('/demo/erase', asyncHandler(async (_req, res) => {
  res.status(200).json(await eraseAllDataExceptEmployees());
}));
