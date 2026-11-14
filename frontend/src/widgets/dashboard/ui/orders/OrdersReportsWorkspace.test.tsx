import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../../shared/i18n/config';
import { ordersReportsSettingsStorageKey } from '../../model/orders-reports-settings';
import { OrdersReportsWorkspace } from './OrdersReportsWorkspace';
import type { OrdersReportTableParams, OrdersReportTableResponse } from '../../../../entities/analytics';

const tableHookSpy = vi.fn();
const exportSpy = vi.fn();
const excelSpy = vi.fn();
const createScenarioSpy = vi.fn();
const updateScenarioSpy = vi.fn();
const deleteScenarioSpy = vi.fn();

const repairRow = {
  id: 'r1',
  recordNumber: 'R000010',
  clientId: 'c1',
  clientName: 'John',
  clientPhone: '+38099111',
  deviceName: 'iPhone',
  serialNumber: 'SN1',
  masterId: 'm1',
  masterName: 'Alex',
  managerId: 'e1',
  managerName: 'Manager',
  status: 'inRepair',
  intakeDate: '2026-11-01T10:00:00.000Z',
  completedAt: null,
  issuedAt: null,
  turnaroundHours: 24,
  total: 1500,
  discount: 0,
  paid: 500,
  debt: 1000,
  servicesCount: 1,
  productsCount: 1,
  knownCost: 400,
  knownProfit: 1100,
  marginPct: 73.3,
  isIncomplete: false,
  missingCostCount: 0,
};

const grandTotal = {
  key: 'grand',
  label: 'Total',
  field: 'status' as const,
  level: 1 as const,
  filters: {},
  count: 2,
  total: 3000,
  paid: 1000,
  debt: 2000,
  avgTurnaroundHours: 24,
  knownCost: 800,
  knownProfit: 2200,
};

const statusGroup = {
  key: 'inRepair',
  label: 'In repair group',
  field: 'status' as const,
  level: 1 as const,
  filters: { status: 'inRepair' },
  count: 2,
  total: 3000,
  paid: 1000,
  debt: 2000,
  avgTurnaroundHours: 24,
  children: [],
};

const productGroup = {
  key: 'screen',
  label: 'Screen',
  field: 'product' as const,
  level: 1 as const,
  filters: { lineName: 'Screen', lineKind: 'product' },
  count: 1,
  total: 800,
  paid: 400,
  debt: 400,
  avgTurnaroundHours: 24,
  children: [],
};

const baseReport = (
  _kind: string,
  extras: Partial<OrdersReportTableResponse> = {},
): OrdersReportTableResponse => ({
  generatedAt: '2026-11-11T10:00:00.000Z',
  timeZone: 'Europe/Kiev',
  period: { key: 'last30', dateFrom: '2026-10-13', dateTo: '2026-11-11' },
  mode: 'register',
  groupBy: [],
  items: [repairRow],
  groups: [statusGroup, productGroup],
  grandTotal,
  total: 2,
  page: 1,
  pageSize: 25,
  nextCursor: null,
  coverage: { warnings: [], warningItems: [] },
  supplierOptions: [{ id: 'sup-1', name: 'TechDist' }],
  ...extras,
});

const savedScenario = {
  id: 'sc-1',
  employeeId: 'e1',
  domain: 'ordersReport' as const,
  name: 'Sales summary',
  horizonDays: 30 as const,
  assumptions: {
    kind: 'sales',
    mode: 'summary',
    filters: { period: 'last7', status: 'paid' },
    columns: ['recordNumber', 'clientName', 'net'],
    groupBy: ['status'],
    sort: { sortBy: 'saleDate', sortDir: 'desc' },
  },
  filters: {},
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

vi.mock('../../../../entities/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../entities/analytics')>();
  return {
    ...actual,
    useOrdersReportsTableQuery: (
      kind: string,
      params: OrdersReportTableParams,
      opts?: { enabled?: boolean },
    ) => {
      tableHookSpy(kind, params, opts);
      return {
        data: baseReport(kind, {
          mode: params.mode ?? 'register',
          groupBy: params.groupBy ? (params.groupBy.split(',') as never) : [],
        }),
        isLoading: false,
        isError: false,
        error: null,
      };
    },
    getOrdersReportsTableExport: (...args: unknown[]) => exportSpy(...args),
  };
});

