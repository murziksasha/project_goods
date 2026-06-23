import { useTranslation } from 'react-i18next';
import type { DashboardPreferences } from '../../../entities/settings/model/types';
import {
  storeDashboardWidgetOverrides,
  type DashboardWidgetOverrides,
} from '../model/dashboard-widget-settings';
import { WeatherAnimatedScene } from './WeatherAnimatedScene';
import { WeatherIconStatic } from './WeatherVisual';

type MarketWeatherSettingsDrawerProps = {
  isOpen: boolean;
  preferences: DashboardPreferences;
  overrides: DashboardWidgetOverrides;
  onOverridesChange: (overrides: DashboardWidgetOverrides) => void;
  onClose: () => void;
};

const toggleListItem = <T extends string>(items: T[], value: T) =>
  items.includes(value) ? items.filter((item) => item !== value) : [...items, value];

const PREVIEW_CONDITION = 'rain';

export const MarketWeatherSettingsDrawer = ({
  isOpen,
  preferences,
  overrides,
  onOverridesChange,
  onClose,
}: MarketWeatherSettingsDrawerProps) => {
  const { t } = useTranslation();

  const hiddenCurrencies = overrides.hiddenCurrencies ?? [];
  const hiddenProviders = overrides.hiddenProviders ?? [];
  const contentVisible = overrides.contentVisible ?? true;
  const weatherAnimationEnabled =
    overrides.weatherAnimationEnabled ?? preferences.weatherAnimationEnabled;

  const updateOverrides = (next: DashboardWidgetOverrides) => {
    onOverridesChange(next);
    storeDashboardWidgetOverrides(next);
  };

  const resetOverrides = () => {
    onOverridesChange({});
    storeDashboardWidgetOverrides({});
  };

  if (!isOpen) return null;

  return (
    <section className="market-weather-settings-drawer" aria-label={t('analytics.marketWeather.settingsTitle')}>
      <div className="market-weather-settings-header">
        <h3>{t('analytics.marketWeather.settingsTitle')}</h3>
        <button
          type="button"
          className="orders-filter-panel-close"
          aria-label={t('analytics.marketWeather.closeSettings')}
          onClick={onClose}
        >
          &times;
        </button>
      </div>

      <label className="market-weather-toggle market-weather-toggle-primary">
        <input
          type="checkbox"
          checked={contentVisible}
          onChange={(event) =>
            updateOverrides({
              ...overrides,
              contentVisible: event.target.checked,
            })
          }
        />
        <span>{t('analytics.marketWeather.showWidgetContent')}</span>
      </label>

      {contentVisible ? (
        <>
          <label className="market-weather-toggle">
            <input
              type="checkbox"
              checked={overrides.exchangeRatesEnabled ?? preferences.exchangeRatesEnabled}
              onChange={(event) =>
                updateOverrides({
                  ...overrides,
                  exchangeRatesEnabled: event.target.checked,
                })
              }
            />
            <span>{t('analytics.marketWeather.showExchangeRates')}</span>
          </label>

          <div className="market-weather-settings-group">
            <span className="metric-label">{t('analytics.marketWeather.currencies')}</span>
            <div className="market-weather-chip-row">
              {preferences.currencies.map((currency) => {
                const isHidden = hiddenCurrencies.includes(currency);
                return (
                  <button
                    key={currency}
                    type="button"
                    className={isHidden ? 'market-weather-chip' : 'market-weather-chip market-weather-chip-active'}
                    onClick={() =>
                      updateOverrides({
                        ...overrides,
                        hiddenCurrencies: toggleListItem(hiddenCurrencies, currency),
                      })
                    }
                  >
                    {currency}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="market-weather-settings-group">
            <span className="metric-label">{t('analytics.marketWeather.providers')}</span>
            <div className="market-weather-chip-row">
              {preferences.rateProviders.map((provider) => {
                const isHidden = hiddenProviders.includes(provider);
                return (
                  <button
                    key={provider}
                    type="button"
                    className={isHidden ? 'market-weather-chip' : 'market-weather-chip market-weather-chip-active'}
                    onClick={() =>
                      updateOverrides({
                        ...overrides,
                        hiddenProviders: toggleListItem(hiddenProviders, provider),
                      })
                    }
                  >
                    {t(`analytics.marketWeather.providerLabels.${provider}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="market-weather-toggle">
            <input
              type="checkbox"
              checked={overrides.weatherEnabled ?? preferences.weatherEnabled}
              onChange={(event) =>
                updateOverrides({
                  ...overrides,
                  weatherEnabled: event.target.checked,
                })
              }
            />
            <span>{t('analytics.marketWeather.showWeather')}</span>
          </label>

          <div className="market-weather-animation-setting">
            <label className="market-weather-toggle">
              <input
                type="checkbox"
                checked={weatherAnimationEnabled}
                onChange={(event) =>
                  updateOverrides({
                    ...overrides,
                    weatherAnimationEnabled: event.target.checked,
                  })
                }
              />
              <span>{t('analytics.marketWeather.weatherAnimation')}</span>
            </label>

            <div className="market-weather-animation-preview">
              <div className="market-weather-animation-preview-static">
                <span className="metric-label">{t('analytics.marketWeather.animationOff')}</span>
                <div className="market-weather-animation-preview-box market-weather-animation-preview-box-static">
                  <WeatherIconStatic condition="clear" />
                </div>
              </div>
              <div
                className={
                  weatherAnimationEnabled
                    ? 'market-weather-animation-preview-live market-weather-animation-preview-live-on'
                    : 'market-weather-animation-preview-live market-weather-animation-preview-live-off'
                }
              >
                <span className="metric-label">{t('analytics.marketWeather.animationOn')}</span>
                <div className="market-weather-animation-preview-box">
                  <WeatherAnimatedScene condition={PREVIEW_CONDITION} compact animated />
                </div>
              </div>
            </div>
          </div>

          <label className="market-weather-field">
            <span>{t('analytics.marketWeather.forecastView')}</span>
            <select
              value={overrides.forecastView ?? preferences.defaultForecastView}
              onChange={(event) =>
                updateOverrides({
                  ...overrides,
                  forecastView: event.target.value as DashboardPreferences['defaultForecastView'],
                })
              }
            >
              <option value="today">{t('analytics.marketWeather.views.today')}</option>
              <option value="tomorrow">{t('analytics.marketWeather.views.tomorrow')}</option>
              <option value="fiveDay">{t('analytics.marketWeather.views.fiveDay')}</option>
            </select>
          </label>
        </>
      ) : null}

      <div className="market-weather-settings-actions">
        <button type="button" className="toolbar-filter-button" onClick={resetOverrides}>
          {t('analytics.marketWeather.resetOverrides')}
        </button>
      </div>
    </section>
  );
};