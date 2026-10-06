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
  'orders.chat',
  'supplierOrders.view',
  'supplierOrders.manage',
  'repairs.execute',
  'sales.manage',
  'kanban.use',
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
  'finance.orders.pay',
  'finance.sales.pay',
  'employees.manage',
  'printForms.manage',
  'system.backups.manage',
] as const;

export type EmployeePermission =
  (typeof employeePermissionOptions)[number];

export const defaultEmployeePermissionsByRole: Record<
  EmployeeRole,
  EmployeePermission[]
> = {
  owner: [...employeePermissionOptions],
  manager: [
    'orders.view',
    'orders.manage',
    'orders.chat',
    'kanban.use',
    'supplierOrders.view',
    'supplierOrders.manage',
    'clients.manage',
    'inventory.manage',
    'finance.cashboxes.view',
    'finance.transactions.deposit',
    'finance.orders.pay',
    'finance.sales.pay',
  ],
  master: [
    'orders.view',
    'orders.chat',
    'repairs.execute',
    'kanban.use',
  ],
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
    'finance.orders.pay',
    'finance.sales.pay',
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
    'finance.sales.pay',
  ],
  support: ['orders.view'],
};

export const ordersTabPreferenceOptions = [
  'orders',
  'kanban',
  'sales',
  'supplierOrders',
  'supplierInformation',
] as const;

import type {
  Employee,
  EmployeeUiPreferences,
  OrdersTabPreference,
} from '../../../shared/types/domain';

export type { Employee, EmployeeUiPreferences, OrdersTabPreference };

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
