import type { WeatherIntensity } from '../../model/weather-scene-params';

type WeatherSceneSkyFallbackProps = {
  condition: string;
  intensity?: WeatherIntensity | string;
};

const skyStops: Record<string, [string, string, string]> = {
  clear: ['#38bdf8', '#7dd3fc', '#fef3c7'],
  'partly-cloudy': ['#60a5fa', '#93c5fd', '#e0f2fe'],
  cloudy: ['#94a3b8', '#cbd5e1', '#e2e8f0'],
  fog: ['#94a3b8', '#cbd5e1', '#e2e8f0'],
  rain: ['#475569', '#64748b', '#94a3b8'],
  thunder: ['#475569', '#64748b', '#94a3b8'],
  snow: ['#cbd5e1', '#e2e8f0', '#f8fafc'],
};

const intensitySkyOverrides: Record<string, Record<string, [string, string, string]>> = {
  rain: {
    light: ['#64748b', '#94a3b8', '#cbd5e1'],
    heavy: ['#334155', '#475569', '#64748b'],
  },
  thunder: {
    light: ['#475569', '#64748b', '#94a3b8'],
    heavy: ['#1e293b', '#334155', '#475569'],
  },
  snow: {
    light: ['#e2e8f0', '#f1f5f9', '#f8fafc'],
    heavy: ['#94a3b8', '#cbd5e1', '#e2e8f0'],
  },
  fog: {
    moderate: ['#64748b', '#94a3b8', '#cbd5e1'],
    heavy: ['#475569', '#64748b', '#94a3b8'],
  },
};

const defaultStops: [string, string, string] = ['#7dd3fc', '#bae6fd', '#e0f2fe'];

export const WeatherSceneSkyFallback = ({
  condition,
  intensity,
}: WeatherSceneSkyFallbackProps) => {
  const intensityOverride =
    intensity && intensitySkyOverrides[condition]?.[intensity];
  const [top, mid, bottom] =
    intensityOverride ?? skyStops[condition] ?? defaultStops;
  const gradientId = `weather-scene-sky-${condition.replace(/[^a-z0-9-]/gi, '-')}-${intensity ?? 'default'}`;

  return (
    <svg
      className="weather-scene-sky-fallback"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={top} />
          <stop offset="55%" stopColor={mid} />
          <stop offset="100%" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${gradientId})`} />
    </svg>
  );
};