import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Employee } from '../employee/model';
import {
  employeeHasAnyPermission,
  employeeHasPermission,
  getBearerToken,
  getCurrentEmployee,
  getEmployeeByToken,
  loginEmployee,
  logoutEmployee,
  resolveAuthSessions,
} from './service';
import { hashAuthToken, hashPassword } from '../../shared/lib/auth';
import { env } from '../../config/env';

const mockEmployeeFindOne = (employee: unknown) => {
  vi.spyOn(Employee, 'findOne').mockReturnValue({
    select: vi.fn().mockResolvedValue(employee),
  } as never);
};

const createEmployeeRecord = (
  overrides: Partial<{
    authToken: string;
    authTokens: string[];
    authSessions: Array<{ token: string; createdAt: Date; lastUsedAt: Date }>;
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
    passwordHash: hashPassword('secretpass'),
    authToken: '',
    authTokens: [] as string[],
    authSessions: [] as Array<{ token: string; createdAt: Date; lastUsedAt: Date }>,
    save: vi.fn().mockResolvedValue(undefined),
    toObject() {
      return this;
    },
    ...overrides,
  };

  return employee;
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    get: () => 0,
  });
  env.authSessionIdleHours = 0;
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
      permissions: ['finance.transactions.deposit', 'orders.chat', 'printForms.manage'],
    };

    expect(employeeHasPermission(employee, 'finance.transactions.deposit')).toBe(true);
    expect(employeeHasPermission(employee, 'orders.chat')).toBe(true);
    expect(employeeHasPermission(employee, 'printForms.manage')).toBe(true);
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
  it('allows login with existing short passwords (length policy is not on login)', async () => {
    const shortPassword = 'pass123';
    const employee = createEmployeeRecord({
      passwordHash: hashPassword(shortPassword),
    });
    mockEmployeeFindOne(employee);

    const session = await loginEmployee('employee', shortPassword);

    expect(session.token).toBeTruthy();
    expect(session.employee).toMatchObject({ id: 'employee-id', username: 'employee' });
    expect(employee.authSessions).toHaveLength(1);
    expect(employee.authSessions[0]?.token).toBe(hashAuthToken(session.token));
    expect(employee.authTokens).toEqual([hashAuthToken(session.token)]);
    expect(employee.save).toHaveBeenCalledTimes(1);
  });

  it('rejects wrong password regardless of length', async () => {
    const employee = createEmployeeRecord({
      passwordHash: hashPassword('pass123'),
    });
    mockEmployeeFindOne(employee);

    await expect(loginEmployee('employee', 'wrong12')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid username or password.',
    });
  });

  it('stores hashed tokens for repeated logins', async () => {
    const employee = createEmployeeRecord({
      authToken: hashAuthToken('legacy-raw'),
      authTokens: [hashAuthToken('legacy-raw')],
      authSessions: [
        {
          token: hashAuthToken('legacy-raw'),
          createdAt: new Date('2026-06-09T12:00:00.000Z'),
          lastUsedAt: new Date('2026-06-09T12:00:00.000Z'),
        },
      ],
    });
    mockEmployeeFindOne(employee);

    const firstSession = await loginEmployee('employee', 'secretpass');
    const secondSession = await loginEmployee('employee', 'secretpass');

    expect(firstSession.token).not.toBe(secondSession.token);
    expect(employee.authTokens).toEqual([
      hashAuthToken('legacy-raw'),
      hashAuthToken(firstSession.token),
      hashAuthToken(secondSession.token),
    ]);
    expect(employee.authToken).toBe(hashAuthToken(secondSession.token));
    expect(employee.save).toHaveBeenCalledTimes(2);
  });

  it('accepts hashed session tokens', async () => {
    const raw = 'first-token-raw-value-32bytes-aaaaaa';
    const now = new Date('2026-06-09T12:00:00.000Z');
    const employee = createEmployeeRecord({
      authTokens: [hashAuthToken(raw)],
      authSessions: [
        { token: hashAuthToken(raw), createdAt: now, lastUsedAt: now },
      ],
    });
    mockEmployeeFindOne(employee);

    await expect(getCurrentEmployee(raw)).resolves.toMatchObject({
      id: 'employee-id',
    });
    expect(Employee.findOne).toHaveBeenCalled();
  });

  it('logs out only the current token', async () => {
    const rawFirst = 'first-token-raw-value-32bytes-bbbbbb';
    const rawSecond = 'second-token-raw-value-32bytes-cccc';
    const now = new Date('2026-06-09T12:00:00.000Z');
    const employee = createEmployeeRecord({
      authToken: hashAuthToken(rawSecond),
      authTokens: [hashAuthToken(rawFirst), hashAuthToken(rawSecond)],
      authSessions: [
        { token: hashAuthToken(rawFirst), createdAt: now, lastUsedAt: now },
        { token: hashAuthToken(rawSecond), createdAt: now, lastUsedAt: now },
      ],
    });
    mockEmployeeFindOne(employee);

    await logoutEmployee(rawFirst);

    expect(employee.authTokens).toEqual([hashAuthToken(rawSecond)]);
    expect(employee.authSessions.map((s) => s.token)).toEqual([
      hashAuthToken(rawSecond),
    ]);
    expect(employee.authToken).toBe(hashAuthToken(rawSecond));
    expect(employee.save).toHaveBeenCalled();
  });

  it('migrates legacy plaintext sessions to hashed form', async () => {
    const employee = createEmployeeRecord({
      authToken: 'legacy-token',
      authTokens: [],
      authSessions: [],
    });
    mockEmployeeFindOne(employee);

    await expect(getCurrentEmployee('legacy-token')).resolves.toMatchObject({
      id: 'employee-id',
    });
    expect(employee.authSessions[0]?.token).toBe(hashAuthToken('legacy-token'));
    expect(employee.save).toHaveBeenCalled();
  });

  it('rejects idle-expired sessions when AUTH_SESSION_IDLE_HOURS is set', async () => {
    env.authSessionIdleHours = 1;
    const lastUsedAt = new Date('2026-06-09T10:00:00.000Z');
    const now = new Date('2026-06-09T12:00:00.000Z');
    const raw = 'stale-token-raw-value-32bytes-dddddd';
    const employee = createEmployeeRecord({
      authSessions: [
        {
          token: hashAuthToken(raw),
          createdAt: lastUsedAt,
          lastUsedAt,
        },
      ],
      authTokens: [hashAuthToken(raw)],
      authToken: hashAuthToken(raw),
    });
    mockEmployeeFindOne(employee);

    await expect(getEmployeeByToken(raw, now)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Session expired. Please sign in again.',
    });
    expect(employee.authTokens).toEqual([]);
    expect(employee.authSessions).toEqual([]);
    expect(employee.save).toHaveBeenCalled();
  });

  it('accepts sessions still within idle window', async () => {
    env.authSessionIdleHours = 24;
    const lastUsedAt = new Date('2026-06-09T11:00:00.000Z');
    const now = new Date('2026-06-09T12:00:00.000Z');
    const raw = 'fresh-token-raw-value-32bytes-eeeeee';
    const employee = createEmployeeRecord({
      authSessions: [
        {
          token: hashAuthToken(raw),
          createdAt: lastUsedAt,
          lastUsedAt,
        },
      ],
      authTokens: [hashAuthToken(raw)],
      authToken: hashAuthToken(raw),
    });
    mockEmployeeFindOne(employee);

    await expect(getEmployeeByToken(raw, now)).resolves.toMatchObject({
      username: 'employee',
    });
  });

  it('resolveAuthSessions falls back to legacy token arrays', () => {
    const now = new Date('2026-06-09T12:00:00.000Z');
    expect(
      resolveAuthSessions(
        { authToken: 'a', authTokens: ['b', 'a'] },
        now,
      ).map((s) => s.token),
    ).toEqual(['b', 'a']);
  });
});
