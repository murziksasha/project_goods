import { Router } from 'express';
import { getSettings, updateSettings } from '../domain/settings/service';
import type { SettingsPayload } from '../domain/shared/types';

export const settingsRouter = Router();

settingsRouter.get('/settings', async (_req, res, next) => {
  try {
    res.json(await getSettings());
  } catch (error) {
    next(error);
  }
});

settingsRouter.put('/settings', async (req, res, next) => {
  try {
    res.json(await updateSettings(req.body as SettingsPayload));
  } catch (error) {
    next(error);
  }
});
