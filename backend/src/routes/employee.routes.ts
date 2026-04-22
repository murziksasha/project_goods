import { Router } from 'express';
import {
  createEmployee,
  deleteEmployee,
  listEmployees,
  updateEmployee,
} from '../domain/employee/service';
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
    res.status(201).json(await createEmployee(req.body as EmployeePayload));
  } catch (error) {
    next(error);
  }
});

employeeRouter.put('/employees/:employeeId', async (req, res, next) => {
  try {
    res.json(await updateEmployee(req.params.employeeId, req.body as EmployeePayload));
  } catch (error) {
    next(error);
  }
});

employeeRouter.delete('/employees/:employeeId', async (req, res, next) => {
  try {
    res.json(await deleteEmployee(req.params.employeeId));
  } catch (error) {
    next(error);
  }
});
