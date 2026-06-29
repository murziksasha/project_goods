import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as marketApi from '../../../../entities/market/api/marketApi';
import * as weatherApi from '../../../../entities/weather/api/weatherApi';
import { createDefaultSettingsForm } from '../../../../entities/settings/model/printForms';
import { dashboardWidgetOverridesStorageKey } from '../../model/dashboard-widget-settings';
import i18n from '../../../../shared/i18n/config';
import { MarketWeatherWidget } from './MarketWeatherWidget';

vi.mock('../../../../entities/market/api/marketApi', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../../../entities/market/api/marketApi')
  >();
  return { ...actual };
});

vi.mock('../../../../entities/weather/api/weatherApi', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../../../entities/weather/api/weatherApi')
  >();
  return { ...actual };
});

const marketRatesFixture = [
  {
    currency: 'USD',
    provider: 'nbu',
    official: 41.2,
    fetchedAt: '2026-06-23T12:00:00.000Z',
  },
];

const weatherFixture = {
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
};

const restoreQueryMocks = () => {
  vi.spyOn(marketApi, 'useMarketRatesQuery').mockReturnValue({
    data: marketRatesFixture,
    isLoading: false,
    isFetching: false,
    isError: false,
  } as unknown as ReturnType<typeof marketApi.useMarketRatesQuery>);

  vi.spyOn(weatherApi, 'useWeatherForecastQuery').mockReturnValue({
    data: weatherFixture,
    isLoading: false,
    isFetching: false,
    isError: false,
  } as unknown as ReturnType<typeof weatherApi.useWeatherForecastQuery>);
};

beforeEach(() => {
  vi.restoreAllMocks();
  restoreQueryMocks();
});

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
      <I18nextProvider i18n={i18n}>
        <MarketWeatherWidget
          dashboardPreferences={createDefaultSettingsForm().dashboardPreferences}
        />
      </I18nextProvider>
    </QueryClientProvider>,
  );
};

describe('MarketWeatherWidget', () => {
  it('shows widget body by default', () => {
    renderWidget();

    expect(
      screen.getByRole('button', { name: 'Collapse Market & weather widget' }),
    ).toBeTruthy();
    expect(document.getElementById('market-weather-widget-body')).toBeTruthy();
  });

  it('collapses and expands when the Live insights header is clicked', () => {
    renderWidget();

    const toggle = screen.getByRole('button', {
      name: 'Collapse Market & weather widget',
    });

    fireEvent.click(toggle);
    expect(document.getElementById('market-weather-widget-body')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Expand Market & weather widget' }),
    ).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Expand Market & weather widget' }));
    expect(document.getElementById('market-weather-widget-body')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Collapse Market & weather widget' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('persists collapsed state in localStorage', () => {
    renderWidget();

    fireEvent.click(
      screen.getByRole('button', { name: 'Collapse Market & weather widget' }),
    );

    const stored = JSON.parse(
      window.localStorage.getItem(dashboardWidgetOverridesStorageKey) ?? '{}',
    );
    expect(stored.collapsed).toBe(true);
  });

  it('shows refresh state when queries are fetching', () => {
    vi.spyOn(marketApi, 'useMarketRatesQuery').mockReturnValue({
      data: marketRatesFixture,
      isLoading: false,
      isFetching: true,
      isError: false,
    } as unknown as ReturnType<typeof marketApi.useMarketRatesQuery>);

    renderWidget();

    expect(screen.getAllByText('Refreshing data...').length).toBeGreaterThan(0);
  });
});