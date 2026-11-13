import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfitMarginRow } from '../../../../entities/finance';
import i18n from '../../../../shared/i18n/config';
import { AccountingProfitCharts } from './AccountingProfitCharts';

vi.mock('../../../../entities/finance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../entities/finance')>();
  return {
    ...actual,
    useFinanceCategoriesQuery: () => ({
      data: [],
      isLoading: false,
      isError: false,
    }),
  };
});

const renderWithProviders = (ui: ReactElement) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false } },
        })
      }
    >
      <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
    </QueryClientProvider>,
  );

const sampleRows: ProfitMarginRow[] = [
  {
    key: 'product:p1',
    name: 'Battery',
    type: 'product',
    quantity: 2,
    cost: 100,
    revenue: 300,
    knownCostRevenue: 300,
    profit: 200,
    marginPct: 66.7,
    costKnown: true,
    knownCount: 1,
    unknownCount: 0,
    catalogProductId: 'cp1',
    serviceId: null,
  },
  {
    key: 'service:s1',
    name: 'Screen replacement',
    type: 'service',
    quantity: 3,
    cost: 0,
    revenue: 400,
    knownCostRevenue: 0,
    profit: 0,
    marginPct: null,
    costKnown: false,
    knownCount: 0,
    unknownCount: 1,
    catalogProductId: null,
    serviceId: 's1',
  },
];

describe('AccountingProfitCharts Mix card', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    cleanup();
  });

  it('explains uncosted service revenue on Profit and lets user switch Mix to Revenue', () => {
    const onMetricChange = vi.fn();
    const { rerender } = renderWithProviders(
      <AccountingProfitCharts
        rows={sampleRows}
        chartMetric='profit'
        onChartMetricChange={onMetricChange}
        currency='UAH'
        cash={{
          collected: 700,
          inventoryPurchases: 100,
          opex: 0,
          refunds: 0,
          net: 600,
        }}
      />,
    );

    expect(screen.getByText(/Product: 100% · 200\.00 UAH/)).toBeInTheDocument();
    expect(screen.getByText(/Service: 0% · 0\.00 UAH/)).toBeInTheDocument();
    expect(
      screen.getByText(/Missing cost revenue: 400\.00 UAH \(not in known profit\)/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Revenue' }));
    expect(onMetricChange).toHaveBeenCalledWith('revenue');

    rerender(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <I18nextProvider i18n={i18n}>
          <AccountingProfitCharts
            rows={sampleRows}
            chartMetric='revenue'
            onChartMetricChange={onMetricChange}
            currency='UAH'
            cash={{
              collected: 700,
              inventoryPurchases: 100,
              opex: 0,
              refunds: 0,
              net: 600,
            }}
          />
        </I18nextProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByText(/Product: 43% · 300\.00 UAH/)).toBeInTheDocument();
    expect(screen.getByText(/Service: 57% · 400\.00 UAH/)).toBeInTheDocument();
    expect(screen.queryByText(/Missing cost revenue:/)).not.toBeInTheDocument();
  });

  it('offers one-click Switch to Revenue when all filtered rows have unknown costs', () => {
    const onMetricChange = vi.fn();
    renderWithProviders(
      <AccountingProfitCharts
        rows={[sampleRows[1]!]}
        chartMetric='profit'
        onChartMetricChange={onMetricChange}
        currency='UAH'
        cash={{
          collected: 400,
          inventoryPurchases: 0,
          opex: 0,
          refunds: 0,
          net: 400,
        }}
      />,
    );

    expect(
      screen.getByText(/No known-cost profit to display \(400\.00 UAH in revenue has missing cost\)/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Revenue' }));
    expect(onMetricChange).toHaveBeenCalledWith('revenue');
  });
});
