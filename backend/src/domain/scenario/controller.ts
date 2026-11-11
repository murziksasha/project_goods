import type { Request, Response } from 'express';
import { HttpError } from '../../shared/lib/errors';
import { routeParam } from '../../shared/lib/http';
import { employeeHasPermission } from '../auth/service';
import type { EmployeeDocument } from '../employee/model';
import { scenarioDomains, type ScenarioDomain } from './model';
import {
  createScenario,
  deleteScenario,
  listScenarios,
  updateScenario,
} from './service';

const requireAuthenticatedEmployee = (req: Request) => {
  const employee = req.employee as
    | (Pick<EmployeeDocument, '_id' | 'role' | 'permissions'> & {
        _id: { toString: () => string };
      })
    | undefined;
  if (!employee?._id?.toString()) {
    throw new HttpError(401, 'Authentication required.');
  }
  return employee;
};

export const resolveAllowedScenarioDomains = (
  employee: Pick<EmployeeDocument, 'role' | 'permissions'>,
): ScenarioDomain[] => {
  const allowed: ScenarioDomain[] = [];
  if (employeeHasPermission(employee, 'inventory.manage')) {
    allowed.push('warehouse');
  }
  if (employeeHasPermission(employee, 'finance.view')) {
    allowed.push('cashflow');
  }
  return allowed;
};

const assertDomainPermission = (
  employee: Pick<EmployeeDocument, 'role' | 'permissions'>,
  domainRaw: unknown,
) => {
  const normalized = String(domainRaw ?? '').trim().toLowerCase();
  if (!scenarioDomains.includes(normalized as ScenarioDomain)) {
    throw new HttpError(400, 'Scenario domain must be "warehouse" or "cashflow".');
  }
  if (normalized === 'warehouse' && !employeeHasPermission(employee, 'inventory.manage')) {
    throw new HttpError(403, 'Warehouse scenarios require inventory.manage permission.');
  }
  if (normalized === 'cashflow' && !employeeHasPermission(employee, 'finance.view')) {
    throw new HttpError(403, 'Cashflow scenarios require finance.view permission.');
  }
};

export const list = async (req: Request, res: Response): Promise<void> => {
  const employee = requireAuthenticatedEmployee(req);
  const allowedDomains = resolveAllowedScenarioDomains(employee);
  res.json(
    await listScenarios(
      employee._id.toString(),
      allowedDomains,
      req.query.domain,
    ),
  );
};

export const create = async (req: Request, res: Response): Promise<void> => {
  const employee = requireAuthenticatedEmployee(req);
  const payload = (req.body ?? {}) as Record<string, unknown>;
  assertDomainPermission(employee, payload.domain);
  res.status(201).json(await createScenario(employee._id.toString(), payload));
};

export const update = async (req: Request, res: Response): Promise<void> => {
  const employee = requireAuthenticatedEmployee(req);
  const allowedDomains = resolveAllowedScenarioDomains(employee);
  res.json(
    await updateScenario(
      employee._id.toString(),
      routeParam(req, 'scenarioId'),
      (req.body ?? {}) as Record<string, unknown>,
      allowedDomains,
    ),
  );
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  const employee = requireAuthenticatedEmployee(req);
  const allowedDomains = resolveAllowedScenarioDomains(employee);
  res.json(
    await deleteScenario(
      employee._id.toString(),
      routeParam(req, 'scenarioId'),
      allowedDomains,
    ),
  );
};
