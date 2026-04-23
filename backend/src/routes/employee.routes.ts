import { Router } from 'express';
import {
  createEmployee,
  deleteEmployee,
  listEmployees,
  updateEmployee,
} from '../domain/employee/service';
import { requireOwnerByToken } from '../domain/auth/service';
import { HttpError } from '../shared/lib/errors';
import type { EmployeePayload } from '../domain/shared/types';

const getBearerToken = (authorizationHeader: unknown) => {
  const headerValue = typeof authorizationHeader === 'string' ? authorizationHeader : '';
  return headerValue.startsWith('Bearer ') ? headerValue.slice(7).trim() : '';
};

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
    await requireOwnerByToken(getBearerToken(req.headers.authorization));
    res.status(201).json(await createEmployee(req.body as EmployeePayload));
  } catch (error) {
    next(error);
  }
});

employeeRouter.put('/employees/:employeeId', async (req, res, next) => {
  try {
    await requireOwnerByToken(getBearerToken(req.headers.authorization));
    res.json(await updateEmployee(req.params.employeeId, req.body as EmployeePayload));
  } catch (error) {
    next(error);
  }
});

employeeRouter.delete('/employees/:employeeId', async (req, res, next) => {
  try {
    const currentEmployee = await requireOwnerByToken(getBearerToken(req.headers.authorization));
    if (currentEmployee._id.toString() === req.params.employeeId) {
      throw new HttpError(400, 'You cannot delete your own account.');
    }
    res.json(await deleteEmployee(req.params.employeeId));
  } catch (error) {
    next(error);
  }
});
