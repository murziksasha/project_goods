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

export const hasStoredEmployeePermission = (
  employee: Employee | null | undefined,
  permission: EmployeePermission,
) =>
  employee?.role === 'owner' ||
  Boolean(employee?.permissions.includes(permission));

export const hasAnyStoredEmployeePermission = (
  employee: Employee | null | undefined,
  permissions: readonly EmployeePermission[],
) =>
  employee?.role === 'owner' ||
  permissions.some((permission) =>
    Boolean(employee?.permissions.includes(permission)),
  );

const orderWorkspacePermissions = [
  'orders.view',
  'orders.manage',
  'repairs.execute',
  'sales.manage',
] as const;

export const isKanbanOnlyEmployee = (
  employee: Employee | null | undefined,
) =>
  Boolean(employee) &&
  employee?.role !== 'owner' &&
  hasStoredEmployeePermission(employee, 'kanban.use') &&
  !hasAnyStoredEmployeePermission(employee, orderWorkspacePermissions);
