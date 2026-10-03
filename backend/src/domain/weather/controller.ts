import type { Request, Response } from 'express';
import { env } from '../../config/env';
import { getWeatherForecast, type WeatherProvider } from './service';

const isWeatherProvider = (value: string): value is WeatherProvider =>
  value === 'open-meteo' || value === 'openweather';

export const getForecast = async (req: Request, res: Response): Promise<void> => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lon);
  const providerParam = String(req.query.provider ?? 'open-meteo');
  const provider = isWeatherProvider(providerParam) ? providerParam : 'open-meteo';
  const openWeatherApiKey = env.openWeatherApiKey ?? '';

  const forceParam = String(req.query.force ?? '').toLowerCase();
  const force = forceParam === '1' || forceParam === 'true';

  const forecast = await getWeatherForecast({
    latitude,
    longitude,
    provider,
    openWeatherApiKey,
    force,
  });

  res.json(forecast);
};

