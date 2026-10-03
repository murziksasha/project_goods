import type { Request, Response } from 'express';
import {
  getWarehouseSettings,
  updateWarehouseSettings,
} from './service';
import type { WarehouseSettingsPayload } from '../shared/types';
import { requirePermission } from '../../shared/lib/http';

export const get = async (_req: Request, res: Response): Promise<void> => {
  res.json(await getWarehouseSettings());
};

export const update = async (req: Request, res: Response): Promise<void> => {
  await requirePermission(req, 'inventory.manage');
  res.json(await updateWarehouseSettings(req.body as WarehouseSettingsPayload));
};

