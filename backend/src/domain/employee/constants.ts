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
  'orders.chat',
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

export const defaultEmployeePermissionsByRole: Record<
  EmployeeRole,
  EmployeePermission[]
> = {
  owner: [...employeePermissions],
  manager: [
    'orders.view',
    'orders.manage',
    'orders.chat',
    'supplierOrders.view',
    'supplierOrders.manage',
    'clients.manage',
    'inventory.manage',
    'finance.cashboxes.view',
    'finance.transactions.deposit',
  ],
  master: ['orders.view', 'orders.chat', 'repairs.execute'],
  accountant: [
    'orders.view',
    'supplierOrders.view',
    'supplierOrders.manage',
    'sales.manage',
    'finance.view',
    'finance.cashboxes.view',
    'finance.cashboxes.manage',
    'finance.transactions.deposit',
    'finance.transactions.withdraw',
    'finance.transactions.transfer',
    'finance.supplierOrders.pay',
    'finance.supplierOrders.issueWithoutPayment',
  ],
  warehouse: [
    'orders.view',
    'supplierOrders.view',
    'supplierOrders.manage',
    'inventory.manage',
  ],
  sales: [
    'orders.view',
    'sales.manage',
    'clients.manage',
    'finance.cashboxes.view',
    'finance.transactions.deposit',
  ],
  support: ['orders.view'],
};

export const getEffectiveEmployeePermissions = (employee: {
  role?: string;
  permissions?: readonly string[];
}) => {
  const role = employeeRoles.includes(employee.role as EmployeeRole)
    ? (employee.role as EmployeeRole)
    : null;
  const defaults = role ? defaultEmployeePermissionsByRole[role] : [];

  return Array.from(new Set([...(employee.permissions ?? []), ...defaults]));
};
