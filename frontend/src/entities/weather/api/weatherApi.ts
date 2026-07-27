import { useQuery } from '@tanstack/react-query';
import type { WeatherProvider } from '../../settings/model/types';
import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import { queryKeys } from '../../../shared/api/queryClient';

export type WeatherIntensity = 'light' | 'moderate' | 'heavy';

export type WeatherDayForecast = {
  date: string;
  temperature: number;
  temperatureMin?: number;
  temperatureMax?: number;
  humidity?: number;
  weatherCode: number;
  condition: string;
  intensity?: WeatherIntensity;
  windSpeed?: number;
  windGust?: number;
  windDirection?: number;
};

export type WeatherForecast = {
  provider: WeatherProvider;
  latitude: number;
  longitude: number;
  locationLabel?: string;
  current: WeatherDayForecast;
  tomorrow?: WeatherDayForecast;
  daily: WeatherDayForecast[];
  fetchedAt: string;
};

export const getWeatherForecast = async ({
  latitude,
  longitude,
  provider,
  force = false,
}: {
  latitude: number;
  longitude: number;
  provider: WeatherProvider;
  force?: boolean;
}) => {
  try {
    // OpenWeather key lives only in backend env (OPENWEATHER_API_KEY) — never send from client.
    const response = await apiClient.get<WeatherForecast>('/weather/forecast', {
      params: {
        lat: latitude,
        lon: longitude,
        provider,
        ...(force ? { force: '1' } : {}),
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const useWeatherForecastQuery = ({
  latitude,
  longitude,
  provider,
  enabled = true,
}: {
  latitude: number;
  longitude: number;
  provider: WeatherProvider;
  enabled?: boolean;
}) =>
  useQuery({
    queryKey: [...queryKeys.weatherForecast, latitude, longitude, provider],
    queryFn: () =>
      getWeatherForecast({
        latitude,
        longitude,
        provider,
      }),
    enabled,
    staleTime: 15 * 60 * 1000,
    refetchOnMount: 'always',
  });