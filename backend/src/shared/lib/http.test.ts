import { describe, expect, it, vi } from 'vitest';
import * as authService from '../../domain/auth/service';
import { asyncHandler, requirePermission } from './http';
import { HttpError } from './errors';

describe('asyncHandler', () => {
  it('passes rejected handler errors to next', async () => {
    const error = new Error('boom');
    const next = vi.fn();
    const handler = asyncHandler(async () => {
      throw error;
    });

    handler({} as never, {} as never, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledWith(error);
  });

  it('does not call next when handler resolves', async () => {
    const next = vi.fn();
    const handler = asyncHandler(async (_req, res) => {
      res.json({ ok: true });
    });
    const res = { json: vi.fn() };

    handler({} as never, res as never, next);
    await Promise.resolve();

    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requirePermission', () => {
  it('uses req.employee without token lookup', async () => {
    const spy = vi.spyOn(authService, 'getEmployeeByToken');
    const req = {
      employee: {
        role: 'support',
        permissions: ['inventory.manage'],
      },
      headers: {},
    };

    const employee = await requirePermission(req as never, 'inventory.manage');

    expect(employee).toBe(req.employee);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('throws 403 when permission is missing on req.employee', async () => {
    const spy = vi.spyOn(authService, 'getEmployeeByToken');
    const req = {
      employee: {
        role: 'support',
        permissions: ['orders.view'],
      },
      headers: {},
    };

    await expect(requirePermission(req as never, 'inventory.manage')).rejects.toBeInstanceOf(
      HttpError,
    );
    await expect(requirePermission(req as never, 'inventory.manage')).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
