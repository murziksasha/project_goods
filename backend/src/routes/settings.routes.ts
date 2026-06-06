import { Router } from 'express';
import { getSettings, updateSettings } from '../domain/settings/service';
import { getBearerToken, requireOwnerByToken } from '../domain/auth/service';
import type { SettingsPayload } from '../domain/shared/types';
import { asyncHandler } from '../shared/lib/http';

export const settingsRouter = Router();

settingsRouter.get('/settings', asyncHandler(async (_req, res) => {
  res.json(await getSettings());
}));

settingsRouter.put('/settings', asyncHandler(async (req, res) => {
  await requireOwnerByToken(getBearerToken(req.headers.authorization));
  res.json(await updateSettings(req.body as SettingsPayload));
}));
