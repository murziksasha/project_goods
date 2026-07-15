import { Router } from 'express';
import { env } from '../config/env';
import { getWeatherForecast, type WeatherProvider } from '../domain/weather/service';
import { asyncHandler } from '../shared/lib/http';

export const weatherRouter = Router();

const isWeatherProvider = (value: string): value is WeatherProvider =>
  value === 'open-meteo' || value === 'openweather';

weatherRouter.get(
  '/weather/forecast',
  asyncHandler(async (req, res) => {
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lon);
    const providerParam = String(req.query.provider ?? 'open-meteo');
    const provider = isWeatherProvider(providerParam) ? providerParam : 'open-meteo';
    // Prefer server env; never require API keys in query strings (logs/proxies).
    const openWeatherApiKey = env.openWeatherApiKey ?? '';

    const forecast = await getWeatherForecast({
      latitude,
      longitude,
      provider,
      openWeatherApiKey,
    });

    res.json(forecast);
  }),
);
