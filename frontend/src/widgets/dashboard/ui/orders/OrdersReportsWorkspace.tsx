import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import {
  getOrdersReportsTableExport,
  useOrdersReportsTableQuery,
  type OrdersReportGroup,
  type OrdersReportGroupBy,
  type OrdersReportKind,
  type OrdersReportMode,
  type OrdersReportTableParams,
} from '../../../../entities/analytics';
import type { Employee } from '../../../../entities/employee';
import {
  useCreateScenarioMutation,
  useDeleteScenarioMutation,
  useScenariosQuery,
  useUpdateScenarioMutation,
} from '../../../../entities/scenario';
import { formatDate } from '../../../../shared/lib/format';
import { exportReportWorkbookToDownload } from '../../../../shared/lib/report-excel';
import { formatMoney } from '../../model/accounting';
import {
  clearStoredOrdersReportSettings,
  columnDefsForKind,
  defaultOrdersReportSettings,
  defaultSortForKind,
  getStoredOrdersReportSettings,
  groupByOptionsForKind,
  ORDERS_REPORT_PERIODS,
  sanitizeColumns,
  storeOrdersReportSettings,
  type StoredOrdersReportSettings,
} from '../../model/orders-reports-settings';
import {
  fetchAllExportBatches,
  flattenReportGroups,
} from '../../model/orders-reports-export';
import {
  AnalyticsCoverageBanner,
  AnalyticsSortableTable,
  ScenarioManagerBar,
  type SortableColumn,
} from '../common/AnalyticsPrimitives';
import { OrdersWorkspaceTabList } from './workspace/OrdersWorkspaceTabList';
import {
  repairStatuses,
  saleStatuses,
  type OrdersTab,
} from './workspace/orders-workspace-shared';
import { supplierOrderStatuses } from '../../model/supplier-orders-workspace';
import {
  translateCoverageWarnings,
  translateRepairStatus,
  translateSaleStatus,
  translateSupplierOrderStatus,
} from './orders-information-i18n';
import { OrdersReportsColumnPicker } from './OrdersReportsColumnPicker';

export interface OrdersReportsWorkspaceProps {
  activeTab: OrdersTab;
  visibleTabs: OrdersTab[];
  permittedTabs?: OrdersTab[];
  onActiveTabChange: (tab: OrdersTab) => void;
  onToggleTabVisibility?: (tab: OrdersTab) => void;
  employees: Employee[];
  canViewRepairs: boolean;
  canViewSales: boolean;
  canViewProcurement: boolean;
  canViewFinance: boolean;
  onOpenSaleCard?: (sale: { id: string; kind: 'repair' | 'sale' }) => void;
  onOpenSupplierOrderTab?: () => void;
};

const money = (value: number) => formatMoney(value, 'UAH');
const dateText = (value: string | null | undefined, fallback: string) =>
  value ? formatDate(value) : fallback;

