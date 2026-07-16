import {
  defaultEmployeePermissionsByRole,
  employeePermissions,
  employeeRoles,
  type EmployeePermission,
  type EmployeeRole,
} from '../../../domain/employee/constants';
import type { EmployeePayload } from '../../../domain/shared/types';
import { normalizeEmail, normalizePhone, toNonEmptyString } from './primitives';

export const normalizeEmployeePayload = (payload: EmployeePayload) => {
  const roleRaw = String(payload.role ?? '');
  const role = employeeRoles.includes(roleRaw as EmployeeRole)
    ? (roleRaw as EmployeeRole)
    : 'manager';
  const parsedPermissions = Array.isArray(payload.permissions)
    ? payload.permissions
        .map((value) => String(value))
        .filter((value): value is EmployeePermission =>
          employeePermissions.includes(value as EmployeePermission),
        )
    : String(payload.permissions ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter((value): value is EmployeePermission =>
          employeePermissions.includes(value as EmployeePermission),
        );

  const normalizedPermissions =
    parsedPermissions.length > 0
      ? Array.from(new Set(parsedPermissions))
      : defaultEmployeePermissionsByRole[role];
  const permissions =
    role === 'owner' && !normalizedPermissions.includes('employees.manage')
      ? [...normalizedPermissions, 'employees.manage']
      : normalizedPermissions;

  return {
    name: toNonEmptyString(payload.name),
    phone: normalizePhone(payload.phone),
    email: normalizeEmail(payload.email),
    username: toNonEmptyString(payload.username).toLowerCase(),
    password: toNonEmptyString(payload.password),
    role,
    permissions,
    isActive:
      payload.isActive === undefined
        ? true
        : payload.isActive === true || String(payload.isActive).toLowerCase() === 'true',
    note: toNonEmptyString(payload.note),
  };
};
