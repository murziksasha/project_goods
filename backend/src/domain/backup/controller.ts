import type { Request, Response } from 'express';
import {
  createManualBackup,
  deleteBackup as deleteBackupService,
  getBackupArchive,
  listBackups,
  restoreBackup as restoreBackupService,
  restoreBackupFromUploadedArchive,
} from './service';
import { getDatabaseHealth } from '../system/db-health';
import { getDatabaseStorageStats } from '../system/db-stats';
import { requirePermission, routeParam } from '../../shared/lib/http';

export const requireBackupPermission = (req: Parameters<typeof requirePermission>[0]) =>
  requirePermission(
    req,
    'system.backups.manage',
    'Only employees with system.backups.manage permission can manage backups.',
  );

export const list = async (req: Request, res: Response): Promise<void> => {
  await requireBackupPermission(req);
  res.json(await listBackups());
};

export const getDbStats = async (req: Request, res: Response): Promise<void> => {
  await requireBackupPermission(req);
  res.json(await getDatabaseStorageStats());
};

export const getDbHealth = async (req: Request, res: Response): Promise<void> => {
  await requireBackupPermission(req);
  res.json(await getDatabaseHealth());
};

export const create = async (req: Request, res: Response): Promise<void> => {
  const employee = await requireBackupPermission(req);
  res.status(201).json(await createManualBackup(employee.name));
};

export const download = async (req: Request, res: Response): Promise<void> => {
  await requireBackupPermission(req);
  const archive = await getBackupArchive(routeParam(req, 'backupId'));
  res.download(archive.path, archive.fileName);
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  await requireBackupPermission(req);
  res.json(await deleteBackupService(routeParam(req, 'backupId')));
};

export const restore = async (req: Request, res: Response): Promise<void> => {
  const employee = await requireBackupPermission(req);
  res.json(
    await restoreBackupService(
      routeParam(req, 'backupId'),
      (req.body as { confirmation?: unknown }).confirmation,
      employee.name,
    ),
  );
};

export const restoreFromFile = async (req: Request, res: Response): Promise<void> => {
  const employee = await requireBackupPermission(req);
  res.json(
    await restoreBackupFromUploadedArchive(
      Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
      String(req.headers['x-backup-filename'] ?? ''),
      req.headers['x-restore-confirmation'],
      employee.name,
    ),
  );
};

