export const employeeRoles = [
  'owner',
  'manager',
  'master',
  'accountant',
  'warehouse',
  'sales',
  'support',
] as const;

export type EmployeeRole = (typeof employeeRoles)[number];

export const employeePermissions = [
  'orders.view',
  'orders.manage',
  'repairs.execute',
  'sales.manage',
  'clients.manage',
  'inventory.manage',
  'employees.manage',
] as const;

export type EmployeePermission = (typeof employeePermissions)[number];
