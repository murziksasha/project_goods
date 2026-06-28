import { useTranslation } from 'react-i18next';

type MarketWeatherLoaderProps = {
  showRates: boolean;
  showWeather: boolean;
  overlay?: boolean;
};

export const MarketWeatherLoader = ({
  showRates,
  showWeather,
  overlay = false,
}: MarketWeatherLoaderProps) => {
  const { t } = useTranslation();

  return (
    <div
      className={
        overlay
          ? 'market-weather-loader market-weather-loader-overlay'
          : 'market-weather-loader'
      }
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={t('analytics.marketWeather.refreshing')}
    >
      {overlay ? <div className="market-weather-loader-scrim" aria-hidden="true" /> : null}

      <div className="market-weather-loader-content">
        <div className="market-weather-loader-spinner" aria-hidden="true">
          <span className="market-weather-loader-ring" />
          <span className="market-weather-loader-core" />
        </div>
        <p className="market-weather-loader-label">{t('analytics.marketWeather.refreshing')}</p>

        <div className="market-weather-loader-skeleton-grid">
          {showRates ? (
            <div className="market-weather-loader-skeleton-panel">
              <span className="market-weather-loader-skeleton-line market-weather-loader-skeleton-line-short" />
              <div className="market-weather-loader-skeleton-cards">
                <span className="market-weather-loader-skeleton-card" />
                <span className="market-weather-loader-skeleton-card" />
              </div>
            </div>
          ) : null}
          {showWeather ? (
            <div className="market-weather-loader-skeleton-panel">
              <span className="market-weather-loader-skeleton-line market-weather-loader-skeleton-line-short" />
              <div className="market-weather-loader-skeleton-weather">
                <span className="market-weather-loader-skeleton-icon" />
                <div className="market-weather-loader-skeleton-copy">
                  <span className="market-weather-loader-skeleton-line" />
                  <span className="market-weather-loader-skeleton-line market-weather-loader-skeleton-line-medium" />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};