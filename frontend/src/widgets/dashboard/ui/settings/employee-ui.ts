import type {
  EmployeePermission,
  EmployeeRole,
} from '../../../../entities/employee/model/types';
import type { StatusBadgeTone } from '../../../../shared/ui/StatusBadge';

export const employeeRoleLabelKey = (role: EmployeeRole) =>
  `employees.roles.${role}`;

export const employeePermissionLabelKey = (permission: EmployeePermission) =>
  `employees.permissions.${permission}`;

export const employeeRoleTone: Record<EmployeeRole, StatusBadgeTone> = {
  owner: 'warning',
  manager: 'info',
  master: 'success',
  accountant: 'info',
  warehouse: 'gray',
  sales: 'success',
  support: 'gray',
};
