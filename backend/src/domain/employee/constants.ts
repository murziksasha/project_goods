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
  'supplierOrders.view',
  'supplierOrders.manage',
  'repairs.execute',
  'sales.manage',
  'clients.manage',
  'inventory.manage',
  'finance.view',
  'finance.cashboxes.view',
  'finance.cashboxes.manage',
  'finance.transactions.deposit',
  'finance.transactions.withdraw',
  'finance.transactions.transfer',
  'finance.supplierOrders.pay',
  'finance.supplierOrders.issueWithoutPayment',
  'employees.manage',
  'system.backups.manage',
] as const;

export type EmployeePermission = (typeof employeePermissions)[number];
