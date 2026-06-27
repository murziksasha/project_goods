import { Router } from 'express';
import {
  getSettings,
  updatePrintForms,
  updateSettings,
} from '../domain/settings/service';
import { getBearerToken, requireOwnerByToken } from '../domain/auth/service';
import type { SettingsPayload } from '../domain/shared/types';
import { asyncHandler, requireAnyPermission } from '../shared/lib/http';

export const settingsRouter = Router();

const requirePrintFormsPermission = (req: Parameters<typeof requireAnyPermission>[0]) =>
  requireAnyPermission(
    req,
    ['printForms.manage'],
    'Only owners or employees with printForms.manage permission can manage print forms.',
  );

settingsRouter.get('/settings', asyncHandler(async (_req, res) => {
  res.json(await getSettings());
}));

settingsRouter.put('/settings', asyncHandler(async (req, res) => {
  await requireOwnerByToken(getBearerToken(req.headers.authorization));
  res.json(await updateSettings(req.body as SettingsPayload));
}));

settingsRouter.put('/settings/print-forms', asyncHandler(async (req, res) => {
  await requirePrintFormsPermission(req);
  const body = req.body as Pick<SettingsPayload, 'printForms'>;
  res.json(await updatePrintForms(body.printForms));
}));
