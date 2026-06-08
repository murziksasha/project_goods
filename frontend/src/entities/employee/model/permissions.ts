import {
  defaultEmployeePermissionsByRole,
  type Employee,
  type EmployeePermission,
} from './types';

export const getEffectiveEmployeePermissions = (
  employee: Employee | null | undefined,
) => {
  if (!employee) return [];
  if (employee.role === 'owner') {
    return defaultEmployeePermissionsByRole.owner;
  }
  if (employee.role !== 'manager') {
    return employee.permissions;
  }

  return Array.from(
    new Set([
      ...employee.permissions,
      ...defaultEmployeePermissionsByRole[employee.role],
    ]),
  );
};

export const hasEmployeePermission = (
  employee: Employee | null | undefined,
  permission: EmployeePermission,
) =>
  employee?.role === 'owner' ||
  getEffectiveEmployeePermissions(employee).includes(permission);

export const hasAnyEmployeePermission = (
  employee: Employee | null | undefined,
  permissions: readonly EmployeePermission[],
) =>
  employee?.role === 'owner' ||
  permissions.some((permission) =>
    getEffectiveEmployeePermissions(employee).includes(permission),
  );
