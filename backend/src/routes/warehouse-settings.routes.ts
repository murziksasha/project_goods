import { Router } from 'express';
import {
  getWarehouseSettings,
  updateWarehouseSettings,
} from '../domain/warehouse-settings/service';
import type { WarehouseSettingsPayload } from '../domain/shared/types';
import { asyncHandler, requirePermission } from '../shared/lib/http';

export const warehouseSettingsRouter = Router();

warehouseSettingsRouter.get('/warehouse-settings', asyncHandler(async (_req, res) => {
  res.json(await getWarehouseSettings());
}));

warehouseSettingsRouter.put('/warehouse-settings', asyncHandler(async (req, res) => {
  await requirePermission(req, 'inventory.manage');
  res.json(
    await updateWarehouseSettings(req.body as WarehouseSettingsPayload),
  );
}));