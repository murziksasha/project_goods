import { describe, expect, it } from 'vitest';
import {
  employeeHasAnyPermission,
  employeeHasPermission,
  getBearerToken,
} from './service';

describe('auth permission helpers', () => {
  it('parses bearer tokens', () => {
    expect(getBearerToken('Bearer token-123')).toBe('token-123');
    expect(getBearerToken('Basic token-123')).toBe('');
    expect(getBearerToken(undefined)).toBe('');
  });

  it('allows owner bypass for permissions', () => {
    const owner = { role: 'owner', permissions: [] };

    expect(employeeHasPermission(owner, 'finance.transactions.withdraw')).toBe(true);
    expect(employeeHasAnyPermission(owner, ['employees.manage'])).toBe(true);
  });

  it('checks explicit permissions for non-owner employees', () => {
    const employee = {
      role: 'manager',
      permissions: ['finance.transactions.deposit'],
    };

    expect(employeeHasPermission(employee, 'finance.transactions.deposit')).toBe(true);
    expect(employeeHasPermission(employee, 'finance.transactions.withdraw')).toBe(false);
    expect(
      employeeHasAnyPermission(employee, [
        'finance.transactions.withdraw',
        'finance.transactions.deposit',
      ]),
    ).toBe(true);
  });
});
