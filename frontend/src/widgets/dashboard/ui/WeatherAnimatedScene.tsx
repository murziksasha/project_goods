import type { CSSProperties } from 'react';
import {
  resolveSceneParams,
  type WeatherIntensity,
} from '../model/weather-scene-params';
import { WeatherSunGraphic } from './WeatherSunGraphic';
import { WeatherSceneClouds } from './weather-scene/WeatherSceneClouds';
import { WeatherSceneFog } from './weather-scene/WeatherSceneFog';
import { WeatherSceneLightning } from './weather-scene/WeatherSceneLightning';
import { WeatherSceneRain } from './weather-scene/WeatherSceneRain';
import { WeatherSceneSky } from './weather-scene/WeatherSceneSky';
import { WeatherSceneSnow } from './weather-scene/WeatherSceneSnow';
import { WeatherSceneWindStreaks } from './weather-scene/WeatherSceneWindStreaks';

type WeatherAnimatedSceneProps = {
  condition: string;
  compact?: boolean;
  animated?: boolean;
  intensity?: WeatherIntensity;
  windSpeed?: number;
  windDirection?: number;
};

export const WeatherAnimatedScene = ({
  condition,
  compact = false,
  animated = true,
  intensity,
  windSpeed,
  windDirection,
}: WeatherAnimatedSceneProps) => {
  const params = resolveSceneParams({
    condition,
    intensity,
    windSpeed,
    windDirection,
    compact,
  });

  const showSun = condition === 'clear' || condition === 'partly-cloudy';

  return (
    <div
      className={[
        'weather-scene',
        `weather-scene-${condition}`,
        `weather-scene--intensity-${params.intensity}`,
        `weather-scene--wind-${params.windTier}`,
        compact ? 'weather-scene-compact' : 'weather-scene-hero',
        animated ? 'weather-scene--animated' : 'weather-scene--static',
      ].join(' ')}
      style={params.style as CSSProperties}
      aria-hidden="true"
      {...(import.meta.env.DEV
        ? {
            'data-weather-condition': condition,
            'data-weather-intensity': params.intensity,
          }
        : {})}
    >
      <WeatherSceneSky condition={condition} intensity={params.intensity} />

      {showSun ? (
        <>
          <div
            className={
              condition === 'partly-cloudy'
                ? 'weather-scene-sun-glow weather-scene-sun-glow-small'
                : 'weather-scene-sun-glow'
            }
          />
          <WeatherSunGraphic
            variant={condition === 'partly-cloudy' ? 'small' : 'full'}
            showRays
            rayOpacity={condition === 'partly-cloudy' ? 0.7 : 1}
            className={
              condition === 'partly-cloudy'
                ? 'weather-scene-sun-graphic-small'
                : 'weather-scene-sun-graphic-full'
            }
          />
        </>
      ) : null}

      {condition === 'partly-cloudy' ? <WeatherSceneClouds count={2} /> : null}

      {condition === 'cloudy' || condition === 'fog' ? (
        <WeatherSceneClouds count={3} />
      ) : null}

      {condition === 'rain' || condition === 'thunder' ? (
        <>
          <WeatherSceneClouds count={2} variant="dark" />
          <WeatherSceneRain dropCount={params.rainDropCount} />
        </>
      ) : null}

      {condition === 'thunder' ? <WeatherSceneLightning /> : null}

      {condition === 'snow' ? (
        <>
          <WeatherSceneClouds count={1} variant="faint" />
          <WeatherSceneSnow
            flakeCount={params.snowFlakeCount}
            intensity={params.intensity}
          />
        </>
      ) : null}

      {condition === 'fog' ? (
        <WeatherSceneFog intensity={params.intensity} />
      ) : null}

      {params.showWindStreaks ? <WeatherSceneWindStreaks /> : null}
    </div>
  );
};