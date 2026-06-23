import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSettingsForm } from '../../../entities/settings/model/printForms';
import { dashboardWidgetOverridesStorageKey } from '../model/dashboard-widget-settings';
import { MarketWeatherWidget } from './MarketWeatherWidget';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../../entities/market/api/marketApi', () => ({
  useMarketRatesQuery: () => ({
    data: [
      {
        currency: 'USD',
        provider: 'nbu',
        official: 41.2,
        fetchedAt: '2026-06-23T12:00:00.000Z',
      },
    ],
    isLoading: false,
    isFetching: false,
    isError: false,
  }),
}));

vi.mock('../../../entities/weather/api/weatherApi', () => ({
  useWeatherForecastQuery: () => ({
    data: {
      provider: 'open-meteo',
      latitude: 46.3013,
      longitude: 30.6531,
      fetchedAt: '2026-06-23T12:00:00.000Z',
      current: {
        date: '2026-06-23',
        temperature: 24,
        humidity: 60,
        weatherCode: 0,
        condition: 'clear',
      },
      daily: [],
    },
    isLoading: false,
    isFetching: false,
    isError: false,
  }),
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const renderWidget = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MarketWeatherWidget
        dashboardPreferences={createDefaultSettingsForm().dashboardPreferences}
      />
    </QueryClientProvider>,
  );
};

describe('MarketWeatherWidget', () => {
  it('shows widget body by default', () => {
    renderWidget();

    expect(screen.getByRole('button', { name: 'analytics.marketWeather.collapseWidget' })).toBeTruthy();
    expect(document.getElementById('market-weather-widget-body')).toBeTruthy();
  });

  it('collapses and expands when the Live insights header is clicked', () => {
    renderWidget();

    const toggle = screen.getByRole('button', {
      name: 'analytics.marketWeather.collapseWidget',
    });

    fireEvent.click(toggle);
    expect(document.getElementById('market-weather-widget-body')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'analytics.marketWeather.expandWidget' }),
    ).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(
      screen.getByRole('button', { name: 'analytics.marketWeather.expandWidget' }),
    );
    expect(document.getElementById('market-weather-widget-body')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'analytics.marketWeather.collapseWidget' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('persists collapsed state in localStorage', () => {
    renderWidget();

    fireEvent.click(
      screen.getByRole('button', { name: 'analytics.marketWeather.collapseWidget' }),
    );

    expect(
      JSON.parse(window.localStorage.getItem(dashboardWidgetOverridesStorageKey) ?? '{}'),
    ).toEqual({ collapsed: true });
  });

  it('does not collapse when Refresh or Settings is clicked', () => {
    renderWidget();

    fireEvent.click(screen.getByRole('button', { name: 'analytics.marketWeather.refresh' }));
    expect(document.getElementById('market-weather-widget-body')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'analytics.marketWeather.settings' }));
    expect(document.getElementById('market-weather-widget-body')).toBeTruthy();
  });
});