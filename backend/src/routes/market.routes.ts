import { Router } from 'express';
import { getMarketRates, type RateProvider } from '../domain/market/service';
import { asyncHandler } from '../shared/lib/http';

export const marketRouter = Router();

const isRateProvider = (value: string): value is RateProvider =>
  value === 'nbu' || value === 'privat' || value === 'mono';

marketRouter.get(
  '/market/rates',
  asyncHandler(async (req, res) => {
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

    const quotes = await getMarketRates({
      providers: providers.length > 0 ? providers : ['nbu', 'privat'],
      currencies: currencies.length > 0 ? currencies : ['USD', 'EUR'],
    });

    res.json({ quotes });
  }),
);