import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type {
  FinancePolicy,
  FinancePolicyHistoryResponse,
  FinancePolicyPreviewResponse,
} from '../../../../entities/finance';
import { ApiRequestError } from '../../../../shared/api/http';
import i18n from '../../../../shared/i18n/config';
import { AccountingPolicySettings } from './AccountingPolicySettings';

const {
  getPolicyMock,
  getHistoryMock,
  previewPolicyMock,
  updatePolicyMock,
} = vi.hoisted(() => ({
  getPolicyMock: vi.fn(),
  getHistoryMock: vi.fn(),
  previewPolicyMock: vi.fn(),
  updatePolicyMock: vi.fn(),
}));

vi.mock('../../../../shared/api/http', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../../shared/api/http')>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      get: vi.fn(async (url: string, config?: { params?: unknown }) => {
        if (url === '/finance/policy') {
          return { data: await getPolicyMock() };
        }
        if (url === '/finance/policy/history') {
          return { data: await getHistoryMock(config?.params) };
        }
        throw new Error(`Unexpected GET ${url}`);
      }),
      post: vi.fn(async (url: string, payload?: unknown) => {
        if (url === '/finance/policy/preview') {
          return { data: await previewPolicyMock(payload) };
        }
        throw new Error(`Unexpected POST ${url}`);
      }),
      patch: vi.fn(async (url: string, payload?: unknown) => {
        if (url === '/finance/policy') {
          return { data: await updatePolicyMock(payload) };
        }
        throw new Error(`Unexpected PATCH ${url}`);
      }),
    },
  };
});

const basePolicy = (
  overrides: Partial<FinancePolicy> = {},
): FinancePolicy => ({
  serviceAuditEnabled: false,
  serviceProfitMode: 'full',
  reportDefaults: {
    period: 'last30',
    source: 'all',
    showCharts: true,
    showTable: true,
  },
  version: 1,
  updatedById: null,
  updatedByName: null,
  updatedAt: null,
  ...overrides,
});

const basePreview = (
  proposedMode: 'full' | 'revenue_only' | 'exclude' = 'full',
): FinancePolicyPreviewResponse => ({
  period: {
    key: 'last30',
    dateFrom: '2026-10-14',
    dateTo: '2026-11-12',
    timeZone: 'Europe/Kiev',
  },
  requestedSource: 'all',
  current: {
    serviceProfitMode: 'full',
    version: 1,
    source: 'all',
    margin: {
      revenue: 1500,
      cogs: 700,
      grossProfit: 800,
      grossMarginPct: 53.33,
      unknownCostCount: 0,
      isIncomplete: false,
      knownCostRevenue: 1500,
      knownCostCogs: 700,
      knownCostGrossProfit: 800,
      knownCostGrossMarginPct: 53.33,
      costCoveragePct: 100,
    },
    cash: {
      collected: 1500,
      inventoryPurchases: 200,
      opex: 100,
      refunds: 0,
      net: 1200,
    },
    saleCount: 2,
    rowCount: 2,
  },
  proposed: {
    serviceProfitMode: proposedMode,
    source: 'all',
    margin:
      proposedMode === 'revenue_only'
        ? {
            revenue: 1500,
            cogs: 500,
            grossProfit: null,
            grossMarginPct: null,
            unknownCostCount: 1,
            isIncomplete: true,
            knownCostRevenue: 1000,
            knownCostCogs: 500,
            knownCostGrossProfit: 500,
            knownCostGrossMarginPct: 50,
            costCoveragePct: 66.67,
          }
        : proposedMode === 'exclude'
          ? {
              revenue: 1000,
              cogs: 500,
              grossProfit: 500,
              grossMarginPct: 50,
              unknownCostCount: 0,
              isIncomplete: false,
              knownCostRevenue: 1000,
              knownCostCogs: 500,
              knownCostGrossProfit: 500,
              knownCostGrossMarginPct: 50,
              costCoveragePct: 100,
            }
          : {
              revenue: 1500,
              cogs: 700,
              grossProfit: 800,
              grossMarginPct: 53.33,
              unknownCostCount: 0,
              isIncomplete: false,
              knownCostRevenue: 1500,
              knownCostCogs: 700,
              knownCostGrossProfit: 800,
              knownCostGrossMarginPct: 53.33,
              costCoveragePct: 100,
            },
    cash: {
      collected: 1500,
      inventoryPurchases: 200,
      opex: 100,
      refunds: 0,
      net: 1200,
    },
    saleCount: proposedMode === 'exclude' ? 1 : 2,
    rowCount: proposedMode === 'exclude' ? 1 : 2,
  },
  delta: {
    revenue: proposedMode === 'exclude' ? -500 : 0,
    cogs: proposedMode === 'full' ? 0 : -200,
    grossProfit: proposedMode === 'exclude' ? -300 : null,
    knownCostGrossProfit: proposedMode === 'full' ? 0 : -300,
    saleCount: proposedMode === 'exclude' ? -1 : 0,
  },
});

