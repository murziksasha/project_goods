import { useTranslation } from 'react-i18next';
import { WeatherAnimatedScene } from './WeatherAnimatedScene';

type WeatherVisualProps = {
  condition: string;
  temperature: number;
  humidity?: number;
  label: string;
  compact?: boolean;
  animated?: boolean;
};

export const WeatherIconStatic = ({ condition }: { condition: string }) => {
  if (condition === 'clear') {
    return (
      <svg viewBox="0 0 64 64" className="weather-icon" aria-hidden="true">
        <circle cx="32" cy="32" r="14" fill="#f59e0b" />
        <g>
          {Array.from({ length: 8 }, (_, index) => {
            const angle = (index * Math.PI) / 4;
            const x1 = 32 + Math.cos(angle) * 18;
            const y1 = 32 + Math.sin(angle) * 18;
            const x2 = 32 + Math.cos(angle) * 24;
            const y2 = 32 + Math.sin(angle) * 24;
            return (
              <line
                key={index}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#f59e0b"
                strokeWidth="3"
                strokeLinecap="round"
              />
            );
          })}
        </g>
      </svg>
    );
  }

  if (condition === 'rain' || condition === 'thunder') {
    return (
      <svg viewBox="0 0 64 64" className="weather-icon" aria-hidden="true">
        <ellipse cx="32" cy="24" rx="18" ry="10" fill="#94a3b8" />
        <ellipse cx="22" cy="28" rx="12" ry="8" fill="#cbd5e1" />
        <ellipse cx="42" cy="28" rx="12" ry="8" fill="#cbd5e1" />
        <line x1="24" y1="40" x2="20" y2="50" stroke="#2d8ae3" strokeWidth="3" strokeLinecap="round" />
        <line x1="32" y1="42" x2="28" y2="54" stroke="#2d8ae3" strokeWidth="3" strokeLinecap="round" />
        <line x1="40" y1="40" x2="36" y2="50" stroke="#2d8ae3" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  if (condition === 'snow') {
    return (
      <svg viewBox="0 0 64 64" className="weather-icon" aria-hidden="true">
        <ellipse cx="32" cy="24" rx="18" ry="10" fill="#cbd5e1" />
        <circle cx="24" cy="46" r="3" fill="#e2e8f0" />
        <circle cx="32" cy="50" r="3" fill="#e2e8f0" />
        <circle cx="40" cy="46" r="3" fill="#e2e8f0" />
      </svg>
    );
  }

  if (condition === 'fog') {
    return (
      <svg viewBox="0 0 64 64" className="weather-icon" aria-hidden="true">
        <line x1="12" y1="28" x2="52" y2="28" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" />
        <line x1="16" y1="36" x2="48" y2="36" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
        <line x1="20" y1="44" x2="44" y2="44" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
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
  label,
  compact = false,
  animated = false,
}: WeatherVisualProps) => {
  const { t } = useTranslation();
  const useAnimatedScene = animated && !compact;

  return (
    <article
      className={[
        'weather-visual',
        `weather-visual-${condition}`,
        animated ? 'weather-visual--animated' : 'weather-visual--static',
        compact ? 'weather-visual-compact' : 'weather-visual-hero',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {useAnimatedScene ? (
        <WeatherAnimatedScene condition={condition} animated />
      ) : (
        <WeatherIconStatic condition={condition} />
      )}

      <div className="weather-visual-copy">
        <span className="metric-label">{label}</span>
        <strong className="weather-visual-temperature">{temperature}°C</strong>
        {!compact && humidity !== undefined ? (
          <p className="weather-visual-meta">
            {t('analytics.marketWeather.humidity', { value: humidity })}
          </p>
        ) : null}
        {!compact ? (
          <p className="weather-visual-meta">
            {t(`analytics.marketWeather.conditions.${condition}`, {
              defaultValue: condition,
            })}
          </p>
        ) : null}
      </div>
    </article>
  );
};