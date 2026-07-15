import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leanResult } from '../../test/mongoose-mocks';
import * as financeInternal from './internal';
import { Cashbox } from './model';
import { ensureDefaultCashbox } from './cashboxes';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('ensureDefaultCashbox session threading', () => {
  it('passes mongo session into getCurrencyCodes', async () => {
    const session = { id: 'session-1' } as mongoose.ClientSession;
    const getCurrencyCodesSpy = vi
      .spyOn(financeInternal, 'getCurrencyCodes')
      .mockResolvedValue(['UAH']);

    vi.spyOn(Cashbox, 'findOne').mockReturnValue({
      session: () =>
        leanResult({
          _id: '507f1f77bcf86cd799439011',
          enabledCurrencies: { UAH: true },
        }),
    } as never);

    await ensureDefaultCashbox(session);

    expect(getCurrencyCodesSpy).toHaveBeenCalledWith({
      includeArchived: true,
      session,
    });
  });
});