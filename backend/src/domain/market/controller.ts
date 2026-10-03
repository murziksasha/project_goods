import type { Request, Response } from 'express';
import { getMarketRates, type RateProvider } from './service';

const isRateProvider = (value: string): value is RateProvider =>
  value === 'nbu' || value === 'privat' || value === 'mono';

export const getRates = async (req: Request, res: Response): Promise<void> => {
  const providersParam = String(req.query.providers ?? 'nbu,privat');
  const currenciesParam = String(req.query.currencies ?? 'USD,EUR');

  const providers = providersParam
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(isRateProvider);
  const currencies = currenciesParam
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  const forceParam = String(req.query.force ?? '').toLowerCase();
  const force = forceParam === '1' || forceParam === 'true';

  const quotes = await getMarketRates({
    providers: providers.length > 0 ? providers : ['nbu', 'privat'],
    currencies: currencies.length > 0 ? currencies : ['USD', 'EUR'],
    force,
  });

  res.json({ quotes });
};

