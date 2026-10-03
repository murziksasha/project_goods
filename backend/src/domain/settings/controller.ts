import type { Request, Response } from 'express';
import {
  getSettings,
  updatePrintForms as updatePrintFormsService,
  updateSettings as updateSettingsService,
} from './service';
import type { SettingsPayload } from '../shared/types';
import { requireAnyPermission, requireOwner } from '../../shared/lib/http';

export const requirePrintFormsPermission = (req: Parameters<typeof requireAnyPermission>[0]) =>
  requireAnyPermission(
    req,
    ['printForms.manage'],
    'Only owners or employees with printForms.manage permission can manage print forms.',
  );

export const get = async (_req: Request, res: Response): Promise<void> => {
  res.json(await getSettings());
};

export const update = async (req: Request, res: Response): Promise<void> => {
  await requireOwner(req);
  res.json(await updateSettingsService(req.body as SettingsPayload));
};

export const updatePrintForms = async (req: Request, res: Response): Promise<void> => {
  await requirePrintFormsPermission(req);
  const body = req.body as Pick<SettingsPayload, 'printForms'>;
  res.json(await updatePrintFormsService(body.printForms));
};

