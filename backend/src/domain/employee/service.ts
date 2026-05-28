import { employeeRoles, type EmployeeRole } from './constants';
import { Employee, type EmployeeDocument } from './model';
import { hashPassword } from '../../shared/lib/auth';
import { formatEmployee } from '../../shared/lib/formatters';
import { normalizeEmployeePayload } from '../../shared/lib/parsers';
import { HttpError } from '../../shared/lib/errors';
import { getSearchQuery, isValidObjectIdOrThrow } from '../../shared/lib/query';
import type { EmployeePayload } from '../shared/types';

type EmployeeActor = Pick<EmployeeDocument, '_id' | 'role' | 'permissions'>;

const ensureCanWriteEmployee = (
  actor: EmployeeActor,
  normalizedPayload: ReturnType<typeof normalizeEmployeePayload>,
  existingEmployee?: EmployeeDocument | null,
) => {
  if (actor.role === 'owner') {
    return;
  }

  if (existingEmployee?.role === 'owner' || normalizedPayload.role === 'owner') {
    throw new HttpError(403, 'Only owners can manage owner accounts.');
  }

  if (normalizedPayload.permissions.includes('employees.manage')) {
    throw new HttpError(403, 'Only owners can grant employees.manage permission.');
  }
};

export const listEmployees = async (queryValue: unknown, roleValue: unknown) => {
  const query = getSearchQuery(queryValue) as Record<string, unknown>;
  const role = typeof roleValue === 'string' ? roleValue : '';
  if (role && employeeRoles.includes(role as EmployeeRole)) {
    query.role = role;
  }

  const employees = await Employee.find(query)
    .sort({ isActive: -1, createdAt: -1 })
    .lean<EmployeeDocument[]>();

  return employees.map(formatEmployee);
};

export const createEmployee = async (payload: EmployeePayload, actor?: EmployeeActor) => {
  const normalizedPayload = normalizeEmployeePayload(payload);
  if (actor) {
    ensureCanWriteEmployee(actor, normalizedPayload);
  }
  if (!normalizedPayload.username) {
    throw new HttpError(400, 'Username is required.');
  }
  if (normalizedPayload.password.length < 3) {
    throw new HttpError(400, 'Password must contain at least 3 characters.');
  }

  const employee = new Employee({
    name: normalizedPayload.name,
    phone: normalizedPayload.phone,
    email: normalizedPayload.email || undefined,
    username: normalizedPayload.username,
    passwordHash: hashPassword(normalizedPayload.password),
    authToken: '',
    inviteToken: '',
    inviteExpiresAt: null,
    role: normalizedPayload.role,
    permissions: normalizedPayload.permissions,
    isActive: normalizedPayload.isActive,
    note: normalizedPayload.note,
  });

  await employee.validate();
  await employee.save();
  return formatEmployee(employee.toObject<EmployeeDocument>());
};

export const updateEmployee = async (
  employeeId: string,
  payload: EmployeePayload,
  actor?: EmployeeActor,
) => {
  isValidObjectIdOrThrow(employeeId, 'employeeId');

  const normalizedPayload = normalizeEmployeePayload(payload);
  const existingEmployee = actor
    ? await Employee.findById(employeeId).lean<EmployeeDocument | null>()
    : null;
  if (actor) {
    if (!existingEmployee) {
      throw new HttpError(404, 'Employee not found.');
    }
    ensureCanWriteEmployee(actor, normalizedPayload, existingEmployee);
  }
  if (!normalizedPayload.username) {
    throw new HttpError(400, 'Username is required.');
  }

  const updatePayload: Record<string, unknown> = {
    name: normalizedPayload.name,
    phone: normalizedPayload.phone,
    email: normalizedPayload.email || undefined,
    username: normalizedPayload.username,
    role: normalizedPayload.role,
    permissions: normalizedPayload.permissions,
    isActive: normalizedPayload.isActive,
    note: normalizedPayload.note,
  };

  if (normalizedPayload.password) {
    if (normalizedPayload.password.length < 3) {
      throw new HttpError(400, 'Password must contain at least 3 characters.');
    }
    updatePayload.passwordHash = hashPassword(normalizedPayload.password);
  }

  const employee = await Employee.findByIdAndUpdate(
    employeeId,
    updatePayload,
    { returnDocument: 'after', runValidators: true },
  ).lean<EmployeeDocument | null>();

  if (!employee) {
    throw new HttpError(404, 'Employee not found.');
  }

  return formatEmployee(employee);
};

export const deleteEmployee = async (employeeId: string, actor?: EmployeeActor) => {
  isValidObjectIdOrThrow(employeeId, 'employeeId');
  if (actor?.role !== 'owner') {
    const existingEmployee = await Employee.findById(employeeId).lean<EmployeeDocument | null>();
    if (!existingEmployee) {
      throw new HttpError(404, 'Employee not found.');
    }
    if (existingEmployee.role === 'owner') {
      throw new HttpError(403, 'Only owners can delete owner accounts.');
    }
  }

  const deletedEmployee = await Employee.findByIdAndDelete(employeeId).lean<EmployeeDocument | null>();
  if (!deletedEmployee) {
    throw new HttpError(404, 'Employee not found.');
  }

  return { id: employeeId };
};
