import { describe, expect, it, vi } from 'vitest';
import * as authService from '../../domain/auth/service';
import { requireAuthUnlessPublic } from './auth';

describe('requireAuthUnlessPublic', () => {
  it('does not touch session lastUsedAt for the events stream', async () => {
    const spy = vi
      .spyOn(authService, 'getEmployeeByToken')
      .mockResolvedValue({} as never);
    const next = vi.fn();
    const req = {
      method: 'GET',
      path: '/events/stream',
      headers: { authorization: 'Bearer tok' },
    };

    await requireAuthUnlessPublic(req as never, {} as never, next);

    expect(spy).toHaveBeenCalledWith('tok', expect.any(Date), { touch: false });
    expect(next).toHaveBeenCalledWith();
    spy.mockRestore();
  });

  it('touches the session for ordinary API routes', async () => {
    const spy = vi
      .spyOn(authService, 'getEmployeeByToken')
      .mockResolvedValue({} as never);
    const next = vi.fn();
    const req = {
      method: 'GET',
      path: '/finance/currencies',
      headers: { authorization: 'Bearer tok' },
    };

    await requireAuthUnlessPublic(req as never, {} as never, next);

    expect(spy).toHaveBeenCalledWith('tok', expect.any(Date), { touch: true });
    spy.mockRestore();
  });
});
