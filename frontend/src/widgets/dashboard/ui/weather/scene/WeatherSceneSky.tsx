import type React from 'react';
import { WeatherSceneSkyFallback } from '../WeatherSceneSkyFallback';

export interface WeatherSceneSkyProps {
  condition: string;
  intensity?: string;
};

export const WeatherSceneSky: React.FC<WeatherSceneSkyProps> = ({ condition, intensity }) => (
  <>
    <WeatherSceneSkyFallback condition={condition} intensity={intensity} />
    <div className="weather-scene-sky" />
  </>
);