const baseHistory = (): FinancePolicyHistoryResponse => ({
  items: [
    {
      id: 'hist-1',
      previousVersion: 1,
      version: 2,
      changedFields: ['serviceAuditEnabled', 'serviceProfitMode'],
      previous: {
        serviceAuditEnabled: false,
        serviceProfitMode: 'full',
        reportDefaults: {
          period: 'last30',
          source: 'all',
          showCharts: true,
          showTable: true,
        },
      },
      next: {
        serviceAuditEnabled: true,
        serviceProfitMode: 'revenue_only',
        reportDefaults: {
          period: 'last30',
          source: 'all',
          showCharts: true,
          showTable: true,
        },
      },
      reason: 'Roll out service audit',
      authorId: 'emp-1',
      authorName: 'Owner',
      changedAt: '2026-11-12T10:00:00.000Z',
    },
  ],
  total: 1,
  page: 1,
  pageSize: 10,
});

const renderWithProviders = (ui: ReactElement) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </I18nextProvider>,
  );
};

describe('AccountingPolicySettings', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    getPolicyMock.mockResolvedValue(basePolicy());
    getHistoryMock.mockResolvedValue(baseHistory());
    previewPolicyMock.mockImplementation(
      async (payload: { serviceProfitMode?: 'full' | 'revenue_only' | 'exclude' }) =>
        basePreview(payload.serviceProfitMode ?? 'full'),
    );
    updatePolicyMock.mockResolvedValue(
      basePolicy({
        serviceAuditEnabled: true,
        serviceProfitMode: 'revenue_only',
        version: 2,
      }),
    );
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    cleanup();
  });

  it('previews service mode changes, disables services default on exclude, saves with version, and renders history', async () => {
    const onSuccess = vi.fn();
    renderWithProviders(
      <AccountingPolicySettings canManagePolicy onSuccess={onSuccess} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Version v1')).toBeInTheDocument();
    });

    // Switch mode to Revenue only -> triggers preview
    fireEvent.click(screen.getByRole('radio', { name: /Revenue only/i }));
    await waitFor(() => {
      expect(previewPolicyMock).toHaveBeenCalledWith(
        expect.objectContaining({ serviceProfitMode: 'revenue_only' }),
      );
      expect(screen.getByText(/Incomplete \(known:/i)).toBeInTheDocument();
    });

    // Switch mode to Exclude -> disables 'services' option in default source select
    fireEvent.click(screen.getByRole('radio', { name: /Exclude/i }));
    const sourceSelect = screen.getByLabelText('Default source') as HTMLSelectElement;
    const servicesOption = Array.from(sourceSelect.options).find(
      (opt) => opt.value === 'services',
    );
    expect(servicesOption?.disabled).toBe(true);

    // Toggle service audit & save
    fireEvent.click(
      screen.getByLabelText(/Allow manual service cost audit/i),
    );
    fireEvent.click(screen.getByRole('radio', { name: /Revenue only/i }));
    fireEvent.change(screen.getByLabelText(/Change reason/i), {
      target: { value: 'Audit enabled' },
    });

    const saveButton = screen.getByRole('button', { name: 'Save rules' });
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updatePolicyMock).toHaveBeenCalledWith({
        version: 1,
        serviceAuditEnabled: true,
        serviceProfitMode: 'revenue_only',
        reportDefaults: {
          period: 'last30',
          source: 'all',
          showCharts: true,
          showTable: true,
        },
        reason: 'Audit enabled',
      });
    });
    expect(onSuccess).toHaveBeenCalledWith(
      'Accounting and audit policy saved.',
    );

    // History item rendered
    expect(screen.getByText('v1 → v2')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText(/Roll out service audit/)).toBeInTheDocument();
  });

  it('handles 409 version conflict with reload action and supports read-only UK view', async () => {
    const onError = vi.fn();
    updatePolicyMock.mockRejectedValueOnce(
      new ApiRequestError('Version conflict', { status: 409, hasResponse: true }),
    );

    renderWithProviders(
      <AccountingPolicySettings canManagePolicy onError={onError} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Version v1')).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByLabelText(/Allow manual service cost audit/i),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save rules' }));

    await waitFor(() => {
      expect(
        screen.getByText(/Policy rules were updated by another employee/i),
      ).toBeInTheDocument();
    });

    getPolicyMock.mockResolvedValueOnce(
      basePolicy({ serviceAuditEnabled: true, version: 3 }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reload latest rules' }));
    await waitFor(() => {
      expect(screen.getByText('Version v3')).toBeInTheDocument();
    });

    cleanup();
    await i18n.changeLanguage('uk');
    renderWithProviders(<AccountingPolicySettings canManagePolicy={false} />);

    await waitFor(() => {
      expect(screen.getByText(/Лише перегляд/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Зберегти правила' })).toBeDisabled();
  });
});
