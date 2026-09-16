import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FinanceProfitReport } from '../../../../entities/finance/model/types';
import i18n from '../../../../shared/i18n/config';
import { AccountingProfitReportsView } from './AccountingProfitReportsView';

const { report, exportMock } = vi.hoisted(() => {
  const report: FinanceProfitReport = {
    period: {
      key: 'whole',
      dateFrom: null,
      dateTo: null,
      timeZone: 'Europe/Kiev',
    },
    source: 'all',
    currency: 'UAH',
    otherCurrencies: [],
    margin: {
      revenue: 500,
      cogs: 200,
      grossProfit: 300,
      grossMarginPct: 60,
      unknownCostCount: 0,
    },
    cash: {
      collected: 500,
      inventoryPurchases: 100,
      opex: 50,
      refunds: 0,
      net: 350,
      opexByCategory: [{ category: 'rent', amount: 50, count: 1 }],
      operations: [
        {
          type: 'withdraw',
          category: 'rent',
          amount: 50,
          currency: 'UAH',
          note: 'Shop rent',
          transactionDate: '2026-09-01T10:00:00.000Z',
        },
      ],
    },
    rows: [
      {
        key: 'product:p1',
        name: 'Battery',
        type: 'product',
        quantity: 1,
        cost: 200,
        revenue: 500,
        profit: 300,
        marginPct: 60,
        costKnown: true,
      },
    ],
    dataScope: 'live_sales_only',
    coldSalesPurgedExist: false,
    saleCount: 1,
  };
  return { report, exportMock: vi.fn() };
});

vi.mock('../../model/profit-report', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../model/profit-report')>();
  return {
    ...actual,
    exportProfitReportWorkbook: (...args: unknown[]) => exportMock(...args),
  };
});

vi.mock('../../../../entities/finance/api/financeApi', () => ({
  useFinanceProfitReportQuery: () => ({
    data: report,
    isLoading: false,
    isError: false,
  }),
}));

const renderView = (ui: ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {ui}
    </QueryClientProvider>,
  );

describe('AccountingProfitReportsView', () => {
  beforeEach(async () => {
    exportMock.mockReset();
    window.localStorage.clear();
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders margin and cash KPIs and exports the current report', () => {
    renderView(
      <I18nextProvider i18n={i18n}>
        <AccountingProfitReportsView />
      </I18nextProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument();
    expect(screen.getByText('Battery')).toBeInTheDocument();
    expect(screen.getByText('Rent')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Services' }));
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export Excel' }));

    expect(exportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        report,
        filename: 'profit-report_all_all-time_all-time.xlsx',
      }),
    );
  });
});
