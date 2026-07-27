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

  it('returns cached rates until force bypasses the cache', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('bank.gov.ua')) {
        const call = (fetchMock as Mock).mock.calls.filter((args) =>
          String(args[0]).includes('bank.gov.ua'),
        ).length;
        return {
          ok: true,
          json: async () => [{ cc: 'USD', rate: call === 1 ? 41.2 : 42.0 }],
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const first = await getMarketRates({
      providers: ['nbu'],
      currencies: ['USD'],
    });
    const cached = await getMarketRates({
      providers: ['nbu'],
      currencies: ['USD'],
    });
    const forced = await getMarketRates({
      providers: ['nbu'],
      currencies: ['USD'],
      force: true,
    });

    expect(first[0]?.official).toBe(41.2);
    expect(cached[0]?.official).toBe(41.2);
    expect(forced[0]?.official).toBe(42.0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});