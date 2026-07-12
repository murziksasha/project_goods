import { Router } from 'express';
import {
  eraseAllDataExceptEmployees,
  seedDemoData,
} from '../domain/demo/service';
import { createSafetyBackup } from '../domain/backup/service';
import { getBearerToken, getEmployeeByToken } from '../domain/auth/service';
import { HttpError } from '../shared/lib/errors';
import { asyncHandler, requireDevEnvironment, requireOwner } from '../shared/lib/http';

export const demoRouter = Router();

const requireTemporaryAdmin = async (req: Parameters<typeof getBearerToken>[0]) => {
  const employee = await getEmployeeByToken(getBearerToken(req));
  if (employee.role !== 'owner' || employee.username !== 'admin') {
    throw new HttpError(403, 'Only Temporary Admin can erase all data.');
  }

  return employee;
};

const eraseWithSafetyBackup = async (employeeName: string) => {
  const safetyBackup = await createSafetyBackup(employeeName);
  if (safetyBackup.status !== 'completed') {
    throw new HttpError(500, 'Safety backup failed. Data erase was not started.');
  }

  return {
    ...(await eraseAllDataExceptEmployees()),
    safetyBackupId: safetyBackup.id,
  };
};

demoRouter.post('/demo/seed', asyncHandler(async (req, res) => {
  requireDevEnvironment();

  if (req.query.kind === 'erase') {
    const employee = await requireTemporaryAdmin(req.headers.authorization);
    res.status(200).json(await eraseWithSafetyBackup(employee.name));
    return;
  }

  await requireOwner(req);
  res.status(201).json(await seedDemoData(req.query.kind));
}));

demoRouter.post('/demo/seed/sales', asyncHandler(async (req, res) => {
  requireDevEnvironment();
  await requireOwner(req);
  res.status(201).json(await seedDemoData('sales'));
}));

demoRouter.post('/demo/seed/repairs', asyncHandler(async (req, res) => {
  requireDevEnvironment();
  await requireOwner(req);
  res.status(201).json(await seedDemoData('repairs'));
}));

demoRouter.post('/demo/erase', asyncHandler(async (req, res) => {
  requireDevEnvironment();
  const employee = await requireTemporaryAdmin(req.headers.authorization);
  res.status(200).json(await eraseWithSafetyBackup(employee.name));
}));