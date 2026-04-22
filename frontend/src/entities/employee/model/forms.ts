import type { Employee, EmployeeFormValues } from './types';

export const initialEmployeeForm: EmployeeFormValues = {
  name: '',
  phone: '+380',
  role: 'manager',
  permissions: ['orders.view', 'orders.manage'],
  isActive: true,
  note: '',
};

export const toEmployeeForm = (employee: Employee): EmployeeFormValues => ({
  name: employee.name,
  phone: employee.phone || '+380',
  role: employee.role,
  permissions: employee.permissions,
  isActive: employee.isActive,
  note: employee.note,
});
