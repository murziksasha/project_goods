import { Router } from 'express';
import { getSettings, updateSettings } from '../domain/settings/service';
import { getBearerToken, requireOwnerByToken } from '../domain/auth/service';
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
    await requireOwnerByToken(getBearerToken(req.headers.authorization));
    res.json(await updateSettings(req.body as SettingsPayload));
  } catch (error) {
    next(error);
  }
});