vi.mock('../../../../entities/scenario', () => ({
  useScenariosQuery: () => ({ data: [savedScenario], isLoading: false }),
  useCreateScenarioMutation: () => ({
    mutateAsync: (...args: unknown[]) => createScenarioSpy(...args),
    isPending: false,
  }),
  useUpdateScenarioMutation: () => ({
    mutateAsync: (...args: unknown[]) => updateScenarioSpy(...args),
    isPending: false,
  }),
  useDeleteScenarioMutation: () => ({
    mutateAsync: (...args: unknown[]) => deleteScenarioSpy(...args),
    isPending: false,
  }),
}));

vi.mock('../../../../shared/lib/report-excel', () => ({
  exportReportWorkbookToDownload: (...args: unknown[]) => excelSpy(...args),
}));

const visibleTabs = [
  'orders',
  'sales',
  'supplierOrders',
  'supplierInformation',
  'ordersReports',
] as const;

const renderWorkspace = (
  overrides: Partial<ComponentProps<typeof OrdersReportsWorkspace>> = {},
) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nextProvider i18n={i18n}>
        <OrdersReportsWorkspace
          activeTab="ordersReports"
          visibleTabs={[...visibleTabs]}
          permittedTabs={[...visibleTabs]}
          onActiveTabChange={vi.fn()}
          employees={[]}
          canViewRepairs
          canViewSales
          canViewProcurement
          canViewFinance={false}
          {...overrides}
        />
      </I18nextProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  tableHookSpy.mockClear();
  exportSpy.mockReset();
  excelSpy.mockReset();
  createScenarioSpy.mockReset();
  updateScenarioSpy.mockReset();
  deleteScenarioSpy.mockReset();
  window.localStorage.removeItem(ordersReportsSettingsStorageKey);
  createScenarioSpy.mockResolvedValue({
    ...savedScenario,
    id: 'sc-new',
    name: 'My preset',
  });
  updateScenarioSpy.mockResolvedValue(savedScenario);
  deleteScenarioSpy.mockResolvedValue({ deleted: true, id: 'sc-1' });
});

afterEach(async () => {
  cleanup();
  window.localStorage.removeItem(ordersReportsSettingsStorageKey);
  if (i18n.language !== 'en') {
    await i18n.changeLanguage('en');
  }
});

