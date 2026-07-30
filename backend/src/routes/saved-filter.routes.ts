import { Router } from 'express';
import {
  createSavedFilter,
  deleteSavedFilter,
  listSavedFilters,
} from '../domain/saved-filter/service';
import { asyncHandler, routeParam } from '../shared/lib/http';
import { HttpError } from '../shared/lib/errors';

export const savedFilterRouter = Router();

const requireCurrentEmployeeId = (req: {
  employee?: { _id?: { toString: () => string } } | null;
}) => {
  const id = req.employee?._id?.toString();
  if (!id) {
    throw new HttpError(401, 'Authentication required.');
  }
  return id;
};

savedFilterRouter.get(
  '/saved-filters',
  asyncHandler(async (req, res) => {
    const employeeId = requireCurrentEmployeeId(req);
    res.json(await listSavedFilters(employeeId, req.query.scope));
  }),
);

savedFilterRouter.post(
  '/saved-filters',
  asyncHandler(async (req, res) => {
    const employeeId = requireCurrentEmployeeId(req);
    res.status(201).json(await createSavedFilter(employeeId, req.body ?? {}));
  }),
);

savedFilterRouter.delete(
  '/saved-filters/:filterId',
  asyncHandler(async (req, res) => {
    const employeeId = requireCurrentEmployeeId(req);
    res.json(
      await deleteSavedFilter(employeeId, routeParam(req, 'filterId')),
    );
  }),
);
