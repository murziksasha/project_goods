import { describe, expect, it, vi } from 'vitest';
import { asyncHandler } from './http';

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
