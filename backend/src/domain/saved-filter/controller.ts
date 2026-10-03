import type { Request, Response } from 'express';
import {
  createSavedFilter,
  deleteSavedFilter,
  listSavedFilters,
} from './service';
import { HttpError } from '../../shared/lib/errors';
import { routeParam } from '../../shared/lib/http';

export const requireCurrentEmployeeId = (req: {
  employee?: { _id?: { toString: () => string } } | null;
}) => {
  const id = req.employee?._id?.toString();
  if (!id) {
    throw new HttpError(401, 'Authentication required.');
  }
  return id;
};

export const list = async (req: Request, res: Response): Promise<void> => {
  const employeeId = requireCurrentEmployeeId(req);
  res.json(await listSavedFilters(employeeId, req.query.scope));
};

export const create = async (req: Request, res: Response): Promise<void> => {
  const employeeId = requireCurrentEmployeeId(req);
  res.status(201).json(await createSavedFilter(employeeId, req.body ?? {}));
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  const employeeId = requireCurrentEmployeeId(req);
  res.json(await deleteSavedFilter(employeeId, routeParam(req, 'filterId')));
};

