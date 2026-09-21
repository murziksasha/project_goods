import type { Request, Response } from 'express';
import {
  createEmployee,
  deleteEmployee,
  listEmployees,
  updateEmployee,
} from './service';
import { HttpError } from '../../shared/lib/errors';
import type { EmployeePayload } from '../shared/types';
import { requireAnyPermission, routeParam } from '../../shared/lib/http';

const requireEmployeeManagePermission = (req: Request) =>
  requireAnyPermission(
    req,
    ['employees.manage'],
    'Only employees with employees.manage permission can manage employees.',
  );

export const list = async (req: Request, res: Response): Promise<void> => {
  res.json(await listEmployees(req.query.query, req.query.role));
};

export const create = async (req: Request, res: Response): Promise<void> => {
  const currentEmployee = await requireEmployeeManagePermission(req);
  res.status(201).json(await createEmployee(req.body as EmployeePayload, currentEmployee));
};

export const update = async (req: Request, res: Response): Promise<void> => {
  const currentEmployee = await requireEmployeeManagePermission(req);
  res.json(await updateEmployee(routeParam(req, 'employeeId'), req.body as EmployeePayload, currentEmployee));
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  const currentEmployee = await requireEmployeeManagePermission(req);
  if (currentEmployee._id.toString() === routeParam(req, 'employeeId')) {
    throw new HttpError(400, 'You cannot delete your own account.');
  }
  res.json(await deleteEmployee(routeParam(req, 'employeeId'), currentEmployee));
};

