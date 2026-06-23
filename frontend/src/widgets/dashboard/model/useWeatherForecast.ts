import type { WeatherLocation } from '../../../shared/config/default-weather-location';

export type DeviceCoordinates = {
  latitude: number;
  longitude: number;
  locationLabel: string;
  usedFallback: boolean;
  usedLanFallback: boolean;
};

export const useDeviceCoordinates = (location: WeatherLocation): DeviceCoordinates => ({
  latitude: location.latitude,
  longitude: location.longitude,
  locationLabel: location.label,
  usedFallback: true,
  usedLanFallback: typeof window !== 'undefined' && !window.isSecureContext,
});