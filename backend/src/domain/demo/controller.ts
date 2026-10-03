import type { Request, Response } from 'express';
import {
  eraseAllDataExceptEmployees,
  seedDemoData,
} from './service';
import { createSafetyBackup } from '../backup/service';
import { HttpError } from '../../shared/lib/errors';
import { requireDevEnvironment, requireOwner } from '../../shared/lib/http';

export const requireTemporaryAdmin = async (req: Request) => {
  const employee = req.employee;
  if (!employee) {
    throw new HttpError(401, 'Authorization token is required.');
  }
  if (employee.role !== 'owner' || employee.username !== 'admin') {
    throw new HttpError(403, 'Only Temporary Admin can erase all data.');
  }

  return employee;
};

export const eraseWithSafetyBackup = async (employeeName: string) => {
  const safetyBackup = await createSafetyBackup(employeeName);
  if (safetyBackup.status !== 'completed') {
    throw new HttpError(500, 'Safety backup failed. Data erase was not started.');
  }

  return {
    ...(await eraseAllDataExceptEmployees()),
    safetyBackupId: safetyBackup.id,
  };
};

export const seed = async (req: Request, res: Response): Promise<void> => {
  requireDevEnvironment();

  if (req.query.kind === 'erase') {
    const employee = await requireTemporaryAdmin(req);
    res.status(200).json(await eraseWithSafetyBackup(employee.name));
    return;
  }

  await requireOwner(req);
  res.status(201).json(await seedDemoData(req.query.kind));
};

export const seedSales = async (req: Request, res: Response): Promise<void> => {
  requireDevEnvironment();
  await requireOwner(req);
  res.status(201).json(await seedDemoData('sales'));
};

export const seedRepairs = async (req: Request, res: Response): Promise<void> => {
  requireDevEnvironment();
  await requireOwner(req);
  res.status(201).json(await seedDemoData('repairs'));
};

export const erase = async (req: Request, res: Response): Promise<void> => {
  requireDevEnvironment();
  const employee = await requireTemporaryAdmin(req);
  res.status(200).json(await eraseWithSafetyBackup(employee.name));
};

