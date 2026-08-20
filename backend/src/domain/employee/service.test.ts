import { describe, expect, it } from 'vitest';
import { normalizeEmployeePayload } from '../../shared/lib/parsers';
import {
  ensureCanWriteEmployee,
  normalizeHiddenOrdersTabs,
} from './service';

const createPayload = (permissions: string[]) =>
  normalizeEmployeePayload({
    name: 'Backup Manager',
    username: 'backup.manager',
    password: 'secret',
    role: 'manager',
    permissions,
    isActive: true,
  });

describe('employee service permissions', () => {
  it('blocks non-owners from granting backup management permission', () => {
    expect(() =>
      ensureCanWriteEmployee(
        { _id: 'employee-id', role: 'manager', permissions: ['employees.manage'] } as never,
        createPayload(['orders.view', 'system.backups.manage']),
      ),
    ).toThrow('Only owners can grant system.backups.manage permission.');
  });

  it('allows owners to grant backup management permission', () => {
    expect(() =>
      ensureCanWriteEmployee(
        { _id: 'owner-id', role: 'owner', permissions: [] } as never,
        createPayload(['orders.view', 'system.backups.manage']),
      ),
    ).not.toThrow();
  });
});

describe('normalizeHiddenOrdersTabs', () => {
  it('accepts a unique list of known tabs', () => {
    expect(
      normalizeHiddenOrdersTabs(['sales', 'kanban', 'sales']),
    ).toEqual(['sales', 'kanban']);
  });

  it('rejects a non-array payload', () => {
    expect(() => normalizeHiddenOrdersTabs({ sales: true })).toThrow(
      'hiddenOrdersTabs must be an array.',
    );
  });

  it('rejects unknown tab keys', () => {
    expect(() => normalizeHiddenOrdersTabs(['sales', 'nope'])).toThrow(
      'Invalid orders tab.',
    );
  });
});
