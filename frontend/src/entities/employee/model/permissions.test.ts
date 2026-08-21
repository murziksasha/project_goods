import { describe, expect, it } from 'vitest';
import type { Employee } from './types';
import { isKanbanOnlyEmployee } from './permissions';

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

describe('isKanbanOnlyEmployee', () => {
  it('detects a stored kanban.use grant without order workspace rights', () => {
    expect(isKanbanOnlyEmployee(employee)).toBe(true);
  });

  it('is false when stored permissions also include orders.view', () => {
    expect(
      isKanbanOnlyEmployee({
        ...employee,
        permissions: ['kanban.use', 'orders.view'],
      }),
    ).toBe(false);
  });

  it('is false for masters that only rely on role defaults', () => {
    expect(
      isKanbanOnlyEmployee({
        ...employee,
        role: 'master',
        permissions: [],
      }),
    ).toBe(false);
  });
});
