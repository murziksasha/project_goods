export type RateProvider = 'nbu' | 'privat' | 'mono';

export type ExchangeRateQuote = {
  currency: string;
  provider: RateProvider;
  official?: number;
  buy?: number;
  sell?: number;
  fetchedAt: string;
};

type CacheEntry = {
  expiresAt: number;
  quotes: ExchangeRateQuote[];
};

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

const SUPPORTED_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'PLN']);

const parseRate = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const fetchNbuRates = async (currencies: string[]): Promise<ExchangeRateQuote[]> => {
  const response = await fetch(
    'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json',
  );
  if (!response.ok) {
    throw new Error('Failed to fetch NBU rates');
  }
  const payload = (await response.json()) as Array<{
    cc: string;
    rate: number;
  }>;
  const fetchedAt = new Date().toISOString();

  return payload
    .filter((item) => currencies.includes(item.cc))
    .map((item) => ({
      currency: item.cc,
      provider: 'nbu' as const,
      official: parseRate(item.rate) ?? undefined,
      fetchedAt,
    }));
};

const fetchPrivatRates = async (currencies: string[]): Promise<ExchangeRateQuote[]> => {
  const response = await fetch(
    'https://api.privatbank.ua/p24api/pubinfo?json&exchange&coursid=5',
  );
  if (!response.ok) {
    throw new Error('Failed to fetch PrivatBank rates');
  }
  const payload = (await response.json()) as Array<{
    ccy: string;
    base_ccy: string;
    buy: string;
    sale: string;
  }>;
  const fetchedAt = new Date().toISOString();

  return payload
    .filter((item) => item.base_ccy === 'UAH' && currencies.includes(item.ccy))
    .map((item) => ({
      currency: item.ccy,
      provider: 'privat' as const,
      buy: parseRate(item.buy) ?? undefined,
      sell: parseRate(item.sale) ?? undefined,
      fetchedAt,
    }));
};

const fetchMonoRates = async (currencies: string[]): Promise<ExchangeRateQuote[]> => {
  const response = await fetch('https://api.monobank.ua/bank/currency');
  if (!response.ok) {
    throw new Error('Failed to fetch Monobank rates');
  }
  const payload = (await response.json()) as Array<{
    currencyCodeA: number;
    currencyCodeB: number;
    rateBuy?: number;
    rateSell?: number;
  }>;
  const currencyCodeMap: Record<string, number> = { USD: 840, EUR: 978, GBP: 826, PLN: 985 };
  const fetchedAt = new Date().toISOString();

  return currencies.flatMap((currency) => {
    const code = currencyCodeMap[currency];
    if (!code) return [];
    const item = payload.find(
      (entry) => entry.currencyCodeA === code && entry.currencyCodeB === 980,
    );
    if (!item) return [];
    return [
      {
        currency,
        provider: 'mono' as const,
        buy: parseRate(item.rateBuy) ?? undefined,
        sell: parseRate(item.rateSell) ?? undefined,
        fetchedAt,
      },
    ];
  });
};

const providerFetchers: Record<
  RateProvider,
  (currencies: string[]) => Promise<ExchangeRateQuote[]>
> = {
  nbu: fetchNbuRates,
  privat: fetchPrivatRates,
  mono: fetchMonoRates,
};

export const getMarketRates = async ({
  providers,
  currencies,
}: {
  providers: RateProvider[];
  currencies: string[];
}) => {
  const normalizedProviders = providers.filter((provider) => provider in providerFetchers);
  const normalizedCurrencies = currencies
    .map((currency) => currency.trim().toUpperCase())
    .filter((currency) => SUPPORTED_CURRENCIES.has(currency));

  const cacheKey = `${normalizedProviders.join(',')}|${normalizedCurrencies.join(',')}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.quotes;
  }

  const settled = await Promise.allSettled(
    normalizedProviders.map((provider) => providerFetchers[provider](normalizedCurrencies)),
  );

  const quotes = settled.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : [],
  );

  cache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    quotes,
  });

  return quotes;
};

export const clearMarketRatesCacheForTests = () => {
  cache.clear();
};