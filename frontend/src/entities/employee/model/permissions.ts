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

  // kanban.use, finance.orders.pay, and finance.sales.pay are toggleable grants.
  // Role defaults seed them only when the stored list is empty so unchecking them actually revokes access.
  return Array.from(
    new Set([
      ...employee.permissions,
      ...defaults.filter(
        (permission) =>
          permission !== 'kanban.use' &&
          permission !== 'finance.orders.pay' &&
          permission !== 'finance.sales.pay',
      ),
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
