import { useTranslation } from 'react-i18next';
import type { WeatherIntensity } from '../../../../entities/weather/api/weatherApi';
import { degreesToCompass } from '../../model/weather-scene-params';
import { WeatherAnimatedScene } from './WeatherAnimatedScene';
import { WeatherSunGraphic } from './WeatherSunGraphic';

type WeatherVisualProps = {
  condition: string;
  temperature: number;
  humidity?: number;
  intensity?: WeatherIntensity;
  windSpeed?: number;
  windGust?: number;
  windDirection?: number;
  label: string;
  compact?: boolean;
  animated?: boolean;
};

const precipitationConditions = new Set(['rain', 'snow', 'thunder', 'fog']);

export const WeatherIconStatic = ({
  condition,
  intensity,
}: {
  condition: string;
  intensity?: WeatherIntensity;
}) => {
  const isHeavy = intensity === 'heavy';
  const isLight = intensity === 'light';

  if (condition === 'clear') {
    return <WeatherSunGraphic className="weather-icon" />;
  }

  if (condition === 'rain' || condition === 'thunder') {
    const dropCount = isHeavy ? 5 : isLight ? 2 : 3;
    const drops = Array.from({ length: dropCount }, (_, index) => {
      const x = 18 + index * (28 / Math.max(dropCount - 1, 1));
      return (
        <line
          key={index}
          x1={x}
          y1={40}
          x2={x - 4}
          y2={50}
          stroke="#2d8ae3"
          strokeWidth={isHeavy ? 3.5 : 3}
          strokeLinecap="round"
        />
      );
    });

    return (
      <svg viewBox="0 0 64 64" className="weather-icon" aria-hidden="true">
        <ellipse cx="32" cy="24" rx="18" ry="10" fill="#94a3b8" />
        <ellipse cx="22" cy="28" rx="12" ry="8" fill="#cbd5e1" />
        <ellipse cx="42" cy="28" rx="12" ry="8" fill="#cbd5e1" />
        {drops}
        {condition === 'thunder' ? (
          <polygon
            points="34,34 40,44 36,44 42,54 30,42 34,42"
            fill="#facc15"
          />
        ) : null}
      </svg>
    );
  }

  if (condition === 'snow') {
    const flakeCount = isHeavy ? 5 : isLight ? 2 : 3;
    const flakes = Array.from({ length: flakeCount }, (_, index) => {
      const x = 18 + index * (28 / Math.max(flakeCount - 1, 1));
      return <circle key={index} cx={x} cy={48} r={isHeavy ? 3.5 : 3} fill="#e2e8f0" />;
    });

    return (
      <svg viewBox="0 0 64 64" className="weather-icon" aria-hidden="true">
        <ellipse cx="32" cy="24" rx="18" ry="10" fill="#cbd5e1" />
        {flakes}
      </svg>
    );
  }

  if (condition === 'fog') {
    return (
      <svg viewBox="0 0 64 64" className="weather-icon" aria-hidden="true">
        <line x1="12" y1="28" x2="52" y2="28" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" />
        <line x1="16" y1="36" x2="48" y2="36" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
        <line x1="20" y1="44" x2="44" y2="44" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
        {intensity === 'moderate' ? (
          <line x1="14" y1="52" x2="50" y2="52" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
        ) : null}
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" className="weather-icon" aria-hidden="true">
      <ellipse cx="32" cy="24" rx="18" ry="10" fill="#94a3b8" />
      <ellipse cx="22" cy="28" rx="12" ry="8" fill="#cbd5e1" />
      <ellipse cx="42" cy="28" rx="12" ry="8" fill="#cbd5e1" />
      <ellipse cx="32" cy="30" rx="16" ry="9" fill="#e2e8f0" />
    </svg>
  );
};

export const WeatherVisual = ({
  condition,
  temperature,
  humidity,
  intensity,
  windSpeed,
  windGust,
  windDirection,
  label,
  compact = false,
  animated = false,
}: WeatherVisualProps) => {
  const { t } = useTranslation();
  const useAnimatedScene = animated && !compact;
  const windCompass = degreesToCompass(windDirection);
  const showIntensityLabel =
    !compact && intensity && precipitationConditions.has(condition);
  const conditionLabelKey = showIntensityLabel
    ? `analytics.marketWeather.conditionsWithIntensity.${condition}.${intensity}`
    : `analytics.marketWeather.conditions.${condition}`;

  return (
    <article
      className={[
        'weather-visual',
        `weather-visual-${condition}`,
        intensity ? `weather-visual--intensity-${intensity}` : '',
        animated ? 'weather-visual--animated' : 'weather-visual--static',
        compact ? 'weather-visual-compact' : 'weather-visual-hero',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="weather-visual-media">
        {useAnimatedScene ? (
          <WeatherAnimatedScene
            condition={condition}
            intensity={intensity}
            windSpeed={windSpeed}
            windDirection={windDirection}
            animated
          />
        ) : (
          <WeatherIconStatic condition={condition} intensity={intensity} />
        )}
      </div>

      <div className="weather-visual-copy">
        <span className="metric-label">{label}</span>
        <strong className="weather-visual-temperature">{temperature}°C</strong>
        {!compact && humidity !== undefined ? (
          <p className="weather-visual-meta">
            {t('analytics.marketWeather.humidity', { value: humidity })}
          </p>
        ) : null}
        {!compact && windSpeed !== undefined && windSpeed > 0 ? (
          <p className="weather-visual-meta">
            {windCompass
              ? t('analytics.marketWeather.windWithDirection', {
                  speed: windSpeed,
                  direction: t(`analytics.marketWeather.compass.${windCompass}`),
                })
              : t('analytics.marketWeather.wind', { speed: windSpeed })}
            {windGust !== undefined && windGust > windSpeed
              ? t('analytics.marketWeather.windGust', { speed: windGust })
              : ''}
          </p>
        ) : null}
        {!compact ? (
          <p className="weather-visual-meta">
            {t(conditionLabelKey, {
              defaultValue: t(`analytics.marketWeather.conditions.${condition}`, {
                defaultValue: condition,
              }),
            })}
          </p>
        ) : null}
      </div>
    </article>
  );
};