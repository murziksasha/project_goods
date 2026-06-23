import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { clearMarketRatesCacheForTests, getMarketRates } from './service';

describe('market service', () => {
  afterEach(() => {
    clearMarketRatesCacheForTests();
    vi.restoreAllMocks();
  });

  it('normalizes NBU and Privat responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('bank.gov.ua')) {
          return {
            ok: true,
            json: async () => [
              { cc: 'USD', rate: 41.2 },
              { cc: 'EUR', rate: 44.5 },
            ],
          };
        }
        if (url.includes('privatbank.ua')) {
          return {
            ok: true,
            json: async () => [
              {
                ccy: 'USD',
                base_ccy: 'UAH',
                buy: '40.9',
                sale: '41.5',
              },
            ],
          };
        }
        throw new Error(`Unexpected URL: ${url}`);
      }),
    );

    const quotes = await getMarketRates({
      providers: ['nbu', 'privat'],
      currencies: ['USD'],
    });

    expect(quotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currency: 'USD', provider: 'nbu', official: 41.2 }),
        expect.objectContaining({
          currency: 'USD',
          provider: 'privat',
          buy: 40.9,
          sell: 41.5,
        }),
      ]),
    );
  });
});