export const OrdersReportsWorkspace: React.FC<OrdersReportsWorkspaceProps> = ({
  activeTab,
  visibleTabs,
  permittedTabs,
  onActiveTabChange,
  onToggleTabVisibility,
  employees,
  canViewRepairs,
  canViewSales,
  canViewProcurement,
  canViewFinance,
  onOpenSaleCard,
  onOpenSupplierOrderTab,
}) => {
  const { t } = useTranslation();

  const availableKinds = useMemo(() => {
    const list: OrdersReportKind[] = [];
    if (canViewRepairs) list.push('repairs');
    if (canViewSales) list.push('sales');
    if (canViewProcurement) list.push('procurement');
    return list;
  }, [canViewRepairs, canViewSales, canViewProcurement]);

  const [settings, setSettings] = useState<StoredOrdersReportSettings>(() =>
    getStoredOrdersReportSettings(canViewFinance),
  );
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioMessage, setScenarioMessage] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const kind = availableKinds.includes(settings.kind)
    ? settings.kind
    : (availableKinds[0] ?? 'repairs');

  useEffect(() => {
    if (availableKinds.length > 0 && !availableKinds.includes(settings.kind)) {
      setSettings((prev) => ({
        ...prev,
        kind: availableKinds[0]!,
        sortBy: defaultSortForKind(availableKinds[0]!),
      }));
    }
  }, [availableKinds, settings.kind]);

  useEffect(() => {
    storeOrdersReportSettings(settings);
  }, [settings]);

  const patch = (partial: Partial<StoredOrdersReportSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
    setPage(1);
  };

  const visibleColumns = sanitizeColumns(
    kind,
    settings.columnsByKind[kind],
    canViewFinance,
  );

  const setVisibleColumns = (next: string[]) => {
    setSettings((prev) => ({
      ...prev,
      columnsByKind: { ...prev.columnsByKind, [kind]: next },
    }));
  };

  const queryParams: OrdersReportTableParams = useMemo(
    () => ({
      period: settings.period,
      dateFrom: settings.period === 'custom' ? settings.dateFrom : undefined,
      dateTo: settings.period === 'custom' ? settings.dateTo : undefined,
      status: settings.status || undefined,
      masterId: settings.masterId || undefined,
      managerId: settings.managerId || undefined,
      q: settings.q.trim() || undefined,
      lineName: settings.lineName.trim() || undefined,
      clientId: settings.clientId || undefined,
      supplierId: settings.supplierId || undefined,
      lineKind: settings.lineKind && settings.lineKind !== 'all' ? settings.lineKind : undefined,
      paymentMethod: settings.paymentMethod || undefined,
      unpaidOnly: settings.unpaidOnly || undefined,
      overdueOnly: settings.overdueOnly || undefined,
      sortBy: settings.sortBy,
      sortDir: settings.sortDir,
      page,
      pageSize: settings.pageSize,
      mode: settings.mode,
      groupBy: settings.groupBy.length > 0 ? settings.groupBy.join(',') : undefined,
    }),
    [settings, page],
  );

  const enabled =
    (kind === 'repairs' && canViewRepairs) ||
    (kind === 'sales' && canViewSales) ||
    (kind === 'procurement' && canViewProcurement);

  const tableQuery = useOrdersReportsTableQuery(kind, queryParams, { enabled });
  const report = tableQuery.data;

  const scenariosQuery = useScenariosQuery('ordersReport', { enabled });
  const createScenarioMutation = useCreateScenarioMutation();
  const updateScenarioMutation = useUpdateScenarioMutation();
  const deleteScenarioMutation = useDeleteScenarioMutation();

  const buildAssumptions = () => ({
    kind,
    mode: settings.mode,
    filters: {
      period: settings.period,
      dateFrom: settings.dateFrom,
      dateTo: settings.dateTo,
      status: settings.status,
      masterId: settings.masterId,
      managerId: settings.managerId,
      q: settings.q,
      lineName: settings.lineName,
      clientId: settings.clientId,
      supplierId: settings.supplierId,
      lineKind: settings.lineKind,
      paymentMethod: settings.paymentMethod,
      unpaidOnly: settings.unpaidOnly,
      overdueOnly: settings.overdueOnly,
    },
    columns: visibleColumns,
    columnsByKind: settings.columnsByKind,
    groupBy: settings.groupBy,
    sort: { sortBy: settings.sortBy, sortDir: settings.sortDir },
  });

  const applyAssumptions = (raw: Record<string, unknown>) => {
    const filters = (raw.filters ?? {}) as Record<string, unknown>;
    const sort = (raw.sort ?? {}) as Record<string, unknown>;
    const nextKind = (raw.kind === 'sales' || raw.kind === 'procurement' || raw.kind === 'repairs'
      ? raw.kind
      : kind) as OrdersReportKind;
    const columnsByKind = {
      ...settings.columnsByKind,
      ...((raw.columnsByKind as StoredOrdersReportSettings['columnsByKind']) ?? {}),
    };
    if (Array.isArray(raw.columns) && raw.columns.every((c) => typeof c === 'string')) {
      columnsByKind[nextKind] = raw.columns as string[];
    }
    setSettings((prev) => ({
      ...prev,
      kind: availableKinds.includes(nextKind) ? nextKind : prev.kind,
      mode: raw.mode === 'summary' ? 'summary' : 'register',
      period: (ORDERS_REPORT_PERIODS as string[]).includes(String(filters.period ?? ''))
        ? (filters.period as StoredOrdersReportSettings['period'])
        : prev.period,
      dateFrom: String(filters.dateFrom ?? ''),
      dateTo: String(filters.dateTo ?? ''),
      status: String(filters.status ?? ''),
      masterId: String(filters.masterId ?? ''),
      managerId: String(filters.managerId ?? ''),
      q: String(filters.q ?? ''),
      lineName: String(filters.lineName ?? ''),
      clientId: String(filters.clientId ?? ''),
      supplierId: String(filters.supplierId ?? ''),
      lineKind: String(filters.lineKind ?? 'all'),
      paymentMethod: String(filters.paymentMethod ?? ''),
      unpaidOnly: filters.unpaidOnly === true,
      overdueOnly: filters.overdueOnly === true,
      columnsByKind,
      groupBy: Array.isArray(raw.groupBy)
        ? (raw.groupBy as OrdersReportGroupBy[]).slice(0, 2)
        : [],
      sortBy: String(sort.sortBy ?? defaultSortForKind(nextKind)),
      sortDir: sort.sortDir === 'asc' ? 'asc' : 'desc',
    }));
    setPage(1);
  };

  const handleSelectScenario = (id: string) => {
    setSelectedScenarioId(id);
    const found = (scenariosQuery.data ?? []).find((s) => s.id === id);
    if (!found) return;
    setScenarioName(found.name);
    applyAssumptions((found.assumptions ?? {}) as Record<string, unknown>);
  };

  const handleSaveNewScenario = async () => {
    if (!scenarioName.trim()) return;
    const saved = await createScenarioMutation.mutateAsync({
      domain: 'ordersReport',
      name: scenarioName.trim(),
      horizonDays: 30,
      assumptions: buildAssumptions(),
    });
    setSelectedScenarioId(saved.id);
    setScenarioMessage(t('orders.reports.scenarios.saved', { name: saved.name }));
  };

  const handleUpdateScenario = async () => {
    if (!selectedScenarioId || !scenarioName.trim()) return;
    const updated = await updateScenarioMutation.mutateAsync({
      scenarioId: selectedScenarioId,
      payload: {
        name: scenarioName.trim(),
        horizonDays: 30,
        assumptions: buildAssumptions(),
      },
    });
    setScenarioMessage(t('orders.reports.scenarios.updated', { name: updated.name }));
  };

  const handleDeleteScenario = async () => {
    if (!selectedScenarioId) return;
    await deleteScenarioMutation.mutateAsync(selectedScenarioId);
    setSelectedScenarioId('');
    setScenarioName('');
    setScenarioMessage(t('orders.reports.scenarios.deleted'));
  };

  const handleReset = () => {
    clearStoredOrdersReportSettings();
    const defaults = defaultOrdersReportSettings(canViewFinance);
    const firstKind = availableKinds[0] ?? 'repairs';
    setSettings({
      ...defaults,
      kind: firstKind,
      sortBy: defaultSortForKind(firstKind),
    });
    setSelectedScenarioId('');
    setScenarioName('');
    setPage(1);
    setExportError(null);
  };

  const yesNo = (value: boolean) => (value ? t('orders.reports.yes') : t('orders.reports.no'));
  const na = t('orders.reports.nA');

  const translateStatus = (value: string) => {
    if (kind === 'sales') return translateSaleStatus(t, value);
    if (kind === 'procurement') return translateSupplierOrderStatus(t, value);
    return translateRepairStatus(t, value);
  };

  const formatCell = (row: Record<string, unknown>, key: string): React.ReactNode => {
    const value = row[key];
    if (key === 'recordNumber' || key === 'displayNumber') {
      const label = String(value || row.id || '');
      const open = () => {
        if (kind === 'procurement') {
          onOpenSupplierOrderTab?.();
          return;
        }
        onOpenSaleCard?.({ id: String(row.id), kind: kind === 'sales' ? 'sale' : 'repair' });
      };
      return (
        <button type="button" className="finance-orders-number-button" onClick={open}>
          {label}
        </button>
      );
    }
    if (key === 'status') return translateStatus(String(value ?? ''));
    if (key === 'isOverdue' || key === 'isIncomplete') {
      if (value === undefined || value === null) return na;
      return yesNo(Boolean(value));
    }
    if (
      key === 'total' ||
      key === 'discount' ||
      key === 'paid' ||
      key === 'debt' ||
      key === 'gross' ||
      key === 'net' ||
      key === 'paidCash' ||
      key === 'paidNonCash' ||
      key === 'returnAmount' ||
      key === 'outstanding' ||
      key === 'knownCost' ||
      key === 'knownProfit'
    ) {
      return typeof value === 'number' ? money(value) : na;
    }
    if (key === 'marginPct') {
      return typeof value === 'number' ? `${value}%` : na;
    }
    if (
      key === 'intakeDate' ||
      key === 'completedAt' ||
      key === 'issuedAt' ||
      key === 'saleDate' ||
      key === 'createdAt' ||
      key === 'deliveryDate' ||
      key === 'stockedAt'
    ) {
      return dateText(typeof value === 'string' ? value : null, na);
    }
    if (value === null || value === undefined || value === '') return na;
    return String(value);
  };

  const registerColumns: SortableColumn<Record<string, unknown>>[] = visibleColumns.map((key) => {
    const def = columnDefsForKind(kind).find((col) => col.key === key);
    return {
      key,
      label: t(def?.labelKey ?? key),
      align: def?.align,
      sortable: true,
      sortValue: (row) => {
        const value = row[key];
        if (typeof value === 'number') return value;
        if (typeof value === 'boolean') return value ? 1 : 0;
        return String(value ?? '');
      },
      render: (row) => formatCell(row, key),
    };
  });

  const applyGroupFilters = (group: OrdersReportGroup) => {
    const filters = group.filters ?? {};
    setSettings((prev) => {
      const next: StoredOrdersReportSettings = { ...prev, mode: 'register' };
      if ((ORDERS_REPORT_PERIODS as string[]).includes(filters.period)) {
        next.period = filters.period as StoredOrdersReportSettings['period'];
      }
      if (filters.dateFrom !== undefined) next.dateFrom = filters.dateFrom;
      if (filters.dateTo !== undefined) next.dateTo = filters.dateTo;
      if (filters.status !== undefined) next.status = filters.status;
      if (filters.masterId !== undefined) next.masterId = filters.masterId;
      if (filters.managerId !== undefined) next.managerId = filters.managerId;
      if (filters.supplierId !== undefined) next.supplierId = filters.supplierId;
      if (filters.clientId !== undefined) next.clientId = filters.clientId;
      if (filters.lineKind !== undefined) next.lineKind = filters.lineKind;
      if (filters.lineName !== undefined) next.lineName = filters.lineName;
      return next;
    });
    setPage(1);
  };


  const summaryRows = flattenReportGroups(report?.groups ?? []).map((group) => ({
    ...group,
    id: group.key,
  }));

  const summaryColumns: SortableColumn<(typeof summaryRows)[number]>[] = [
    {
      key: 'label',
      label: t('orders.reports.columns.group'),
      render: (row) => (
        <button
          type="button"
          className="finance-orders-number-button"
          style={{ paddingLeft: row.level === 2 ? 20 : 0 }}
          onClick={() => applyGroupFilters(row)}
          title={t('orders.reports.drillDown')}
        >
          {row.label}
        </button>
      ),
    },
    { key: 'count', label: t('orders.reports.columns.count'), align: 'right', sortable: true, sortValue: (r) => r.count, render: (r) => r.count },
    { key: 'total', label: t('orders.reports.columns.total'), align: 'right', sortable: true, sortValue: (r) => r.total, render: (r) => money(r.total) },
    { key: 'paid', label: t('orders.reports.columns.paid'), align: 'right', sortable: true, sortValue: (r) => r.paid, render: (r) => money(r.paid) },
    { key: 'debt', label: t('orders.reports.columns.debt'), align: 'right', sortable: true, sortValue: (r) => r.debt, render: (r) => money(r.debt) },
    ...(kind === 'repairs'
      ? [
          {
            key: 'avgTurnaroundHours',
            label: t('orders.reports.columns.avgTurnaroundHours'),
            align: 'right' as const,
            render: (r: OrdersReportGroup) =>
              r.avgTurnaroundHours == null ? na : r.avgTurnaroundHours,
          },
        ]
      : []),
    ...(canViewFinance && kind !== 'procurement'
      ? [
          {
            key: 'knownCost',
            label: t('orders.reports.columns.knownCost'),
            align: 'right' as const,
            render: (r: OrdersReportGroup) =>
              typeof r.knownCost === 'number' ? money(r.knownCost) : na,
          },
          {
            key: 'knownProfit',
            label: t('orders.reports.columns.knownProfit'),
            align: 'right' as const,
            render: (r: OrdersReportGroup) =>
              typeof r.knownProfit === 'number' ? money(r.knownProfit) : na,
          },
        ]
      : []),
  ];

  const handleExport = async () => {
    if (!report) return;
    const controller = new AbortController();
    setAbortController(controller);
    setIsExporting(true);
    setExportError(null);
    setExportProgress({ loaded: 0, total: report.total });
    try {
      const exportParams = {
        ...queryParams,
        page: undefined,
        pageSize: undefined,
        cursor: undefined,
        // Register sheet needs every row; Summary sheet is built from the current groups tree.
        mode: 'register' as const,
      };
      const items = await fetchAllExportBatches(
        (cursor) =>
          getOrdersReportsTableExport(kind, { ...exportParams, cursor }).then((res) => ({
            items: res.items,
            nextCursor: res.nextCursor,
            total: res.total,
          })),
        {
          signal: controller.signal,
          onProgress: (loaded, total) => setExportProgress({ loaded, total }),
        },
      );
      const warnings = translateCoverageWarnings(
        t,
        report.coverage.warnings,
        report.coverage.warningItems,
      );
      const colLabel = (key: string) => {
        const def = columnDefsForKind(kind).find((col) => col.key === key);
        return t(def?.labelKey ?? `orders.reports.columns.${key}`);
      };
      const sheets = [
        {
          name: t('orders.reports.export.sheetRegister'),
          rows: items.map((row) => {
            const rec = row as unknown as Record<string, unknown>;
            const out: Record<string, string | number | boolean | null> = {};
            for (const key of visibleColumns) {
              const raw = rec[key];
              if (key === 'status') out[colLabel(key)] = translateStatus(String(raw ?? ''));
              else if (key === 'isOverdue' || key === 'isIncomplete') {
                out[colLabel(key)] = raw === undefined || raw === null ? na : yesNo(Boolean(raw));
              } else if (
                key.endsWith('Date') ||
                key === 'intakeDate' ||
                key === 'completedAt' ||
                key === 'issuedAt' ||
                key === 'createdAt' ||
                key === 'stockedAt'
              ) {
                out[colLabel(key)] = typeof raw === 'string' ? raw.slice(0, 10) : '';
              } else if (raw === null || raw === undefined) {
                out[colLabel(key)] = '';
              } else if (typeof raw === 'number' || typeof raw === 'boolean' || typeof raw === 'string') {
                out[colLabel(key)] = raw;
              } else {
                out[colLabel(key)] = String(raw);
              }
            }
            return out;
          }),
        },
      ];
      if (settings.mode === 'summary' && report.groups.length > 0) {
        sheets.unshift({
          name: t('orders.reports.export.sheetSummary'),
          rows: flattenReportGroups(report.groups).map((g) => ({
            [colLabel('group')]: `${g.level === 2 ? '  ' : ''}${g.label}`,
            [colLabel('count')]: g.count,
            [colLabel('total')]: g.total,
            [colLabel('paid')]: g.paid,
            [colLabel('debt')]: g.debt,
            ...(typeof g.knownCost === 'number' ? { [colLabel('knownCost')]: g.knownCost } : {}),
            ...(typeof g.knownProfit === 'number' ? { [colLabel('knownProfit')]: g.knownProfit } : {}),
          })),
        });
      }
      const titleKey =
        kind === 'sales'
          ? 'orders.reports.export.salesTitle'
          : kind === 'procurement'
            ? 'orders.reports.export.procurementTitle'
            : 'orders.reports.export.repairsTitle';
      const allLabel = t('orders.reports.filters.all');
      exportReportWorkbookToDownload({
        filename: `orders-reports-${kind}-${settings.mode}-${report.generatedAt.slice(0, 10)}.xlsx`,
        title: t(titleKey),
        generatedAt: report.generatedAt,
        timeZone: report.timeZone,
        activeFilters: [
          { filter: t('orders.reports.filters.period'), value: `${report.period.dateFrom ?? ''} – ${report.period.dateTo ?? ''}` },
          { filter: t('orders.reports.filters.status'), value: settings.status ? translateStatus(settings.status) : allLabel },
          { filter: t('orders.reports.export.templateName'), value: scenarioName.trim() || t('orders.reports.defaultPreset') },
          { filter: t('orders.reports.filters.search'), value: settings.q.trim() },
        ],
        definitions: [],
        warnings,
        sheets,
      });
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') {
        setExportError(t('orders.reports.exportCancelled'));
      } else {
        setExportError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setIsExporting(false);
      setAbortController(null);
    }
  };

  const handleCancelExport = () => {
    abortController?.abort();
  };

  const statusOptions =
    kind === 'sales' ? saleStatuses : kind === 'procurement' ? supplierOrderStatuses : repairStatuses;

  const technicians = employees.filter((e) => e.isActive !== false);
  const warnings = report
    ? translateCoverageWarnings(t, report.coverage.warnings, report.coverage.warningItems)
    : [];
  const grand = report?.grandTotal;
  const supplierOptions = report?.supplierOptions ?? [];

  const periodLabel = (key: string) => {
    const map: Record<string, string> = {
      last30: 'orders.reports.periods.last30',
      last7: 'orders.reports.periods.last7',
      day: 'orders.reports.periods.day',
      week: 'orders.reports.periods.week',
      month: 'orders.reports.periods.month',
      year: 'orders.reports.periods.year',
      whole: 'orders.reports.periods.whole',
      custom: 'orders.reports.periods.custom',
    };
    return t(map[key] ?? key);
  };

  return (
    <section className="orders-workspace">
      <OrdersWorkspaceTabList
        activeTab={activeTab}
        visibleTabs={visibleTabs}
        permittedTabs={permittedTabs}
        onActiveTabChange={onActiveTabChange}
        onToggleTabVisibility={onToggleTabVisibility}
      />
      <div className="report-upgrade-shell">
        <div className="report-upgrade-header">
          <div>
            <h2 className="report-upgrade-header-title">{t('orders.reports.title')}</h2>
            <p className="report-upgrade-header-subtitle">{t('orders.reports.subtitle')}</p>
          </div>
          <div className="report-upgrade-actions">
            <div className="report-subview-tabs" role="tablist" aria-label={t('orders.reports.kindsAria')}>
              {availableKinds.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={kind === item}
                  className={`report-toggle-chip ${kind === item ? 'is-active' : ''}`}
                  onClick={() =>
                    patch({
                      kind: item,
                      sortBy: defaultSortForKind(item),
                      groupBy: [],
                      status: '',
                      lineName: '',
                    })
                  }
                >
                  {t(`orders.reports.kinds.${item}`)}
                </button>
              ))}
            </div>
            <div className="report-subview-tabs" role="tablist" aria-label={t('orders.reports.modesAria')}>
              {(['register', 'summary'] as OrdersReportMode[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={settings.mode === item}
                  className={`report-toggle-chip ${settings.mode === item ? 'is-active' : ''}`}
                  onClick={() =>
                    patch({
                      mode: item,
                      groupBy:
                        item === 'summary' && settings.groupBy.length === 0
                          ? ['status']
                          : settings.groupBy,
                    })
                  }
                >
                  {t(`orders.reports.modes.${item}`)}
                </button>
              ))}
            </div>
            <button type="button" className="secondary-button" onClick={handleReset}>
              {t('orders.reports.reset')}
            </button>
            {isExporting ? (
              <button type="button" className="secondary-button" onClick={handleCancelExport}>
                {t('orders.reports.exportCancel')}
              </button>
            ) : (
              <button
                type="button"
                className="primary-button"
                onClick={() => void handleExport()}
                disabled={!report}
              >
                {t('orders.reports.exportExcel')}
              </button>
            )}
          </div>
        </div>

        <ScenarioManagerBar
          scenarios={scenariosQuery.data ?? []}
          selectedScenarioId={selectedScenarioId}
          scenarioName={scenarioName}
          onScenarioNameChange={setScenarioName}
          onSelectScenario={handleSelectScenario}
          onSaveNew={() => void handleSaveNewScenario()}
          onUpdateSelected={() => void handleUpdateScenario()}
          onDeleteSelected={() => void handleDeleteScenario()}
          isSaving={
            createScenarioMutation.isPending ||
            updateScenarioMutation.isPending ||
            deleteScenarioMutation.isPending
          }
          label={t('orders.reports.presetLabel')}
        />
        {scenarioMessage ? (
          <div className="report-coverage-banner is-info" role="status">
            {scenarioMessage}
          </div>
        ) : null}

        <div className="report-filter-bar" role="group" aria-label={t('orders.reports.filtersAria')}>
          <label className="report-filter-field">
            <span>{t('orders.reports.filters.period')}</span>
            <select
              value={settings.period}
              onChange={(e) => patch({ period: e.target.value as StoredOrdersReportSettings['period'] })}
            >
              {ORDERS_REPORT_PERIODS.map((key) => (
                <option key={key} value={key}>
                  {periodLabel(key)}
                </option>
              ))}
            </select>
          </label>
          {settings.period === 'custom' ? (
            <>
              <label className="report-filter-field">
                <span>{t('orders.reports.filters.dateFrom')}</span>
                <input
                  type="date"
                  value={settings.dateFrom}
                  onChange={(e) => patch({ dateFrom: e.target.value })}
                />
              </label>
              <label className="report-filter-field">
                <span>{t('orders.reports.filters.dateTo')}</span>
                <input
                  type="date"
                  value={settings.dateTo}
                  onChange={(e) => patch({ dateTo: e.target.value })}
                />
              </label>
            </>
          ) : null}
          <label className="report-filter-field">
            <span>{t('orders.reports.filters.status')}</span>
            <select value={settings.status} onChange={(e) => patch({ status: e.target.value })}>
              <option value="">{t('orders.reports.filters.all')}</option>
              {statusOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </label>
          {kind === 'repairs' ? (
            <label className="report-filter-field">
              <span>{t('orders.reports.filters.technician')}</span>
              <select value={settings.masterId} onChange={(e) => patch({ masterId: e.target.value })}>
                <option value="">{t('orders.reports.filters.all')}</option>
                <option value="unassigned">{t('orders.reports.unassigned')}</option>
                {technicians.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {kind !== 'procurement' ? (
            <label className="report-filter-field">
              <span>{t('orders.reports.filters.manager')}</span>
              <select value={settings.managerId} onChange={(e) => patch({ managerId: e.target.value })}>
                <option value="">{t('orders.reports.filters.all')}</option>
                <option value="unassigned">{t('orders.reports.unassigned')}</option>
                {technicians.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="report-filter-field">
              <span>{t('orders.reports.filters.supplier')}</span>
              <select value={settings.supplierId} onChange={(e) => patch({ supplierId: e.target.value })}>
                <option value="">{t('orders.reports.filters.all')}</option>
                {supplierOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === 'sales' || kind === 'repairs' ? (
            <label className="report-filter-field">
              <span>{t('orders.reports.filters.lineKind')}</span>
              <select value={settings.lineKind} onChange={(e) => patch({ lineKind: e.target.value })}>
                <option value="all">{t('orders.reports.filters.all')}</option>
                <option value="product">{t('orders.reports.filters.product')}</option>
                <option value="service">{t('orders.reports.filters.service')}</option>
              </select>
            </label>
          ) : null}
          {kind === 'sales' ? (
            <label className="report-filter-field">
              <span>{t('orders.reports.filters.paymentMethod')}</span>
              <select
                value={settings.paymentMethod}
                onChange={(e) => patch({ paymentMethod: e.target.value })}
              >
                <option value="">{t('orders.reports.filters.all')}</option>
                <option value="cash">{t('orders.reports.filters.cash')}</option>
                <option value="non-cash">{t('orders.reports.filters.nonCash')}</option>
                <option value="unpaid">{t('orders.reports.filters.unpaid')}</option>
              </select>
            </label>
          ) : null}
          <label className="report-filter-field">
            <span>{t('orders.reports.filters.search')}</span>
            <input
              type="search"
              value={settings.q}
              onChange={(e) => patch({ q: e.target.value })}
            />
          </label>
          {settings.lineName ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => patch({ lineName: '' })}
              title={t('orders.reports.drillDown')}
            >
              {t(
                settings.lineKind === 'service'
                  ? 'orders.reports.filters.service'
                  : settings.lineKind === 'product'
                    ? 'orders.reports.filters.product'
                    : 'orders.reports.columns.group',
              )}
              {': '}
              {settings.lineName}
            </button>
          ) : null}
          <label className="finance-profit-visual-check">
            <input
              type="checkbox"
              checked={settings.unpaidOnly}
              onChange={(e) => patch({ unpaidOnly: e.target.checked })}
            />
            {t('orders.reports.filters.unpaidOnly')}
          </label>
          {kind === 'procurement' ? (
            <label className="finance-profit-visual-check">
              <input
                type="checkbox"
                checked={settings.overdueOnly}
                onChange={(e) => patch({ overdueOnly: e.target.checked })}
              />
              {t('orders.reports.filters.overdueOnly')}
            </label>
          ) : null}
          {settings.mode === 'summary' ? (
            <>
              <label className="report-filter-field">
                <span>{t('orders.reports.groupBy')}</span>
                <select
                  value={settings.groupBy[0] ?? ''}
                  onChange={(e) => {
                    const first = e.target.value as OrdersReportGroupBy | '';
                    patch({
                      groupBy: first
                        ? [first, ...settings.groupBy.slice(1).filter((g) => g !== first)].slice(0, 2)
                        : [],
                    });
                  }}
                >
                  <option value="">{t('orders.reports.groupByNone')}</option>
                  {groupByOptionsForKind(kind).map((g) => (
                    <option key={g} value={g}>
                      {t(`orders.reports.groupByFields.${g}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="report-filter-field">
                <span>{t('orders.reports.groupBySecond')}</span>
                <select
                  value={settings.groupBy[1] ?? ''}
                  onChange={(e) => {
                    const second = e.target.value as OrdersReportGroupBy | '';
                    const first = settings.groupBy[0];
                    patch({
                      groupBy: first ? (second && second !== first ? [first, second] : [first]) : [],
                    });
                  }}
                >
                  <option value="">{t('orders.reports.groupByNone')}</option>
                  {groupByOptionsForKind(kind)
                    .filter((g) => g !== settings.groupBy[0])
                    .map((g) => (
                      <option key={g} value={g}>
                        {t(`orders.reports.groupByFields.${g}`)}
                      </option>
                    ))}
                </select>
              </label>
            </>
          ) : null}
        </div>

        <div className="report-upgrade-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setPickerOpen((open) => !open)}
          >
            {t('orders.reports.columnPicker')}
          </button>
          {canViewFinance && kind !== 'procurement' ? (
            <span className="muted-copy">{t('orders.reports.financeHint')}</span>
          ) : null}
        </div>
        {pickerOpen ? (
          <OrdersReportsColumnPicker
            columns={columnDefsForKind(kind).filter((col) => !col.finance || canViewFinance)}
            visibleKeys={visibleColumns}
            onChange={setVisibleColumns}
          />
        ) : null}

        {warnings.length > 0 ? <AnalyticsCoverageBanner warnings={warnings} /> : null}
        {isExporting && exportProgress ? (
          <div className="report-coverage-banner is-info" role="status">
            {t('orders.reports.exportProgress', {
              loaded: exportProgress.loaded,
              total: exportProgress.total,
              count: exportProgress.total,
            })}
          </div>
        ) : null}
        {exportError ? (
          <div className="report-coverage-banner is-warning" role="status">
            {exportError}
          </div>
        ) : null}

        {settings.mode === 'summary' ? (
          <AnalyticsSortableTable
            columns={summaryColumns}
            rows={summaryRows}
            getRowKey={(row) => row.key}
            loading={tableQuery.isLoading}
            error={tableQuery.error instanceof Error ? tableQuery.error.message : null}
            emptyText={t('orders.reports.empty')}
          />
        ) : (
          <AnalyticsSortableTable
            columns={registerColumns}
            rows={(report?.items ?? []) as unknown as Array<Record<string, unknown>>}
            getRowKey={(row) => String(row.id)}
            sortBy={settings.sortBy}
            sortDir={settings.sortDir}
            onSortChange={(sortBy, sortDir) => patch({ sortBy, sortDir })}
            loading={tableQuery.isLoading}
            error={tableQuery.error instanceof Error ? tableQuery.error.message : null}
            emptyText={t('orders.reports.empty')}
            page={page}
            pageSize={settings.pageSize}
            total={report?.total}
            onPageChange={setPage}
          />
        )}

        {grand ? (
          <div className="orders-reports-totals" role="status">
            <strong>{t('orders.reports.grandTotal')}</strong>
            {': '}
            {t('orders.reports.columns.count')}: {grand.count}
            {' · '}
            {t('orders.reports.columns.total')}: {money(grand.total)}
            {' · '}
            {t('orders.reports.columns.paid')}: {money(grand.paid)}
            {' · '}
            {t('orders.reports.columns.debt')}: {money(grand.debt)}
            {canViewFinance && typeof grand.knownCost === 'number' ? (
              <>
                {' · '}
                {t('orders.reports.columns.knownCost')}: {money(grand.knownCost)}
                {' · '}
                {t('orders.reports.columns.knownProfit')}: {money(grand.knownProfit ?? 0)}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
};

