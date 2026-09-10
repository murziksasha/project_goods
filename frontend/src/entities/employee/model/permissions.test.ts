import { describe, expect, it } from 'vitest';
import type { Employee } from './types';
import {
  getEffectiveEmployeePermissions,
  hasEmployeePermission,
} from './permissions';

const employee = {
  id: 'employee-1',
  name: 'Worker',
  phone: '',
  email: '',
  username: 'worker',
  role: 'support',
  permissions: ['kanban.use'],
  isActive: true,
  isRegistered: true,
  note: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as Employee;

describe('kanban.use permission', () => {
  it('grants kanban.use from master and manager role defaults when stored permissions are empty', () => {
    expect(
      hasEmployeePermission({ ...employee, role: 'master', permissions: [] }, 'kanban.use'),
    ).toBe(true);
    expect(
      hasEmployeePermission({ ...employee, role: 'manager', permissions: [] }, 'kanban.use'),
    ).toBe(true);
  });

  it('does not grant kanban.use from support or sales role defaults', () => {
    expect(
      hasEmployeePermission({ ...employee, role: 'support', permissions: [] }, 'kanban.use'),
    ).toBe(false);
    expect(
      hasEmployeePermission({ ...employee, role: 'sales', permissions: [] }, 'kanban.use'),
    ).toBe(false);
  });

  it('keeps an explicit kanban.use uncheck for a master with a stored permission list', () => {
    const master = {
      ...employee,
      role: 'master' as const,
      permissions: ['orders.manage', 'sales.manage'] as Employee['permissions'],
    };

    expect(hasEmployeePermission(master, 'kanban.use')).toBe(false);
    expect(hasEmployeePermission(master, 'orders.view')).toBe(true);
    expect(getEffectiveEmployeePermissions(master)).not.toContain('kanban.use');
  });

  it('honors a stored kanban.use grant without order workspace rights', () => {
    expect(hasEmployeePermission(employee, 'kanban.use')).toBe(true);
  });
});
