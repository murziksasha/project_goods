import { useTranslation } from 'react-i18next';
import type { DashboardPreferences, RateProvider } from '../../../../entities/settings/model/types';
import { StatusBadge } from '../../../../shared/ui/StatusBadge';

const AVAILABLE_CURRENCIES = ['USD', 'EUR', 'GBP', 'PLN'] as const;
const AVAILABLE_RATE_PROVIDERS: RateProvider[] = ['nbu', 'privat', 'mono'];

type DashboardSettingsSectionProps = {
  preferences: DashboardPreferences;
  onChange: (preferences: DashboardPreferences) => void;
};

const ToggleRow = ({
  checked,
  label,
  onChange,
  disabled,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) => (
  <label className="settings-toggle">
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
    />
    <span>{label}</span>
  </label>
);

export const DashboardSettingsSection = ({
  preferences,
  onChange,
}: DashboardSettingsSectionProps) => {
  const { t } = useTranslation();
  const ratesEnabled = preferences.exchangeRatesEnabled;
  const weatherEnabled = preferences.weatherEnabled;

  const toggleCurrency = (currency: string) => {
    if (!ratesEnabled) return;
    const next = preferences.currencies.includes(currency)
      ? preferences.currencies.filter((item) => item !== currency)
      : [...preferences.currencies, currency];
    onChange({ ...preferences, currencies: next.length > 0 ? next : [currency] });
  };

  const toggleProvider = (provider: RateProvider) => {
    if (!ratesEnabled) return;
    const next = preferences.rateProviders.includes(provider)
      ? preferences.rateProviders.filter((item) => item !== provider)
      : [...preferences.rateProviders, provider];
    onChange({
      ...preferences,
      rateProviders: next.length > 0 ? next : [provider],
    });
  };

  return (
    <section className="settings-section">
      <article className="settings-group">
        <div className="settings-group-header">
          <h3>{t('settings.dashboard.groups.widgets')}</h3>
          <p className="panel-subtitle">{t('settings.dashboard.subtitle')}</p>
        </div>
        <div className="settings-toggle-grid">
          <ToggleRow
            checked={preferences.marketWeatherEnabled}
            label={t('settings.dashboard.marketWeatherEnabled')}
            onChange={(marketWeatherEnabled) =>
              onChange({ ...preferences, marketWeatherEnabled })
            }
          />
          <ToggleRow
            checked={preferences.exchangeRatesEnabled}
            label={t('settings.dashboard.exchangeRatesEnabled')}
            onChange={(exchangeRatesEnabled) =>
              onChange({ ...preferences, exchangeRatesEnabled })
            }
          />
          <ToggleRow
            checked={preferences.weatherEnabled}
            label={t('settings.dashboard.weatherEnabled')}
            onChange={(nextWeatherEnabled) =>
              onChange({ ...preferences, weatherEnabled: nextWeatherEnabled })
            }
          />
        </div>
      </article>

      <article className="settings-group">
        <div className="settings-group-header">
          <h3>{t('settings.dashboard.groups.rates')}</h3>
        </div>
        <div className="form-grid">
          <div className="field field-wide">
            <span>{t('settings.dashboard.currencies')}</span>
            <div className="market-weather-chip-row">
              {AVAILABLE_CURRENCIES.map((currency) => (
                <button
                  key={currency}
                  type="button"
                  disabled={!ratesEnabled}
                  aria-pressed={preferences.currencies.includes(currency)}
                  className={
                    preferences.currencies.includes(currency)
                      ? 'market-weather-chip market-weather-chip-active'
                      : 'market-weather-chip'
                  }
                  onClick={() => toggleCurrency(currency)}
                >
                  {currency}
                </button>
              ))}
            </div>
          </div>
          <div className="field field-wide">
            <span>{t('settings.dashboard.rateProviders')}</span>
            <div className="market-weather-chip-row">
              {AVAILABLE_RATE_PROVIDERS.map((provider) => (
                <button
                  key={provider}
                  type="button"
                  disabled={!ratesEnabled}
                  aria-pressed={preferences.rateProviders.includes(provider)}
                  className={
                    preferences.rateProviders.includes(provider)
                      ? 'market-weather-chip market-weather-chip-active'
                      : 'market-weather-chip'
                  }
                  onClick={() => toggleProvider(provider)}
                >
                  {t(`analytics.marketWeather.providerLabels.${provider}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </article>

      <article className="settings-group">
        <div className="settings-group-header">
          <h3>{t('settings.dashboard.groups.weather')}</h3>
        </div>
        <div className="settings-toggle-grid">
          <ToggleRow
            checked={preferences.weatherAnimationEnabled}
            disabled={!weatherEnabled}
            label={t('settings.dashboard.weatherAnimationEnabled')}
            onChange={(weatherAnimationEnabled) =>
              onChange({ ...preferences, weatherAnimationEnabled })
            }
          />
        </div>
        <div className="form-grid">
          <label className="field field-wide">
            <span>{t('settings.dashboard.defaultWeatherLocation')}</span>
            <select
              value={preferences.defaultWeatherLocation}
              disabled={!weatherEnabled}
              onChange={(event) =>
                onChange({
                  ...preferences,
                  defaultWeatherLocation:
                    event.target.value as DashboardPreferences['defaultWeatherLocation'],
                })
              }
            >
              <option value="chornomorsk">
                {t('settings.dashboard.weatherLocations.chornomorsk')}
              </option>
              <option value="odesa">{t('settings.dashboard.weatherLocations.odesa')}</option>
            </select>
          </label>
          <p className="field field-wide settings-hint">
            {t('settings.dashboard.defaultWeatherHint')}
          </p>
          <label className="field">
            <span>{t('settings.dashboard.weatherProvider')}</span>
            <select
              value={preferences.weatherProvider}
              disabled={!weatherEnabled}
              onChange={(event) =>
                onChange({
                  ...preferences,
                  weatherProvider:
                    event.target.value as DashboardPreferences['weatherProvider'],
                })
              }
            >
              <option value="open-meteo">{t('settings.dashboard.providers.openMeteo')}</option>
              <option value="openweather">{t('settings.dashboard.providers.openWeather')}</option>
            </select>
          </label>
          <label className="field">
            <span>{t('settings.dashboard.defaultForecastView')}</span>
            <select
              value={preferences.defaultForecastView}
              disabled={!weatherEnabled}
              onChange={(event) =>
                onChange({
                  ...preferences,
                  defaultForecastView:
                    event.target.value as DashboardPreferences['defaultForecastView'],
                })
              }
            >
              <option value="today">{t('analytics.marketWeather.views.today')}</option>
              <option value="tomorrow">{t('analytics.marketWeather.views.tomorrow')}</option>
              <option value="fiveDay">{t('analytics.marketWeather.views.fiveDay')}</option>
            </select>
          </label>
          <div className="field field-wide">
            <span>{t('settings.dashboard.openWeatherApiKey')}</span>
            <StatusBadge
              tone={preferences.hasOpenWeatherApiKey ? 'success' : 'gray'}
              label={
                preferences.hasOpenWeatherApiKey
                  ? t('settings.dashboard.openWeatherApiKeyConfigured')
                  : t('settings.dashboard.openWeatherApiKeyServerOnly')
              }
            />
          </div>
        </div>
      </article>
    </section>
  );
};
