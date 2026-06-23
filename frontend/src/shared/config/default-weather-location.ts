export type WeatherLocationPreset = 'chornomorsk' | 'odesa';

export type WeatherLocation = {
  id: WeatherLocationPreset;
  latitude: number;
  longitude: number;
  label: string;
};

export const WEATHER_LOCATION_PRESETS: Record<WeatherLocationPreset, WeatherLocation> = {
  chornomorsk: {
    id: 'chornomorsk',
    latitude: 46.3013,
    longitude: 30.6531,
    label: 'Chornomorsk',
  },
  odesa: {
    id: 'odesa',
    latitude: 46.4825,
    longitude: 30.7233,
    label: 'Odesa',
  },
};

export const DEFAULT_WEATHER_LOCATION_PRESET: WeatherLocationPreset = 'chornomorsk';

export const getWeatherLocationPreset = (
  value?: string | null,
): WeatherLocationPreset =>
  value === 'odesa' ? 'odesa' : DEFAULT_WEATHER_LOCATION_PRESET;

export const resolveWeatherLocation = (
  preset?: string | null,
): WeatherLocation =>
  WEATHER_LOCATION_PRESETS[getWeatherLocationPreset(preset)];