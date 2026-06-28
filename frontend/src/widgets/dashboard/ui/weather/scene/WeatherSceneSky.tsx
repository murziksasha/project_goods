import { WeatherSceneSkyFallback } from '../WeatherSceneSkyFallback';

type WeatherSceneSkyProps = {
  condition: string;
  intensity?: string;
};

export const WeatherSceneSky = ({ condition, intensity }: WeatherSceneSkyProps) => (
  <>
    <WeatherSceneSkyFallback condition={condition} intensity={intensity} />
    <div className="weather-scene-sky" />
  </>
);