import type { Employee, EmployeePermission } from './types';

export const hasEmployeePermission = (
  employee: Employee | null | undefined,
  permission: EmployeePermission,
) =>
  employee?.role === 'owner' ||
  Boolean(employee?.permissions.includes(permission));

export const hasAnyEmployeePermission = (
  employee: Employee | null | undefined,
  permissions: readonly EmployeePermission[],
) =>
  employee?.role === 'owner' ||
  permissions.some((permission) => employee?.permissions.includes(permission));
