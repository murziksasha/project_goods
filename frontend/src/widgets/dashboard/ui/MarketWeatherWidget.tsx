import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { DashboardPreferences } from '../../../entities/settings/model/types';
import { useMarketRatesQuery } from '../../../entities/market/api/marketApi';
import { useWeatherForecastQuery } from '../../../entities/weather/api/weatherApi';
import { queryKeys } from '../../../shared/api/queryClient';
import {
  getEffectiveDashboardWidgetSettings,
  getStoredDashboardWidgetOverrides,
  type DashboardWidgetOverrides,
} from '../model/dashboard-widget-settings';
import { resolveWeatherLocation } from '../../../shared/config/default-weather-location';
import { useDeviceCoordinates } from '../model/useWeatherForecast';
import { MarketWeatherLoader } from './MarketWeatherLoader';
import { MarketWeatherSettingsDrawer } from './MarketWeatherSettingsDrawer';
import { WeatherVisual } from './WeatherVisual';

type MarketWeatherWidgetProps = {
  dashboardPreferences: DashboardPreferences;
};

const formatRate = (value?: number) =>
  value !== undefined ? value.toFixed(2) : '—';

const getCurrencyAccent = (currency: string, kind: 'official' | 'buy' | 'sell') => {
  if (currency === 'USD') {
    if (kind === 'official') return '#2d8ae3';
    if (kind === 'buy') return '#0ea47d';
    return '#f97316';
  }
  if (currency === 'EUR') return '#14b8a6';
  return '#64748b';
};

