import { createDefaultSettingsForm } from './printForms';
import type { DashboardPreferences, RateProvider } from './types';

const rateProviders = new Set<RateProvider>(['nbu', 'privat', 'mono']);

export const normalizeDashboardPreferences = (
  value?: Partial<DashboardPreferences> | null,
): DashboardPreferences => {
  const defaults = createDefaultSettingsForm().dashboardPreferences;
  const source = value ?? {};

  const currencies = Array.isArray(source.currencies)
    ? source.currencies.map((currency) => String(currency).toUpperCase()).filter(Boolean)
    : defaults.currencies;

  const normalizedProviders = Array.isArray(source.rateProviders)
    ? source.rateProviders
        .map((provider) => String(provider).toLowerCase())
        .filter((provider): provider is RateProvider => rateProviders.has(provider as RateProvider))
    : defaults.rateProviders;

  return {
    marketWeatherEnabled: source.marketWeatherEnabled ?? defaults.marketWeatherEnabled,
    exchangeRatesEnabled: source.exchangeRatesEnabled ?? defaults.exchangeRatesEnabled,
    weatherEnabled: source.weatherEnabled ?? defaults.weatherEnabled,
    weatherAnimationEnabled:
      source.weatherAnimationEnabled ?? defaults.weatherAnimationEnabled,
    weatherProvider:
      source.weatherProvider === 'openweather' ? 'openweather' : 'open-meteo',
    openWeatherApiKey: source.openWeatherApiKey ?? defaults.openWeatherApiKey,
    currencies: currencies.length > 0 ? currencies : defaults.currencies,
    rateProviders:
      normalizedProviders.length > 0 ? normalizedProviders : defaults.rateProviders,
    defaultForecastView:
      source.defaultForecastView === 'tomorrow' ||
      source.defaultForecastView === 'fiveDay'
        ? source.defaultForecastView
        : defaults.defaultForecastView,
  };
};