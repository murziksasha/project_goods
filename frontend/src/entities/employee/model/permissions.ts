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

  const defaults = defaultEmployeePermissionsByRole[employee.role];
  if (employee.permissions.length === 0) {
    return [...defaults];
  }

  // kanban.use is a toggleable grant. Role defaults seed it only when the
  // stored list is empty so unchecking it actually revokes access.
  return Array.from(
    new Set([
      ...employee.permissions,
      ...defaults.filter((permission) => permission !== 'kanban.use'),
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
