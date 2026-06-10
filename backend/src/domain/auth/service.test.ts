import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  employeeHasAnyPermission,
  employeeHasPermission,
  getBearerToken,
  getCurrentEmployee,
  loginEmployee,
  logoutEmployee,
} from './service';
import { hashPassword } from '../../shared/lib/auth';

const findOneMock = vi.hoisted(() => vi.fn());

vi.mock('../employee/model', () => ({
  Employee: {
    findOne: findOneMock,
  },
}));

const mockEmployeeFindOne = (employee: unknown) => {
  const select = vi.fn().mockResolvedValue(employee);
  findOneMock.mockReturnValue({ select });
  return select;
};

const createEmployeeRecord = (
  overrides: Partial<{
    authToken: string;
    authTokens: string[];
    passwordHash: string;
  }> = {},
) => {
  const now = new Date('2026-06-09T12:00:00.000Z');
  const employee = {
    _id: { toString: () => 'employee-id' },
    name: 'Test Employee',
    phone: '+380000000000',
    email: 'employee@example.com',
    username: 'employee',
    role: 'manager',
    permissions: ['orders.view'],
    isActive: true,
    note: '',
    createdAt: now,
    updatedAt: now,
    passwordHash: hashPassword('secret'),
    authToken: '',
    authTokens: [],
    save: vi.fn().mockResolvedValue(undefined),
    toObject() {
      return this;
    },
    ...overrides,
  };

  return employee;
};

beforeEach(() => {
  findOneMock.mockReset();
});

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
      permissions: ['finance.transactions.deposit', 'orders.chat'],
    };

    expect(employeeHasPermission(employee, 'finance.transactions.deposit')).toBe(true);
    expect(employeeHasPermission(employee, 'orders.chat')).toBe(true);
    expect(employeeHasPermission(employee, 'finance.transactions.withdraw')).toBe(false);
    expect(
      employeeHasAnyPermission(employee, [
        'finance.transactions.withdraw',
        'finance.transactions.deposit',
      ]),
    ).toBe(true);
  });

  it('merges master default permissions at runtime', () => {
    const master = { role: 'master', permissions: [] };

    expect(employeeHasPermission(master, 'orders.chat')).toBe(true);
    expect(employeeHasPermission(master, 'repairs.execute')).toBe(true);
  });
});

describe('auth sessions', () => {
  it('keeps multiple active tokens for repeated logins', async () => {
    const employee = createEmployeeRecord({ authToken: 'legacy-token' });
    mockEmployeeFindOne(employee);

    const firstSession = await loginEmployee('employee', 'secret');
    const secondSession = await loginEmployee('employee', 'secret');

    expect(firstSession.token).not.toBe(secondSession.token);
    expect(employee.authTokens).toEqual([
      'legacy-token',
      firstSession.token,
      secondSession.token,
    ]);
    expect(employee.authToken).toBe(secondSession.token);
    expect(employee.save).toHaveBeenCalledTimes(2);
  });

  it('accepts both tokens created for the same employee', async () => {
    const employee = createEmployeeRecord({
      authTokens: ['first-token', 'second-token'],
    });
    mockEmployeeFindOne(employee);

    await expect(getCurrentEmployee('first-token')).resolves.toMatchObject({
      id: 'employee-id',
    });
    await expect(getCurrentEmployee('second-token')).resolves.toMatchObject({
      id: 'employee-id',
    });
    expect(findOneMock).toHaveBeenCalledWith({
      isActive: true,
      $or: [{ authTokens: 'first-token' }, { authToken: 'first-token' }],
    });
    expect(findOneMock).toHaveBeenCalledWith({
      isActive: true,
      $or: [{ authTokens: 'second-token' }, { authToken: 'second-token' }],
    });
  });

  it('logs out only the current token', async () => {
    const employee = createEmployeeRecord({
      authToken: 'second-token',
      authTokens: ['first-token', 'second-token'],
    });
    mockEmployeeFindOne(employee);

    await logoutEmployee('first-token');

    expect(employee.authTokens).toEqual(['second-token']);
    expect(employee.authToken).toBe('second-token');
    expect(employee.save).toHaveBeenCalledTimes(1);
  });

  it('keeps legacy authToken sessions valid', async () => {
    const employee = createEmployeeRecord({
      authToken: 'legacy-token',
      authTokens: [],
    });
    mockEmployeeFindOne(employee);

    await expect(getCurrentEmployee('legacy-token')).resolves.toMatchObject({
      id: 'employee-id',
    });
    expect(findOneMock).toHaveBeenCalledWith({
      isActive: true,
      $or: [{ authTokens: 'legacy-token' }, { authToken: 'legacy-token' }],
    });
  });
});
