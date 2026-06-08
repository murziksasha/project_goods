export const employeeRoleOptions = [
  'owner',
  'manager',
  'master',
  'accountant',
  'warehouse',
  'sales',
  'support',
] as const;

export type EmployeeRole = (typeof employeeRoleOptions)[number];

export const employeePermissionOptions = [
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

export type EmployeePermission = (typeof employeePermissionOptions)[number];

export const defaultEmployeePermissionsByRole: Record<EmployeeRole, EmployeePermission[]> = {
  owner: [...employeePermissionOptions],
  manager: [
    'orders.view',
    'orders.manage',
    'supplierOrders.view',
    'supplierOrders.manage',
    'clients.manage',
    'inventory.manage',
    'finance.cashboxes.view',
    'finance.transactions.deposit',
  ],
  master: ['orders.view', 'repairs.execute'],
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

export type Employee = {
  id: string;
  name: string;
  phone: string;
  email: string;
  username: string;
  role: EmployeeRole;
  permissions: EmployeePermission[];
  isActive: boolean;
  isRegistered: boolean;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeFormValues = {
  name: string;
  phone: string;
  email: string;
  username: string;
  password: string;
  role: EmployeeRole;
  permissions: EmployeePermission[];
  isActive: boolean;
  note: string;
};