export const MarketWeatherWidget = ({
  dashboardPreferences,
}: MarketWeatherWidgetProps) => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [overrides, setOverrides] = useState<DashboardWidgetOverrides>(
    getStoredDashboardWidgetOverrides,
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const settings = useMemo(
    () => getEffectiveDashboardWidgetSettings(dashboardPreferences, overrides),
    [dashboardPreferences, overrides],
  );

  const weatherLocation = useMemo(
    () => resolveWeatherLocation(settings.weatherLocation),
    [settings.weatherLocation],
  );
  const coordinates = useDeviceCoordinates(weatherLocation);

  const ratesQuery = useMarketRatesQuery({
    providers: settings.rateProviders,
    currencies: settings.currencies,
    enabled: settings.exchangeRatesEnabled,
  });

  const weatherQuery = useWeatherForecastQuery({
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    provider: settings.weatherProvider,
    openWeatherApiKey: settings.openWeatherApiKey,
    enabled:
      settings.weatherEnabled &&
      (settings.weatherProvider !== 'openweather' || Boolean(settings.openWeatherApiKey)),
  });

  const quotesByCurrency = useMemo(() => {
    const map = new Map<string, typeof ratesQuery.data>();
    (ratesQuery.data ?? []).forEach((quote) => {
      const current = map.get(quote.currency) ?? [];
      current.push(quote);
      map.set(quote.currency, current);
    });
    return map;
  }, [ratesQuery.data]);

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.marketRates }),
      queryClient.invalidateQueries({ queryKey: queryKeys.weatherForecast }),
    ]);
  };

  const dayFormatter = new Intl.DateTimeFormat(
    i18n.language?.startsWith('uk') ? 'uk-UA' : 'en-US',
    { weekday: 'short', day: 'numeric' },
  );

  const selectedForecast =
    settings.forecastView === 'tomorrow'
      ? weatherQuery.data?.tomorrow
      : weatherQuery.data?.current;

  const isRatesFetching =
    settings.exchangeRatesEnabled && (ratesQuery.isFetching || ratesQuery.isLoading);
  const isWeatherFetching =
    settings.weatherEnabled &&
    (settings.weatherProvider !== 'openweather' || Boolean(settings.openWeatherApiKey)) &&
    (weatherQuery.isFetching || weatherQuery.isLoading);
  const isRefreshing = isRatesFetching || isWeatherFetching;
  const showInitialRatesLoader =
    settings.exchangeRatesEnabled && ratesQuery.isLoading && !ratesQuery.data;
  const showInitialWeatherLoader =
    settings.weatherEnabled &&
    (settings.weatherProvider !== 'openweather' || Boolean(settings.openWeatherApiKey)) &&
    weatherQuery.isLoading &&
    !weatherQuery.data;
  const showRefreshOverlay =
    isRefreshing && !showInitialRatesLoader && !showInitialWeatherLoader;
  const isContentVisible = settings.contentVisible;

  return (
    <section
      className={
        isRefreshing
          ? 'market-weather-widget market-weather-widget-refreshing'
          : 'market-weather-widget'
      }
      aria-live="polite"
      aria-busy={isRefreshing}
    >
      <div className="market-weather-widget-header">
        <div>
          <p className="section-label">{t('analytics.marketWeather.sectionLabel')}</p>
          {isContentVisible ? <h2>{t('analytics.marketWeather.title')}</h2> : null}
        </div>
        <div className="market-weather-widget-actions">
          {isContentVisible ? (
            <button
              type="button"
              className={
                isRefreshing
                  ? 'toolbar-filter-button market-weather-refresh-button market-weather-refresh-button-active'
                  : 'toolbar-filter-button market-weather-refresh-button'
              }
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              aria-busy={isRefreshing}
            >
              <span
                className={
                  isRefreshing
                    ? 'market-weather-refresh-button-icon market-weather-refresh-button-icon-spinning'
                    : 'market-weather-refresh-button-icon'
                }
                aria-hidden="true"
              >
                ↻
              </span>
              {isRefreshing
                ? t('analytics.marketWeather.refreshing')
                : t('analytics.marketWeather.refresh')}
            </button>
          ) : null}
          <button
            type="button"
            className="toolbar-filter-button"
            aria-expanded={isSettingsOpen}
            onClick={() => setIsSettingsOpen((current) => !current)}
          >
            {t('analytics.marketWeather.settings')}
          </button>
        </div>
      </div>

      <MarketWeatherSettingsDrawer
        isOpen={isSettingsOpen}
        preferences={dashboardPreferences}
        overrides={overrides}
        onOverridesChange={setOverrides}
        onClose={() => setIsSettingsOpen(false)}
      />

      {isContentVisible ? (
      <div className="market-weather-widget-grid">
        {showRefreshOverlay ? (
          <MarketWeatherLoader
            overlay
            showRates={settings.exchangeRatesEnabled}
            showWeather={settings.weatherEnabled}
          />
        ) : null}

        {settings.exchangeRatesEnabled ? (
          <div className="market-weather-rates-panel">
            <h3>{t('analytics.marketWeather.exchangeRates')}</h3>
            {showInitialRatesLoader ? (
              <MarketWeatherLoader showRates showWeather={false} />
            ) : ratesQuery.isError ? (
              <p className="empty-state">{t('analytics.marketWeather.ratesUnavailable')}</p>
            ) : (
              <div className="market-weather-rate-strip">
                {settings.currencies.map((currency) => {
                  const quotes = quotesByCurrency.get(currency) ?? [];
                  return (
                    <article key={currency} className={`market-weather-rate-card market-weather-rate-card-${currency.toLowerCase()}`}>
                      <div className="market-weather-rate-card-header">
                        <strong>{currency}</strong>
                        <span>{t('analytics.marketWeather.perUah')}</span>
                      </div>
                      {quotes.length === 0 ? (
                        <p className="market-weather-rate-empty">
                          {t('analytics.marketWeather.noQuotes')}
                        </p>
                      ) : (
                        quotes.map((quote) => (
                          <div key={`${currency}-${quote.provider}`} className="market-weather-rate-provider">
                            <span className="metric-label">
                              {t(`analytics.marketWeather.providerLabels.${quote.provider}`)}
                            </span>
                            {quote.official !== undefined ? (
                              <p>
                                <span>{t('analytics.marketWeather.official')}</span>
                                <strong style={{ color: getCurrencyAccent(currency, 'official') }}>
                                  {formatRate(quote.official)}
                                </strong>
                              </p>
                            ) : null}
                            {quote.buy !== undefined ? (
                              <p>
                                <span>{t('analytics.marketWeather.buy')}</span>
                                <strong style={{ color: getCurrencyAccent(currency, 'buy') }}>
                                  {formatRate(quote.buy)}
                                </strong>
                              </p>
                            ) : null}
                            {quote.sell !== undefined ? (
                              <p>
                                <span>{t('analytics.marketWeather.sell')}</span>
                                <strong style={{ color: getCurrencyAccent(currency, 'sell') }}>
                                  {formatRate(quote.sell)}
                                </strong>
                              </p>
                            ) : null}
                          </div>
                        ))
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {settings.weatherEnabled ? (
          <div className="market-weather-weather-panel">
            <h3>{t('analytics.marketWeather.weatherForecast')}</h3>
            {coordinates.usedFallback ? (
              <p className="market-weather-location-hint">
                {coordinates.usedLanFallback
                  ? t('analytics.marketWeather.usingDefaultLocationLan', {
                      location: coordinates.locationLabel,
                    })
                  : t('analytics.marketWeather.usingDefaultLocation', {
                      location: coordinates.locationLabel,
                    })}
              </p>
            ) : null}
            {showInitialWeatherLoader ? (
              <MarketWeatherLoader showRates={false} showWeather />
            ) : weatherQuery.isError || !weatherQuery.data ? (
              <p className="empty-state">{t('analytics.marketWeather.weatherUnavailable')}</p>
            ) : (
              <>
                {selectedForecast ? (
                  <WeatherVisual
                    condition={selectedForecast.condition}
                    temperature={selectedForecast.temperature}
                    humidity={selectedForecast.humidity}
                    label={t(`analytics.marketWeather.views.${settings.forecastView}`)}
                    animated={settings.weatherAnimationEnabled}
                  />
                ) : null}

                {settings.forecastView === 'fiveDay' ? (
                  <div className="market-weather-forecast-strip">
                    {weatherQuery.data.daily.map((day) => (
                      <WeatherVisual
                        key={day.date}
                        condition={day.condition}
                        temperature={day.temperature}
                        humidity={day.humidity}
                        label={dayFormatter.format(new Date(`${day.date}T12:00:00`))}
                        compact
                        animated={false}
                      />
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>
      ) : null}
    </section>
  );
};