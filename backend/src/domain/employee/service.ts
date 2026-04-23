import { employeeRoles, type EmployeeRole } from './constants';
import { Employee, type EmployeeDocument } from './model';
import { hashPassword } from '../../shared/lib/auth';
import { formatEmployee } from '../../shared/lib/formatters';
import { normalizeEmployeePayload } from '../../shared/lib/parsers';
import { HttpError } from '../../shared/lib/errors';
import { getSearchQuery, isValidObjectIdOrThrow } from '../../shared/lib/query';
import type { EmployeePayload } from '../shared/types';

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

export const createEmployee = async (payload: EmployeePayload) => {
  const normalizedPayload = normalizeEmployeePayload(payload);
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

export const updateEmployee = async (employeeId: string, payload: EmployeePayload) => {
  isValidObjectIdOrThrow(employeeId, 'employeeId');

  const normalizedPayload = normalizeEmployeePayload(payload);
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
    { new: true, runValidators: true },
  ).lean<EmployeeDocument | null>();

  if (!employee) {
    throw new HttpError(404, 'Employee not found.');
  }

  return formatEmployee(employee);
};

export const deleteEmployee = async (employeeId: string) => {
  isValidObjectIdOrThrow(employeeId, 'employeeId');

  const deletedEmployee = await Employee.findByIdAndDelete(employeeId).lean<EmployeeDocument | null>();
  if (!deletedEmployee) {
    throw new HttpError(404, 'Employee not found.');
  }

  return { id: employeeId };
};
