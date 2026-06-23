import { getWeatherLocationPreset } from '../../../shared/config/default-weather-location';
import type { DashboardPreferences, WeatherLocationPreset } from '../../../entities/settings/model/types';

export type DashboardWidgetOverrides = Partial<{
  contentVisible: boolean;
  hiddenCurrencies: string[];
  hiddenProviders: string[];
  exchangeRatesEnabled: boolean;
  weatherEnabled: boolean;
  weatherAnimationEnabled: boolean;
  weatherLocation: WeatherLocationPreset;
  forecastView: DashboardPreferences['defaultForecastView'];
}>;

export const dashboardWidgetOverridesStorageKey =
  'project-goods.dashboard-widget-overrides';

export const getStoredDashboardWidgetOverrides = (): DashboardWidgetOverrides => {
  try {
    const raw = window.localStorage.getItem(dashboardWidgetOverridesStorageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DashboardWidgetOverrides;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const storeDashboardWidgetOverrides = (overrides: DashboardWidgetOverrides) => {
  try {
    window.localStorage.setItem(
      dashboardWidgetOverridesStorageKey,
      JSON.stringify(overrides),
    );
  } catch {
    // Ignore localStorage write errors.
  }
};

export type EffectiveDashboardWidgetSettings = {
  marketWeatherEnabled: boolean;
  contentVisible: boolean;
  exchangeRatesEnabled: boolean;
  weatherEnabled: boolean;
  weatherAnimationEnabled: boolean;
  weatherLocation: WeatherLocationPreset;
  weatherProvider: DashboardPreferences['weatherProvider'];
  openWeatherApiKey: string;
  currencies: string[];
  rateProviders: DashboardPreferences['rateProviders'];
  forecastView: DashboardPreferences['defaultForecastView'];
};

export const getEffectiveDashboardWidgetSettings = (
  preferences: DashboardPreferences,
  overrides: DashboardWidgetOverrides = getStoredDashboardWidgetOverrides(),
): EffectiveDashboardWidgetSettings => {
  const hiddenCurrencies = new Set(
    (overrides.hiddenCurrencies ?? []).map((currency) => currency.toUpperCase()),
  );
  const hiddenProviders = new Set(overrides.hiddenProviders ?? []);

  return {
    marketWeatherEnabled: preferences.marketWeatherEnabled,
    contentVisible: overrides.contentVisible ?? true,
    exchangeRatesEnabled:
      overrides.exchangeRatesEnabled ?? preferences.exchangeRatesEnabled,
    weatherEnabled: overrides.weatherEnabled ?? preferences.weatherEnabled,
    weatherAnimationEnabled:
      overrides.weatherAnimationEnabled ?? preferences.weatherAnimationEnabled,
    weatherLocation: getWeatherLocationPreset(
      overrides.weatherLocation ?? preferences.defaultWeatherLocation,
    ),
    weatherProvider: preferences.weatherProvider,
    openWeatherApiKey: preferences.openWeatherApiKey,
    currencies: preferences.currencies.filter(
      (currency) => !hiddenCurrencies.has(currency.toUpperCase()),
    ),
    rateProviders: preferences.rateProviders.filter(
      (provider) => !hiddenProviders.has(provider),
    ),
    forecastView: overrides.forecastView ?? preferences.defaultForecastView,
  };
};