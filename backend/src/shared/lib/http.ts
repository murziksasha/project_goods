import type { NextFunction, Request, RequestHandler, Response } from 'express';
import {
  employeeHasAnyPermission,
  employeeHasPermission,
  getBearerToken,
  getEmployeeByToken,
} from '../../domain/auth/service';
import type { EmployeePermission } from '../../domain/employee/constants';
import { HttpError } from './errors';

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

export const asyncHandler =
  (handler: AsyncRequestHandler): RequestHandler =>
  (req, res, next) => {
    void handler(req, res, next).catch(next);
  };

export const routeParam = (req: Request, name: string) => {
  const value = req.params[name];
  return typeof value === 'string' ? value : '';
};

const resolveRequestEmployee = async (req: Request) => {
  if (req.employee) {
    return req.employee;
  }

  return getEmployeeByToken(getBearerToken(req.headers.authorization));
};

export const requirePermission = async (
  req: Request,
  permission: EmployeePermission,
  message = 'Current employee does not have required permission.',
) => {
  const employee = await resolveRequestEmployee(req);
  if (!employeeHasPermission(employee, permission)) {
    throw new HttpError(403, message);
  }

  return employee;
};

export const requireAnyPermission = async (
  req: Request,
  permissions: readonly EmployeePermission[],
  message = 'Current employee does not have required permission.',
) => {
  const employee = await resolveRequestEmployee(req);
  if (!employeeHasAnyPermission(employee, permissions)) {
    throw new HttpError(403, message);
  }

  return employee;
};

export const requireOwner = async (req: Request) => {
  const employee = await resolveRequestEmployee(req);
  if (employee.role !== 'owner') {
    throw new HttpError(403, 'Only owners can manage employees.');
  }

  return employee;
};

export const requireDevEnvironment = () => {
  if (process.env.NODE_ENV === 'production') {
    throw new HttpError(403, 'This endpoint is disabled in production.');
  }
};
