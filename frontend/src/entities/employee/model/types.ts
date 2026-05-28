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
] as const;

export type EmployeePermission = (typeof employeePermissionOptions)[number];

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
