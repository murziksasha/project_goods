import { useEffect, useState } from 'react';

const DEFAULT_COORDS = {
  latitude: 50.4501,
  longitude: 30.5234,
};

export type DeviceCoordinates = {
  latitude: number;
  longitude: number;
  usedFallback: boolean;
};

export const useDeviceCoordinates = () => {
  const [coordinates, setCoordinates] = useState<DeviceCoordinates>({
    ...DEFAULT_COORDS,
    usedFallback: true,
  });

  useEffect(() => {
    if (!navigator.geolocation) return;

    const timeoutId = window.setTimeout(() => {
      setCoordinates({
        ...DEFAULT_COORDS,
        usedFallback: true,
      });
    }, 8000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(timeoutId);
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          usedFallback: false,
        });
      },
      () => {
        window.clearTimeout(timeoutId);
        setCoordinates({
          ...DEFAULT_COORDS,
          usedFallback: true,
        });
      },
      {
        enableHighAccuracy: false,
        maximumAge: 5 * 60 * 1000,
        timeout: 8000,
      },
    );

    return () => window.clearTimeout(timeoutId);
  }, []);

  return coordinates;
};