import express, { Router } from 'express';
import { env } from '../../config/env';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const backupRouter = Router();

backupRouter.get('/backups', asyncHandler(controller.list));
backupRouter.get('/system/db-stats', asyncHandler(controller.getDbStats));
backupRouter.get('/system/db-health', asyncHandler(controller.getDbHealth));
backupRouter.post('/backups', asyncHandler(controller.create));
backupRouter.get('/backups/:backupId/download', asyncHandler(controller.download));
backupRouter.delete('/backups/:backupId', asyncHandler(controller.remove));
backupRouter.post('/backups/:backupId/restore', asyncHandler(controller.restore));
backupRouter.post(
  '/backups/restore-file',
  express.raw({
    limit: env.backupRestoreUploadLimit,
    type: ['application/gzip', 'application/octet-stream'],
  }),
  asyncHandler(controller.restoreFromFile),
);

