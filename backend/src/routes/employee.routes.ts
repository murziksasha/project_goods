import { Router } from 'express';
import {
  createEmployee,
  deleteEmployee,
  listEmployees,
  updateEmployee,
} from '../domain/employee/service';
import {
  getBearerToken,
  requireAnyPermissionByToken,
} from '../domain/auth/service';
import { HttpError } from '../shared/lib/errors';
import type { EmployeePayload } from '../domain/shared/types';

export const employeeRouter = Router();

employeeRouter.get('/employees', async (req, res, next) => {
  try {
    res.json(await listEmployees(req.query.query, req.query.role));
  } catch (error) {
    next(error);
  }
});

employeeRouter.post('/employees', async (req, res, next) => {
  try {
    const currentEmployee = await requireAnyPermissionByToken(
      getBearerToken(req.headers.authorization),
      ['employees.manage'],
      'Only employees with employees.manage permission can manage employees.',
    );
    res.status(201).json(await createEmployee(req.body as EmployeePayload, currentEmployee));
  } catch (error) {
    next(error);
  }
});

employeeRouter.put('/employees/:employeeId', async (req, res, next) => {
  try {
    const currentEmployee = await requireAnyPermissionByToken(
      getBearerToken(req.headers.authorization),
      ['employees.manage'],
      'Only employees with employees.manage permission can manage employees.',
    );
    res.json(await updateEmployee(req.params.employeeId, req.body as EmployeePayload, currentEmployee));
  } catch (error) {
    next(error);
  }
});

employeeRouter.delete('/employees/:employeeId', async (req, res, next) => {
  try {
    const currentEmployee = await requireAnyPermissionByToken(
      getBearerToken(req.headers.authorization),
      ['employees.manage'],
      'Only employees with employees.manage permission can manage employees.',
    );
    if (currentEmployee._id.toString() === req.params.employeeId) {
      throw new HttpError(400, 'You cannot delete your own account.');
    }
    res.json(await deleteEmployee(req.params.employeeId, currentEmployee));
  } catch (error) {
    next(error);
  }
});
