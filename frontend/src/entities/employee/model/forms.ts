import { defaultEmployeePermissionsByRole, type Employee, type EmployeeFormValues } from './types';

export const initialEmployeeForm: EmployeeFormValues = {
  name: '',
  phone: '+380',
  email: '',
  username: '',
  password: '',
  role: 'manager',
  permissions: defaultEmployeePermissionsByRole.manager,
  isActive: true,
  note: '',
};

export const toEmployeeForm = (employee: Employee): EmployeeFormValues => ({
  name: employee.name,
  phone: employee.phone || '+380',
  email: employee.email,
  username: employee.username,
  password: '',
  role: employee.role,
  permissions: employee.permissions,
  isActive: employee.isActive,
  note: employee.note,
});
