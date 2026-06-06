import { Router } from 'express';
import {
  createEmployee,
  deleteEmployee,
  listEmployees,
  updateEmployee,
} from '../domain/employee/service';
import { HttpError } from '../shared/lib/errors';
import type { EmployeePayload } from '../domain/shared/types';
import { asyncHandler, requireAnyPermission, routeParam } from '../shared/lib/http';

export const employeeRouter = Router();

employeeRouter.get('/employees', asyncHandler(async (req, res) => {
  res.json(await listEmployees(req.query.query, req.query.role));
}));

employeeRouter.post('/employees', asyncHandler(async (req, res) => {
  const currentEmployee = await requireAnyPermission(
    req,
    ['employees.manage'],
    'Only employees with employees.manage permission can manage employees.',
  );
  res.status(201).json(await createEmployee(req.body as EmployeePayload, currentEmployee));
}));

employeeRouter.put('/employees/:employeeId', asyncHandler(async (req, res) => {
  const currentEmployee = await requireAnyPermission(
    req,
    ['employees.manage'],
    'Only employees with employees.manage permission can manage employees.',
  );
  res.json(await updateEmployee(routeParam(req, 'employeeId'), req.body as EmployeePayload, currentEmployee));
}));

employeeRouter.delete('/employees/:employeeId', asyncHandler(async (req, res) => {
  const currentEmployee = await requireAnyPermission(
    req,
    ['employees.manage'],
    'Only employees with employees.manage permission can manage employees.',
  );
  if (currentEmployee._id.toString() === routeParam(req, 'employeeId')) {
    throw new HttpError(400, 'You cannot delete your own account.');
  }
  res.json(await deleteEmployee(routeParam(req, 'employeeId'), currentEmployee));
}));
