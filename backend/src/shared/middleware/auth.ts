import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { getBearerToken, getEmployeeByToken } from '../../domain/auth/service';

const PUBLIC_ROUTE_MATCHERS: Array<{ method: string; pattern: RegExp }> = [
  { method: 'GET', pattern: /^\/health$/ },
  { method: 'POST', pattern: /^\/auth\/login$/ },
  { method: 'GET', pattern: /^\/auth\/invitations\/[^/]+$/ },
  { method: 'POST', pattern: /^\/auth\/invitations\/[^/]+\/register$/ },
];

export const isPublicApiRoute = (req: Request) =>
  PUBLIC_ROUTE_MATCHERS.some(
    ({ method, pattern }) => req.method === method && pattern.test(req.path),
  );

export const requireAuthUnlessPublic: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (isPublicApiRoute(req)) {
    next();
    return;
  }

  try {
    req.employee = await getEmployeeByToken(getBearerToken(req.headers.authorization));
    next();
  } catch (error) {
    next(error);
  }
};