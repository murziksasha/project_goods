import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSettingsForm } from '../../../../entities/settings/model/printForms';
import type { Sale } from '../../../../entities/sale/model/types';
import i18n from '../../../../shared/i18n/config';
import { AnalyticsHeroSection } from './AnalyticsHeroSection';

vi.mock('../../../../entities/analytics/api/analyticsApi', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../../../entities/analytics/api/analyticsApi')
  >();
  return {
    ...actual,
    useDashboardAnalyticsQuery: () => ({
      data: undefined,
      isLoading: false,
    }),
  };
});

vi.mock('../weather/MarketWeatherWidget', () => ({
  MarketWeatherWidget: () => <div>Market & weather</div>,
}));

const sale = (overrides: Partial<Sale> = {}): Sale =>
  ({
    id: 's1',
    recordNumber: null,
    saleDate: '2026-08-10T10:00:00.000Z',
    quantity: 1,
    salePrice: 120,
    kind: 'sale',
    status: 'paid',
    paidAmount: 120,
    note: '',
    timeline: [],
    paymentHistory: [
      {
        id: 'p1',
        type: 'deposit',
        paymentMethod: 'cash',
        amount: 120,
        cashboxId: 'c1',
        cashboxName: 'Cash',
        author: 'A',
        createdAt: '2026-08-10T10:00:00.000Z',
      },
    ],
    lineItems: [
      {
        id: 'i1',
        kind: 'product',
        productId: 'p1',
        name: 'Screen',
        price: 120,
        quantity: 1,
        warrantyPeriod: 0,
      },
    ],
    client: { id: 'c1', name: 'Client', phone: '', status: 'new' },
    product: { id: 'p1', article: 'A1', name: 'Screen', serialNumber: 'S1' },
    manager: null,
    master: null,
    issuedBy: null,
    createdAt: '2026-08-10T10:00:00.000Z',
    updatedAt: '2026-08-10T10:00:00.000Z',
    ...overrides,
  }) as Sale;

afterEach(() => {
  cleanup();
});

const renderHero = (marketWeatherEnabled = true) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const preferences = {
    ...createDefaultSettingsForm().dashboardPreferences,
    marketWeatherEnabled,
  };
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <AnalyticsHeroSection
          sales={[sale()]}
          orders={[
            sale({
              id: 'r1',
              kind: 'repair',
              status: 'waitingParts',
              salePrice: 80,
              paidAmount: 20,
              lineItems: [
                {
                  id: 'i2',
                  kind: 'service',
                  serviceId: 's1',
                  name: 'Diagnostics',
                  price: 80,
                  quantity: 1,
                  warrantyPeriod: 0,
                },
              ],
              paymentHistory: [
                {
                  id: 'p2',
                  type: 'deposit',
                  paymentMethod: 'non-cash',
                  amount: 20,
                  cashboxId: 'c2',
                  cashboxName: 'Card',
                  author: 'A',
                  createdAt: '2026-08-11T10:00:00.000Z',
                },
              ],
            }),
          ]}
          products={[]}
          isSalesLoading={false}
          isSeeding={false}
          canEraseAllData={false}
          statsPeriod="currentMonth"
          analyticsDateRange={null}
          draftAnalyticsDateRange={{ dateFrom: '', dateTo: '' }}
          isAnalyticsDateFilterOpen={false}
          dashboardPreferences={preferences}
          onStatsPeriodChange={() => undefined}
          onDraftAnalyticsDateRangeChange={() => undefined}
          onAnalyticsDateFilterOpenChange={() => undefined}
          onApplyAnalyticsDateRange={() => undefined}
          onClearAnalyticsDateRange={() => undefined}
          onSeed={() => undefined}
        />
      </I18nextProvider>
    </QueryClientProvider>,
  );
};

describe('AnalyticsHeroSection', () => {
  it('renders billed, collected, funnel and today strip', () => {
    renderHero();
    expect(screen.getAllByText(i18n.t('analytics.summary.billed')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(i18n.t('analytics.summary.collected')).length).toBeGreaterThan(0);
    expect(screen.getByText(i18n.t('analytics.funnel.title'))).toBeTruthy();
    expect(screen.getByLabelText(i18n.t('analytics.todayStrip'))).toBeTruthy();
    expect(screen.getByText('Market & weather')).toBeTruthy();
    expect(screen.getByText('UAH 200')).toBeTruthy();
  });

  it('keeps weather hidden when the preference is off', () => {
    renderHero(false);
    expect(screen.queryByText('Market & weather')).toBeNull();
    expect(screen.getByText(i18n.t('analytics.businessPerformance'))).toBeTruthy();
  });
});
