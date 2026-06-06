import type { NextFunction, Request, RequestHandler, Response } from 'express';
import {
  getBearerToken,
  requireAnyPermissionByToken,
  requirePermissionByToken,
} from '../../domain/auth/service';
import type { EmployeePermission } from '../../domain/employee/constants';

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

export const requirePermission = (
  req: Request,
  permission: EmployeePermission,
  message?: string,
) =>
  requirePermissionByToken(
    getBearerToken(req.headers.authorization),
    permission,
    message,
  );

export const requireAnyPermission = (
  req: Request,
  permissions: readonly EmployeePermission[],
  message?: string,
) =>
  requireAnyPermissionByToken(
    getBearerToken(req.headers.authorization),
    permissions,
    message,
  );
