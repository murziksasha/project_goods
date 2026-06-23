export type WeatherIntensity = 'light' | 'moderate' | 'heavy';
export type WindTier = 'calm' | 'breezy' | 'windy';

export type SceneParamsInput = {
  condition: string;
  intensity?: WeatherIntensity;
  windSpeed?: number;
  windDirection?: number;
  compact?: boolean;
};

export type SceneParams = {
  intensity: WeatherIntensity;
  windTier: WindTier;
  windCompass?: string;
  rainDropCount: number;
  snowFlakeCount: number;
  cloudDriftDurationSec: number;
  rainDurationSec: number;
  snowDurationSec: number;
  windSlantDeg: number;
  showWindStreaks: boolean;
  lightningDurationSec: number;
  style: Record<string, string | number>;
};

const compassPoints = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

export const degreesToCompass = (degrees?: number) => {
  if (degrees === undefined || !Number.isFinite(degrees)) return undefined;
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % compassPoints.length;
  return compassPoints[index];
};

export const resolveWindTier = (windSpeed?: number): WindTier => {
  const speed = windSpeed ?? 0;
  if (speed >= 29) return 'windy';
  if (speed >= 12) return 'breezy';
  return 'calm';
};

const resolveWindSlant = (windSpeed?: number, windDirection?: number) => {
  const tier = resolveWindTier(windSpeed);
  const base =
    tier === 'windy' ? 24 : tier === 'breezy' ? 14 : 0;
  if (base === 0 || windDirection === undefined) return 0;
  const radians = (windDirection * Math.PI) / 180;
  return Math.round(Math.sin(radians) * base);
};

const rainDropCountByIntensity = (
  intensity: WeatherIntensity,
  compact: boolean,
) => {
  if (compact) {
    if (intensity === 'light') return 6;
    if (intensity === 'heavy') return 12;
    return 8;
  }
  if (intensity === 'light') return 10;
  if (intensity === 'heavy') return 22;
  return 14;
};

const snowFlakeCountByIntensity = (
  intensity: WeatherIntensity,
  compact: boolean,
) => {
  if (compact) {
    if (intensity === 'light') return 6;
    if (intensity === 'heavy') return 12;
    return 8;
  }
  if (intensity === 'light') return 10;
  if (intensity === 'heavy') return 20;
  return 14;
};

export const resolveSceneParams = ({
  condition,
  intensity,
  windSpeed,
  windDirection,
  compact = false,
}: SceneParamsInput): SceneParams => {
  const resolvedIntensity: WeatherIntensity =
    intensity ??
    (condition === 'fog' ? 'light' : 'moderate');
  const windTier = resolveWindTier(windSpeed);
  const windSlantDeg = resolveWindSlant(windSpeed, windDirection);
  const cloudDriftDurationSec =
    windTier === 'windy' ? 5.5 : windTier === 'breezy' ? 7.5 : 10;
  const rainDurationSec =
    resolvedIntensity === 'heavy'
      ? 0.55
      : resolvedIntensity === 'light'
        ? 1
        : 0.75;
  const snowDurationSec =
    resolvedIntensity === 'heavy'
      ? 2
      : resolvedIntensity === 'light'
        ? 3.2
        : 2.6;
  const lightningDurationSec = resolvedIntensity === 'heavy' ? 3.2 : 4.5;

  return {
    intensity: resolvedIntensity,
    windTier,
    windCompass: degreesToCompass(windDirection),
    rainDropCount: rainDropCountByIntensity(resolvedIntensity, compact),
    snowFlakeCount: snowFlakeCountByIntensity(resolvedIntensity, compact),
    cloudDriftDurationSec,
    rainDurationSec,
    snowDurationSec,
    windSlantDeg,
    showWindStreaks: windTier === 'windy',
    lightningDurationSec,
    style: {
      '--weather-wind-slant': `${windSlantDeg}deg`,
      '--weather-wind-speed': windSpeed ?? 0,
      '--weather-cloud-drift-duration': `${cloudDriftDurationSec}s`,
      '--weather-rain-duration': `${rainDurationSec}s`,
      '--weather-snow-duration': `${snowDurationSec}s`,
      '--weather-lightning-duration': `${lightningDurationSec}s`,
    },
  };
};