describe('OrdersReportsWorkspace', () => {
  it('switches kind and mode, hides unauthorized kinds, and drills a group into the register', () => {
    renderWorkspace({ canViewProcurement: false });

    const kinds = within(screen.getByLabelText('Report kind'));
    expect(kinds.getByRole('tab', { name: 'Repairs' })).toHaveAttribute('aria-selected', 'true');
    expect(kinds.getByRole('tab', { name: 'Sales' })).toBeInTheDocument();
    expect(kinds.queryByRole('tab', { name: 'Supplier orders' })).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'R000010' })).toBeInTheDocument();
    expect(screen.getByText(/Grand total/)).toBeInTheDocument();
    expect(screen.queryByText('Known cost')).not.toBeInTheDocument();

    fireEvent.click(kinds.getByRole('tab', { name: 'Sales' }));
    expect(tableHookSpy).toHaveBeenCalledWith(
      'sales',
      expect.objectContaining({ sortBy: 'saleDate' }),
      expect.anything(),
    );

    const modes = within(screen.getByLabelText('Report mode'));
    fireEvent.click(modes.getByRole('tab', { name: 'Summary' }));
    expect(modes.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'In repair group' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'In repair group' }));
    expect(modes.getByRole('tab', { name: 'Register' })).toHaveAttribute('aria-selected', 'true');
    const lastCall = tableHookSpy.mock.calls.at(-1);
    expect(lastCall?.[1]).toEqual(expect.objectContaining({ status: 'inRepair', mode: 'register' }));
  });

  it('hides finance columns from the picker without finance.view', () => {
    renderWorkspace({ canViewFinance: false });
    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    const picker = screen.getByLabelText('Visible columns');
    expect(within(picker).getByText('Number')).toBeInTheDocument();
    expect(within(picker).queryByText('Known cost')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Known cost/ })).not.toBeInTheDocument();
  });

  it('shows finance columns in the picker off by default and lets the user enable them', () => {
    renderWorkspace({ canViewFinance: true });
    expect(screen.queryByRole('columnheader', { name: /Known cost/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    const picker = screen.getByLabelText('Visible columns');
    const costCheckbox = within(picker).getByRole('checkbox', { name: 'Known cost' });
    expect(costCheckbox).not.toBeChecked();
    fireEvent.click(costCheckbox);
    expect(costCheckbox).toBeChecked();
    expect(screen.getByRole('columnheader', { name: /Known cost/ })).toBeInTheDocument();
  });

  it('applies a saved preset and can reset back to defaults', () => {
    renderWorkspace();

    const period = screen.getByLabelText('Period') as HTMLSelectElement;
    expect(period.value).toBe('last30');
    fireEvent.change(period, { target: { value: 'last7' } });
    expect((screen.getByLabelText('Period') as HTMLSelectElement).value).toBe('last7');

    fireEvent.change(screen.getByLabelText('Saved report presets'), {
      target: { value: 'sc-1' },
    });
    const kinds = within(screen.getByLabelText('Report kind'));
    expect(kinds.getByRole('tab', { name: 'Sales' })).toHaveAttribute('aria-selected', 'true');
    const modes = within(screen.getByLabelText('Report mode'));
    expect(modes.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');
    expect((screen.getByLabelText('Period') as HTMLSelectElement).value).toBe('last7');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect((screen.getByLabelText('Period') as HTMLSelectElement).value).toBe('last30');
    expect(kinds.getByRole('tab', { name: 'Repairs' })).toHaveAttribute('aria-selected', 'true');
    expect(modes.getByRole('tab', { name: 'Register' })).toHaveAttribute('aria-selected', 'true');
  });

  it('saves a new preset with the ordersReport domain', async () => {
    renderWorkspace();
    fireEvent.change(screen.getByLabelText('Scenario name'), {
      target: { value: 'My preset' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save New' }));
    await waitFor(() => expect(createScenarioSpy).toHaveBeenCalled());
    expect(createScenarioSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'ordersReport',
        name: 'My preset',
        horizonDays: 30,
        assumptions: expect.objectContaining({ kind: 'repairs', mode: 'register' }),
      }),
    );
    expect(await screen.findByText('Saved preset "My preset".')).toBeInTheDocument();
  });

  it('renders Ukrainian copy when the interface language is uk', async () => {
    await i18n.changeLanguage('uk');
    renderWorkspace();

    expect(screen.getByRole('heading', { name: 'Звіти' })).toBeInTheDocument();
    const kinds = within(screen.getByLabelText('Тип звіту'));
    expect(kinds.getByRole('tab', { name: 'Ремонти' })).toBeInTheDocument();
    expect(kinds.getByRole('tab', { name: 'Продажі' })).toBeInTheDocument();
    expect(kinds.getByRole('tab', { name: 'Замовлення постачальнику' })).toBeInTheDocument();
    const modes = within(screen.getByLabelText('Режим звіту'));
    expect(modes.getByRole('tab', { name: 'Реєстр' })).toBeInTheDocument();
    expect(modes.getByRole('tab', { name: 'Підсумок' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Скинути' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Експорт Excel' })).toBeInTheDocument();
    expect(screen.getByLabelText('Період')).toBeInTheDocument();
    expect(screen.getByText('Останні 30 днів')).toBeInTheDocument();
    expect(screen.getByText(/Загальний підсумок/)).toBeInTheDocument();
  });

  it('drills a product group into the register with exact lineName, not the search box', () => {
    renderWorkspace();
    const modes = within(screen.getByLabelText('Report mode'));
    fireEvent.click(modes.getByRole('tab', { name: 'Summary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Screen' }));
    expect(modes.getByRole('tab', { name: 'Register' })).toHaveAttribute('aria-selected', 'true');
    const lastCall = tableHookSpy.mock.calls.at(-1);
    expect(lastCall?.[1]).toEqual(
      expect.objectContaining({
        mode: 'register',
        lineName: 'Screen',
        lineKind: 'product',
      }),
    );
    expect(lastCall?.[1].q).toBeUndefined();
    expect(screen.getByRole('button', { name: /Screen/ })).toBeInTheDocument();
  });

  it('loops every export batch beyond 200 rows and builds a workbook from all of them', async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      ...repairRow,
      id: `r${i}`,
      recordNumber: `R${String(i).padStart(6, '0')}`,
    }));
    const page2 = Array.from({ length: 205 }, (_, i) => ({
      ...repairRow,
      id: `r${1000 + i}`,
      recordNumber: `R${String(1000 + i).padStart(6, '0')}`,
    }));
    exportSpy.mockImplementation(async (_kind: string, params: OrdersReportTableParams) => {
      if (!params.cursor) {
        return baseReport('repairs', {
          items: page1,
          total: 1205,
          nextCursor: 'c2',
          page: 1,
          pageSize: 1000,
        });
      }
      expect(params.cursor).toBe('c2');
      return baseReport('repairs', {
        items: page2,
        total: 1205,
        nextCursor: null,
        page: 2,
        pageSize: 1000,
      });
    });

    renderWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Export Excel' }));

    await waitFor(() => expect(excelSpy).toHaveBeenCalled());
    expect(exportSpy).toHaveBeenCalledTimes(2);
    const workbook = excelSpy.mock.calls[0]![0] as {
      filename: string;
      sheets: Array<{ name: string; rows: unknown[] }>;
    };
    expect(workbook.filename).toMatch(/^orders-reports-repairs-register-2026-11-11\.xlsx$/);
    expect(workbook.sheets[0]!.name).toBe('Register');
    expect(workbook.sheets[0]!.rows).toHaveLength(1205);
  });

  it('requests register-mode export batches even when the UI is in summary mode', async () => {
    exportSpy.mockImplementation(async (_kind: string, params: OrdersReportTableParams) => {
      expect(params.mode).toBe('register');
      return baseReport('repairs', {
        items: [{ ...repairRow, id: 'r-exp' }],
        total: 1,
        nextCursor: null,
        mode: 'register',
      });
    });
    renderWorkspace();
    const modes = within(screen.getByLabelText('Report mode'));
    fireEvent.click(modes.getByRole('tab', { name: 'Summary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export Excel' }));
    await waitFor(() => expect(excelSpy).toHaveBeenCalled());
    expect(exportSpy).toHaveBeenCalled();
    const workbook = excelSpy.mock.calls[0]![0] as {
      filename: string;
      sheets: Array<{ name: string; rows: unknown[] }>;
    };
    expect(workbook.filename).toMatch(/orders-reports-repairs-summary-/);
    expect(workbook.sheets.map((s) => s.name)).toContain('Summary');
    expect(workbook.sheets.map((s) => s.name)).toContain('Register');
    const register = workbook.sheets.find((s) => s.name === 'Register');
    expect(register?.rows).toHaveLength(1);
  });
});
