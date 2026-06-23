import { useQuery } from '@tanstack/react-query';
import type { WeatherProvider } from '../../settings/model/types';
import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import { queryKeys } from '../../../shared/api/queryClient';

export type WeatherDayForecast = {
  date: string;
  temperature: number;
  temperatureMin?: number;
  temperatureMax?: number;
  humidity?: number;
  weatherCode: number;
  condition: string;
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
  openWeatherApiKey,
}: {
  latitude: number;
  longitude: number;
  provider: WeatherProvider;
  openWeatherApiKey?: string;
}) => {
  try {
    const response = await apiClient.get<WeatherForecast>('/weather/forecast', {
      params: {
        lat: latitude,
        lon: longitude,
        provider,
        apiKey: openWeatherApiKey ?? '',
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
  openWeatherApiKey,
  enabled = true,
}: {
  latitude: number;
  longitude: number;
  provider: WeatherProvider;
  openWeatherApiKey?: string;
  enabled?: boolean;
}) =>
  useQuery({
    queryKey: [
      ...queryKeys.weatherForecast,
      latitude,
      longitude,
      provider,
      openWeatherApiKey ?? '',
    ],
    queryFn: () =>
      getWeatherForecast({
        latitude,
        longitude,
        provider,
        openWeatherApiKey,
      }),
    enabled,
    staleTime: 15 * 60 * 1000,
    refetchOnMount: 'always',
  });