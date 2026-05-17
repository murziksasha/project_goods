import { Router } from 'express';
import {
  getWarehouseSettings,
  updateWarehouseSettings,
} from '../domain/warehouse-settings/service';
import type { WarehouseSettingsPayload } from '../domain/shared/types';

export const warehouseSettingsRouter = Router();

warehouseSettingsRouter.get('/warehouse-settings', async (_req, res, next) => {
  try {
    res.json(await getWarehouseSettings());
  } catch (error) {
    next(error);
  }
});

warehouseSettingsRouter.put('/warehouse-settings', async (req, res, next) => {
  try {
    res.json(
      await updateWarehouseSettings(req.body as WarehouseSettingsPayload),
    );
  } catch (error) {
    next(error);
  }
});
