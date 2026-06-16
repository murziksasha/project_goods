import express, { Router } from 'express';
import { env } from '../config/env';
import {
  createManualBackup,
  deleteBackup,
  getBackupArchive,
  listBackups,
  restoreBackup,
  restoreBackupFromUploadedArchive,
} from '../domain/backup/service';
import { asyncHandler, requirePermission, routeParam } from '../shared/lib/http';

export const backupRouter = Router();

const requireBackupPermission = (req: Parameters<typeof requirePermission>[0]) =>
  requirePermission(
    req,
    'system.backups.manage',
    'Only employees with system.backups.manage permission can manage backups.',
  );

backupRouter.get('/backups', asyncHandler(async (req, res) => {
  await requireBackupPermission(req);
  res.json(await listBackups());
}));

backupRouter.post('/backups', asyncHandler(async (req, res) => {
  const employee = await requireBackupPermission(req);
  res.status(201).json(await createManualBackup(employee.name));
}));

backupRouter.get('/backups/:backupId/download', asyncHandler(async (req, res) => {
  await requireBackupPermission(req);
  const archive = await getBackupArchive(routeParam(req, 'backupId'));

  res.download(archive.path, archive.fileName);
}));

backupRouter.delete('/backups/:backupId', asyncHandler(async (req, res) => {
  await requireBackupPermission(req);
  res.json(await deleteBackup(routeParam(req, 'backupId')));
}));

backupRouter.post('/backups/:backupId/restore', asyncHandler(async (req, res) => {
  const employee = await requireBackupPermission(req);
  res.json(
    await restoreBackup(
      routeParam(req, 'backupId'),
      (req.body as { confirmation?: unknown }).confirmation,
      employee.name,
    ),
  );
}));

backupRouter.post(
  '/backups/restore-file',
  express.raw({
    limit: env.backupRestoreUploadLimit,
    type: ['application/gzip', 'application/octet-stream'],
  }),
  asyncHandler(async (req, res) => {
    const employee = await requireBackupPermission(req);
    res.json(
      await restoreBackupFromUploadedArchive(
        Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
        String(req.headers['x-backup-filename'] ?? ''),
        req.headers['x-restore-confirmation'],
        employee.name,
      ),
    );
  }),
);
