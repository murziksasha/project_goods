import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import type { BoundedReportPeriod } from '../../../../entities/analytics';
import {
  getCashboxesReportDetails,
  useCashboxesReportDetailsQuery,
  useCashboxesReportQuery,
  type CashboxReconciliationRow,
  type CashboxesReportDetailItem,
  type PlannedCashEvent,
} from '../../../../entities/finance';
import {
  useCreateScenarioMutation,
  useDeleteScenarioMutation,
  useScenariosQuery,
  useUpdateScenarioMutation,
  type CashflowScenarioAssumptions,
} from '../../../../entities/scenario';
import { formatDate, formatDateTime } from '../../../../shared/lib/format';
import { exportReportWorkbookToDownload } from '../../../../shared/lib/report-excel';
import { formatMoney, type FinanceOverview } from '../../model/accounting';
import {
  AnalyticsComparisonBadge,
  AnalyticsCoverageBanner,
  AnalyticsInteractiveBars,
  AnalyticsKpiCard,
  AnalyticsSectionCard,
  AnalyticsSortableTable,
  AnalyticsTrendChart,
  ScenarioManagerBar,
  type SortableColumn,
} from '../common/AnalyticsPrimitives';

export interface AccountingReportsViewProps {
  financeOverview: FinanceOverview;
}

const PERIOD_OPTIONS: Array<{ key: BoundedReportPeriod; label: string }> = [
  { key: 'last30', label: 'Last 30 days' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
  { key: 'whole', label: 'All time' },
  { key: 'custom', label: 'Custom range' },
];

export const AccountingReportsView: React.FC<AccountingReportsViewProps> = ({
  financeOverview,
}) => {
  const { t } = useTranslation();

  // Period & filters (initial = last30)
  const [period, setPeriod] = useState<BoundedReportPeriod>('last30');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [cashboxId, setCashboxId] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('UAH');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'deposit' | 'withdraw' | 'transfer'>('all');
  const [txSearch, setTxSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('transactionDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Cashflow forecast assumptions
  const [horizonDays, setHorizonDays] = useState<30 | 60 | 90>(30);
  const [demandMultiplier, setDemandMultiplier] = useState(1);
  const [inflowMultiplier, setInflowMultiplier] = useState(1);
  const [outflowMultiplier, setOutflowMultiplier] = useState(1);
  const [inflowTimingShiftDays, setInflowTimingShiftDays] = useState(0);
  const [outflowTimingShiftDays, setOutflowTimingShiftDays] = useState(0);
  const [plannedEvents, setPlannedEvents] = useState<PlannedCashEvent[]>([]);

  // Planned event composer
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventType, setNewEventType] = useState<'inflow' | 'outflow'>('outflow');
  const [newEventAmount, setNewEventAmount] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [obligationDates, setObligationDates] = useState<Record<string, string>>({});

  // Private scenarios state
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioNotice, setScenarioNotice] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const reportParams = useMemo(
    () => ({
      period,
      dateFrom: period === 'custom' ? dateFrom : undefined,
      dateTo: period === 'custom' ? dateTo : undefined,
      cashboxId: cashboxId || undefined,
      horizonDays,
      demandMultiplier,
      inflowMultiplier,
      outflowMultiplier,
      inflowTimingShiftDays,
      outflowTimingShiftDays,
      plannedEvents,
    }),
    [
      period,
      dateFrom,
      dateTo,
      cashboxId,
      horizonDays,
      demandMultiplier,
      inflowMultiplier,
      outflowMultiplier,
      inflowTimingShiftDays,
      outflowTimingShiftDays,
      plannedEvents,
    ],
  );

  const reportQuery = useCashboxesReportQuery(reportParams);
  const report = reportQuery.data;

  const currencies = useMemo(() => {
    const list = report?.currencies ?? [];
    if (list.length > 0) return list;
    const overviewCurs = financeOverview.currencyRows.map((r) => r.currency);
    return overviewCurs.length > 0 ? overviewCurs : ['UAH'];
  }, [report?.currencies, financeOverview.currencyRows]);

  useEffect(() => {
    if (currencies.length > 0 && !currencies.includes(selectedCurrency)) {
      setSelectedCurrency(currencies[0]);
    }
  }, [currencies, selectedCurrency]);

  const activeCurrency = currencies.includes(selectedCurrency)
    ? selectedCurrency
    : currencies[0] ?? 'UAH';

  const detailsQuery = useCashboxesReportDetailsQuery({
    period,
    dateFrom: period === 'custom' ? dateFrom : undefined,
    dateTo: period === 'custom' ? dateTo : undefined,
    cashboxId: cashboxId || undefined,
    currency: activeCurrency,
    type: txTypeFilter,
    q: txSearch.trim() || undefined,
    page,
    pageSize: 25,
    sortBy,
    sortDir,
  });

  const scenariosQuery = useScenariosQuery('cashflow');
  const createScenarioMutation = useCreateScenarioMutation();
  const updateScenarioMutation = useUpdateScenarioMutation();
  const deleteScenarioMutation = useDeleteScenarioMutation();

  const currencyBucket = report?.byCurrency[activeCurrency] ?? null;

  const handleSelectScenario = (scenarioId: string) => {
    setSelectedScenarioId(scenarioId);
    setScenarioNotice(null);
    const found = (scenariosQuery.data ?? []).find((s) => s.id === scenarioId);
    if (!found) {
      setScenarioName('');
      return;
    }
    setScenarioName(found.name);
    setHorizonDays(found.horizonDays);
    const a = found.assumptions as Partial<CashflowScenarioAssumptions>;
    if (typeof a.demandMultiplier === 'number')
      setDemandMultiplier(a.demandMultiplier);
    if (typeof a.inflowMultiplier === 'number')
      setInflowMultiplier(a.inflowMultiplier);
    if (typeof a.outflowMultiplier === 'number')
      setOutflowMultiplier(a.outflowMultiplier);
    if (typeof a.inflowTimingShiftDays === 'number')
      setInflowTimingShiftDays(a.inflowTimingShiftDays);
    if (typeof a.outflowTimingShiftDays === 'number')
      setOutflowTimingShiftDays(a.outflowTimingShiftDays);
    if (Array.isArray(a.plannedEvents)) setPlannedEvents(a.plannedEvents);
    const f = (found.filters ?? {}) as Record<string, string>;
    if (typeof f.cashboxId === 'string') setCashboxId(f.cashboxId);
    if (typeof f.currency === 'string' && f.currency)
      setSelectedCurrency(f.currency);
    setPage(1);
  };

  const buildScenarioPayload = () => ({
    name: scenarioName.trim(),
    horizonDays,
    assumptions: {
      currency: activeCurrency,
      demandMultiplier,
      inflowMultiplier,
      outflowMultiplier,
      inflowTimingShiftDays,
      outflowTimingShiftDays,
      plannedEvents,
    },
    filters: {
      cashboxId,
      currency: activeCurrency,
    },
  });

  const handleSaveNewScenario = async () => {
    if (!scenarioName.trim()) return;
    const created = await createScenarioMutation.mutateAsync({
      domain: 'cashflow',
      ...buildScenarioPayload(),
    });
    setSelectedScenarioId(created.id);
    setScenarioNotice(`Saved private scenario "${created.name}".`);
  };

  const handleUpdateScenario = async () => {
    if (!selectedScenarioId || !scenarioName.trim()) return;
    const updated = await updateScenarioMutation.mutateAsync({
      scenarioId: selectedScenarioId,
      payload: buildScenarioPayload(),
    });
    setScenarioNotice(`Updated scenario "${updated.name}".`);
  };

  const handleDeleteScenario = async () => {
    if (!selectedScenarioId) return;
    await deleteScenarioMutation.mutateAsync(selectedScenarioId);
    setSelectedScenarioId('');
    setScenarioName('');
    setScenarioNotice('Deleted saved cashflow scenario.');
  };

  const addPlannedEvent = () => {
    const amount = Number(newEventAmount);
    if (!newEventTitle.trim() || !newEventDate || !Number.isFinite(amount) || amount <= 0)
      return;
    const nextEvt: PlannedCashEvent = {
      id: `custom-${Date.now()}`,
      title: newEventTitle.trim(),
      type: newEventType,
      amount: Math.round(amount * 100) / 100,
      currency: activeCurrency,
      scheduledDate: newEventDate,
    };
    setPlannedEvents((prev) => [...prev, nextEvt]);
    setNewEventTitle('');
    setNewEventAmount('');
    setNewEventDate('');
  };

  const scheduleObligation = (
    obligationKind: 'supplier_order' | 'sale_balance',
    obligationId: string,
    title: string,
    type: 'inflow' | 'outflow',
    amount: number,
    currency: string,
    fallbackDate?: string | null,
  ) => {
    const dateVal =
      obligationDates[`${obligationKind}:${obligationId}`] ?? fallbackDate ?? '';
    if (!dateVal) return;
    setPlannedEvents((prev) => [
      ...prev.filter(
        (evt) =>
          !(
            evt.obligationKind === obligationKind &&
            evt.obligationId === obligationId
          ),
      ),
      {
        id: `obl-${obligationKind}-${obligationId}`,
        title,
        type,
        amount,
        currency,
        scheduledDate: dateVal,
        obligationKind,
        obligationId,
      },
    ]);
  };

  const handleExportExcel = async () => {
    if (!report) return;
    setIsExporting(true);
    try {
      const det = await getCashboxesReportDetails({
        period,
        dateFrom: period === 'custom' ? dateFrom : undefined,
        dateTo: period === 'custom' ? dateTo : undefined,
        cashboxId: cashboxId || undefined,
        currency: activeCurrency,
        type: txTypeFilter,
        q: txSearch.trim() || undefined,
        page: 1,
        pageSize: 1000,
        sortBy,
        sortDir,
      });
      const warnings = [...report.coverage.warnings];
      if (det.total > det.items.length) {
        warnings.push(`Showing ${det.items.length} of ${det.total} transactions.`);
      }
      exportReportWorkbookToDownload({
        filename: `cashboxes-information-${activeCurrency}-${report.generatedAt.slice(0, 10)}.xlsx`,
        title: `Cashboxes Information & Cashflow (${activeCurrency})`,
        generatedAt: report.generatedAt,
        timeZone: report.timeZone,
        activeFilters: [
          {
            filter: 'Period',
            value: `${report.period.dateFrom ?? 'All'} to ${report.period.dateTo ?? 'All'}`,
          },
          { filter: 'Currency', value: activeCurrency },
          { filter: 'Cashbox', value: cashboxId || 'All' },
          { filter: 'Transaction Type', value: txTypeFilter },
          { filter: 'Forecast Horizon', value: `${horizonDays} days` },
        ],
        definitions: [
          {
            metric: 'External Inflows / Outflows',
            definition:
              'Non-cancelled deposits and withdrawals in selected currency; internal cashbox transfers are reported separately.',
          },
          {
            metric: 'Opening / Closing Reconciliation',
            definition:
              'Reverse-walk from current balance; unavailable when period overlaps sealed purge dates.',
          },
          {
            metric: 'Cash Forecast',
            definition:
              'Estimate projecting trailing 90d avg daily inflows/outflows with user multipliers, timing shifts, and explicitly scheduled events.',
          },
        ],
        warnings,
        sheets: [
          {
            name: 'Cashbox Reconciliation',
            rows: (currencyBucket?.reconciliation.perCashbox ?? []).map((cb) => ({
              Cashbox: cb.name,
              Currency: cb.currency,
              CurrentBalance: cb.currentBalance,
              OpeningBalance: cb.openingBalance ?? 'Sealed/Unavailable',
              ClosingBalance: cb.closingBalance ?? 'Sealed/Unavailable',
              Inflows: cb.inflows,
              Outflows: cb.outflows,
              TransfersIn: cb.transfersIn,
              TransfersOut: cb.transfersOut,
              Delta: cb.reconciliationDelta ?? 'N/A',
            })),
          },
          {
            name: 'Transactions Detail',
            rows: det.items.map((tx) => ({
              Date: tx.transactionDate.slice(0, 10),
              Type: tx.type,
              Category: tx.category,
              Amount: tx.amount,
              Currency: tx.currency,
              FromCashbox: tx.fromCashboxName ?? '',
              ToCashbox: tx.toCashboxName ?? '',
              Note: tx.note,
            })),
          },
          {
            name: `${horizonDays}d Forecast`,
            rows: (currencyBucket?.forecast.series ?? []).map((pt) => ({
              Day: pt.day,
              Date: pt.dateKey,
              BaselineInflow: pt.baselineInflow,
              BaselineOutflow: pt.baselineOutflow,
              PlannedInflow: pt.plannedInflow,
              PlannedOutflow: pt.plannedOutflow,
              ProjectedBalance: pt.projectedBalance,
            })),
          },
        ],
      });
    } finally {
      setIsExporting(false);
    }
  };

  const reconColumns: SortableColumn<CashboxReconciliationRow>[] = [
    {
      key: 'name',
      label: 'Cashbox',
      render: (r) => (
        <button
          type="button"
          className="finance-orders-number-button"
          onClick={() => {
            setCashboxId((prev) => (prev === r.cashboxId ? '' : r.cashboxId));
            setPage(1);
          }}
        >
          {r.name}
        </button>
      ),
    },
    {
      key: 'currentBalance',
      label: 'Current Balance',
      align: 'right',
      render: (r) => <strong>{formatMoney(r.currentBalance, r.currency)}</strong>,
    },
    {
      key: 'openingBalance',
      label: 'Opening',
      align: 'right',
      render: (r) =>
        r.openingBalance !== null ? (
          formatMoney(r.openingBalance, r.currency)
        ) : (
          <span className="muted-copy">Unavailable</span>
        ),
    },
    {
      key: 'inflows',
      label: 'Inflows / Outflows',
      align: 'right',
      render: (r) => (
        <div>
          <span className="report-badge is-success">
            +{formatMoney(r.inflows, r.currency)}
          </span>{' '}
          <span className="report-badge is-danger">
            -{formatMoney(r.outflows, r.currency)}
          </span>
        </div>
      ),
    },
    {
      key: 'transfers',
      label: 'Transfers (In / Out)',
      align: 'right',
      render: (r) => (
        <span className="muted-copy">
          +{formatMoney(r.transfersIn, r.currency)} / -{formatMoney(r.transfersOut, r.currency)}
        </span>
      ),
    },
    {
      key: 'closingBalance',
      label: 'Closing / Delta',
      align: 'right',
      render: (r) =>
        r.closingBalance !== null ? (
          <div>
            <strong>{formatMoney(r.closingBalance, r.currency)}</strong>
            <div className="muted-copy">
              Delta: {formatMoney(r.reconciliationDelta ?? 0, r.currency)}
            </div>
          </div>
        ) : (
          <span className="muted-copy">Sealed / All-time</span>
        ),
    },
  ];

  const txColumns: SortableColumn<CashboxesReportDetailItem>[] = [
    {
      key: 'transactionDate',
      label: 'Date',
      sortable: true,
      render: (tx) => formatDateTime(tx.transactionDate),
    },
    {
      key: 'type',
      label: 'Type / Category',
      sortable: true,
      render: (tx) => (
        <div>
          <span
            className={`report-badge ${
              tx.type === 'deposit'
                ? 'is-success'
                : tx.type === 'withdraw'
                  ? 'is-danger'
                  : 'is-info'
            }`}
          >
            {tx.type}
          </span>{' '}
          <span className="muted-copy">{tx.category || '-'}</span>
        </div>
      ),
    },
    {
      key: 'cashboxes',
      label: 'Cashboxes',
      render: (tx) =>
        tx.type === 'transfer'
          ? `${tx.fromCashboxName ?? ''} -> ${tx.toCashboxName ?? ''}`
          : tx.toCashboxName ?? tx.fromCashboxName ?? '-',
    },
    {
      key: 'note',
      label: 'Note',
      render: (tx) => tx.note || '-',
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      sortable: true,
      render: (tx) => <strong>{formatMoney(tx.amount, tx.currency)}</strong>,
    },
  ];

  return (
    <section className="finance-information">
      <div className="report-upgrade-shell">
        <div className="report-upgrade-header">
          <div>
            <p className="section-label">{t('accounting.reports.sectionLabel')}</p>
            <h2 className="report-upgrade-header-title">
              {t('accounting.reports.title')}
            </h2>
            <p className="report-upgrade-header-subtitle">
              Per-currency balances, external inflows/outflows vs internal transfers,
              period reconciliation, and 30/60/90-day cash forecasting.
            </p>
          </div>
          <div className="report-upgrade-actions">
            <div className="report-subview-tabs" role="tablist" aria-label="Currencies">
              {currencies.map((cur) => (
                <button
                  key={cur}
                  type="button"
                  role="tab"
                  aria-selected={activeCurrency === cur}
                  className={`report-toggle-chip ${
                    activeCurrency === cur ? 'is-active' : ''
                  }`.trim()}
                  onClick={() => {
                    setSelectedCurrency(cur);
                    setPage(1);
                  }}
                >
                  {cur}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="primary-button"
              disabled={!report || isExporting}
              onClick={() => void handleExportExcel()}
            >
              {isExporting ? 'Exporting...' : 'Export Excel (.xlsx)'}
            </button>
          </div>
        </div>

        <div className="report-filter-bar" role="search" aria-label="Cashbox report filters">
          <div className="report-filter-field">
            <label htmlFor="cb-period">Period</label>
            <select
              id="cb-period"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value as BoundedReportPeriod);
                setPage(1);
              }}
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {period === 'custom' ? (
            <>
              <div className="report-filter-field">
                <label htmlFor="cb-from">From</label>
                <input
                  id="cb-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="report-filter-field">
                <label htmlFor="cb-to">To</label>
                <input
                  id="cb-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </>
          ) : null}
          <div className="report-filter-field">
            <label htmlFor="cb-cashbox">Cashbox</label>
            <select
              id="cb-cashbox"
              value={cashboxId}
              onChange={(e) => {
                setCashboxId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All cashboxes</option>
              {(report?.cashboxes ?? []).map((cb) => (
                <option key={cb.id} value={cb.id}>
                  {cb.name}
                  {cb.isArchived ? ' (Archived)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="report-filter-field">
            <label htmlFor="cb-tx-type">Operation Type</label>
            <select
              id="cb-tx-type"
              value={txTypeFilter}
              onChange={(e) => {
                setTxTypeFilter(
                  e.target.value as 'all' | 'deposit' | 'withdraw' | 'transfer',
                );
                setPage(1);
              }}
            >
              <option value="all">All operations</option>
              <option value="deposit">Deposits (inflows)</option>
              <option value="withdraw">Withdrawals (outflows)</option>
              <option value="transfer">Internal transfers</option>
            </select>
          </div>
          <div className="report-filter-field">
            <label htmlFor="cb-search">Search Notes</label>
            <input
              id="cb-search"
              type="search"
              value={txSearch}
              placeholder="Note, category, cashbox..."
              onChange={(e) => {
                setTxSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {reportQuery.isError ? (
          <div className="report-state-box is-error" role="alert">
            {reportQuery.error instanceof Error
              ? reportQuery.error.message
              : 'Failed to load cashboxes report.'}
          </div>
        ) : null}

        {report && currencyBucket ? (
          <>
            <AnalyticsCoverageBanner
              title="Archive Seal & History Coverage"
              warnings={report.coverage.warnings}
            />

            <div className="report-kpi-grid">
              <AnalyticsKpiCard
                label={`Current Balance (${activeCurrency})`}
                value={formatMoney(currencyBucket.currentBalance, activeCurrency)}
                hint={
                  currencyBucket.reconciliation.complete &&
                  currencyBucket.reconciliation.openingBalance !== null
                    ? `Opening: ${formatMoney(currencyBucket.reconciliation.openingBalance, activeCurrency)} → Closing: ${formatMoney(currencyBucket.reconciliation.closingBalance ?? 0, activeCurrency)}`
                    : report.coverage.reconciliationUnavailableBySeal
                      ? 'Reconciliation unavailable inside sealed purge window'
                      : 'Select bounded period for opening/closing reconciliation'
                }
              />
              <AnalyticsKpiCard
                label={`External Inflows (${activeCurrency})`}
                value={formatMoney(currencyBucket.inflows, activeCurrency)}
                deltaPct={currencyBucket.comparison?.inflowsDeltaPct}
                hint={`${currencyBucket.inflowsCount} deposit operation(s)`}
              />
              <AnalyticsKpiCard
                label={`External Outflows (${activeCurrency})`}
                value={formatMoney(currencyBucket.outflows, activeCurrency)}
                deltaPct={currencyBucket.comparison?.outflowsDeltaPct}
                invertDelta
                hint={`${currencyBucket.outflowsCount} withdrawal operation(s)`}
              />
              <AnalyticsKpiCard
                label={`Net External Cashflow (${activeCurrency})`}
                value={formatMoney(currencyBucket.netExternalCashflow, activeCurrency)}
                badge={
                  currencyBucket.comparison ? (
                    <span className="report-badge">
                      Prev: {formatMoney(currencyBucket.comparison.netExternalCashflowPrev, activeCurrency)}
                    </span>
                  ) : undefined
                }
                hint={`Internal transfers (shown separately): ${formatMoney(currencyBucket.transfersVolume, activeCurrency)} (${currencyBucket.transfersCount})`}
              />
            </div>

            <div className="report-two-col-grid">
              <AnalyticsSectionCard
                title={`Daily Cashflow Trend (${activeCurrency})`}
                subtitle="External inflows vs outflows; transfers isolated separately."
              >
                <AnalyticsTrendChart
                  points={currencyBucket.trend}
                  formatYValue={(v) => formatMoney(v, activeCurrency)}
                  series={[
                    {
                      key: 'inflows',
                      label: 'Inflows',
                      color: 'var(--color-success)',
                      getValue: (pt) => pt.inflows,
                    },
                    {
                      key: 'outflows',
                      label: 'Outflows',
                      color: 'var(--color-danger)',
                      getValue: (pt) => pt.outflows,
                    },
                    {
                      key: 'transfers',
                      label: 'Transfers',
                      color: 'var(--color-info)',
                      getValue: (pt) => pt.transfers,
                    },
                  ]}
                />
              </AnalyticsSectionCard>

              <AnalyticsSectionCard
                title={`Balances by Cashbox (${activeCurrency})`}
                subtitle="Click a cashbox to filter period transactions and reconciliation."
              >
                <AnalyticsInteractiveBars
                  selectedId={cashboxId || null}
                  onSelect={(cbId) => {
                    setCashboxId((prev) => (prev === cbId ? '' : cbId));
                    setPage(1);
                  }}
                  items={currencyBucket.reconciliation.perCashbox.map((cb) => ({
                    id: cb.cashboxId,
                    label: cb.name,
                    value: Math.max(cb.currentBalance, 0),
                    valueText: formatMoney(cb.currentBalance, activeCurrency),
                    tone: cb.currentBalance < 0 ? 'danger' : 'primary',
                  }))}
                />
              </AnalyticsSectionCard>
            </div>

            <AnalyticsSectionCard
              title={`Opening / Closing Balance Reconciliation (${activeCurrency})`}
              subtitle={
                currencyBucket.reconciliation.complete
                  ? `Net Delta: ${formatMoney(currencyBucket.reconciliation.reconciliationDelta ?? 0, activeCurrency)} (${currencyBucket.reconciliation.reconciled ? 'Reconciled' : 'Variance detected'})`
                  : 'Reconciliation unavailable (all-time or overlaps sealed snapshot purge boundary).'
              }
            >
              <AnalyticsSortableTable
                columns={reconColumns}
                rows={currencyBucket.reconciliation.perCashbox}
                getRowKey={(r) => r.cashboxId}
              />
            </AnalyticsSectionCard>

            {/* CASHFLOW FORECASTING & SCENARIOS */}
            <AnalyticsSectionCard
              title={`Cashflow Scenario Projection (${activeCurrency})`}
              subtitle={`Starts from ${formatMoney(currencyBucket.forecast.startingBalance, activeCurrency)} using trailing ${report.coverage.observedHistoryDays}/${report.coverage.historyWindowDays}d external averages (${formatMoney(currencyBucket.forecast.avgDailyInflow, activeCurrency)}/d in, ${formatMoney(currencyBucket.forecast.avgDailyOutflow, activeCurrency)}/d out). Scenarios never post payments automatically.`}
              actions={<span className="report-estimate-pill">Estimate Only</span>}
            >
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
              />
              {scenarioNotice ? (
                <div className="report-coverage-banner is-info" role="status">
                  {scenarioNotice}
                </div>
              ) : null}

              <div className="report-filter-bar">
                <div className="report-filter-field">
                  <label htmlFor="cf-horizon">Horizon</label>
                  <select
                    id="cf-horizon"
                    value={String(horizonDays)}
                    onChange={(e) =>
                      setHorizonDays((Number(e.target.value) as 30 | 60 | 90) || 30)
                    }
                  >
                    <option value="30">30 days</option>
                    <option value="60">60 days</option>
                    <option value="90">90 days</option>
                  </select>
                </div>
                <div className="report-filter-field">
                  <label htmlFor="cf-demand-mult">Demand Multiplier</label>
                  <input
                    id="cf-demand-mult"
                    type="number"
                    min={0.1}
                    max={5}
                    step={0.1}
                    value={demandMultiplier}
                    onChange={(e) =>
                      setDemandMultiplier(
                        Math.min(Math.max(Number(e.target.value) || 1, 0.1), 5),
                      )
                    }
                  />
                </div>
                <div className="report-filter-field">
                  <label htmlFor="cf-inflow-mult">Inflow Multiplier</label>
                  <input
                    id="cf-inflow-mult"
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    value={inflowMultiplier}
                    onChange={(e) =>
                      setInflowMultiplier(
                        Math.min(Math.max(Number(e.target.value) || 0, 0), 5),
                      )
                    }
                  />
                </div>
                <div className="report-filter-field">
                  <label htmlFor="cf-outflow-mult">Outflow Multiplier</label>
                  <input
                    id="cf-outflow-mult"
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    value={outflowMultiplier}
                    onChange={(e) =>
                      setOutflowMultiplier(
                        Math.min(Math.max(Number(e.target.value) || 0, 0), 5),
                      )
                    }
                  />
                </div>
                <div className="report-filter-field">
                  <label htmlFor="cf-inflow-shift">Collection Shift (days)</label>
                  <input
                    id="cf-inflow-shift"
                    type="number"
                    min={-30}
                    max={60}
                    value={inflowTimingShiftDays}
                    onChange={(e) =>
                      setInflowTimingShiftDays(
                        Math.min(Math.max(Number(e.target.value) || 0, -30), 60),
                      )
                    }
                  />
                </div>
                <div className="report-filter-field">
                  <label htmlFor="cf-outflow-shift">Payment Shift (days)</label>
                  <input
                    id="cf-outflow-shift"
                    type="number"
                    min={-30}
                    max={60}
                    value={outflowTimingShiftDays}
                    onChange={(e) =>
                      setOutflowTimingShiftDays(
                        Math.min(Math.max(Number(e.target.value) || 0, -30), 60),
                      )
                    }
                  />
                </div>
              </div>

              <div className="report-kpi-grid">
                <AnalyticsKpiCard
                  label={`${horizonDays}d Projected Ending Balance`}
                  value={formatMoney(currencyBucket.forecast.endingProjectedBalance, activeCurrency)}
                  tone={
                    currencyBucket.forecast.endingProjectedBalance < 0
                      ? 'danger'
                      : 'default'
                  }
                  badge={<AnalyticsComparisonBadge deltaPct={null} />}
                  hint={`Lowest projected point: ${formatMoney(currencyBucket.forecast.lowestProjectedBalance, activeCurrency)}`}
                />
                <AnalyticsKpiCard
                  label={`Projected Baseline Flows (${horizonDays}d)`}
                  value={`+${formatMoney(currencyBucket.forecast.totalProjectedBaselineInflows, activeCurrency)} / -${formatMoney(currencyBucket.forecast.totalProjectedBaselineOutflows, activeCurrency)}`}
                  hint={`Planned events: +${formatMoney(currencyBucket.forecast.totalPlannedInflows, activeCurrency)} / -${formatMoney(currencyBucket.forecast.totalPlannedOutflows, activeCurrency)}`}
                />
                <AnalyticsKpiCard
                  label="Unscheduled Open Obligations"
                  value={`${report.obligationSummary.unscheduledCount} item(s)`}
                  hint={`Receivables: ${formatMoney(report.obligationSummary.unscheduledReceivablesTotal, 'UAH')} · Payables: ${formatMoney(report.obligationSummary.unscheduledPayablesTotal, 'UAH')} (excluded from baseline until dated)`}
                />
              </div>

              <AnalyticsTrendChart
                points={currencyBucket.forecast.series}
                formatYValue={(v) => formatMoney(v, activeCurrency)}
                series={[
                  {
                    key: 'projectedBalance',
                    label: `Projected Balance (${activeCurrency})`,
                    color: 'var(--color-primary)',
                    getValue: (pt) => pt.projectedBalance,
                  },
                ]}
              />

              {/* Planned Events & Unscheduled Obligations Manager */}
              <div className="report-two-col-grid">
                <div style={{ display: 'grid', gap: 8 }}>
                  <strong style={{ fontSize: '0.88rem' }}>
                    Planned Cash Events ({plannedEvents.length})
                  </strong>
                  <div className="report-filter-bar">
                    <div className="report-filter-field">
                      <label htmlFor="cf-evt-title">Title</label>
                      <input
                        id="cf-evt-title"
                        type="text"
                        value={newEventTitle}
                        placeholder="Rent, tax, capital..."
                        onChange={(e) => setNewEventTitle(e.target.value)}
                      />
                    </div>
                    <div className="report-filter-field">
                      <label htmlFor="cf-evt-type">Type</label>
                      <select
                        id="cf-evt-type"
                        value={newEventType}
                        onChange={(e) =>
                          setNewEventType(
                            e.target.value === 'inflow' ? 'inflow' : 'outflow',
                          )
                        }
                      >
                        <option value="outflow">Outflow</option>
                        <option value="inflow">Inflow</option>
                      </select>
                    </div>
                    <div className="report-filter-field">
                      <label htmlFor="cf-evt-amount">Amount ({activeCurrency})</label>
                      <input
                        id="cf-evt-amount"
                        type="number"
                        min={0}
                        step={0.01}
                        value={newEventAmount}
                        onChange={(e) => setNewEventAmount(e.target.value)}
                      />
                    </div>
                    <div className="report-filter-field">
                      <label htmlFor="cf-evt-date">Date</label>
                      <input
                        id="cf-evt-date"
                        type="date"
                        value={newEventDate}
                        onChange={(e) => setNewEventDate(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={addPlannedEvent}
                    >
                      Add Planned Event
                    </button>
                  </div>

                  {plannedEvents.map((evt) => (
                    <div
                      key={evt.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 10px',
                        border: '1px solid var(--color-line)',
                        borderRadius: 6,
                        fontSize: '0.82rem',
                      }}
                    >
                      <span>
                        <strong>{evt.title}</strong> ({evt.type}, {evt.scheduledDate}):{' '}
                        {formatMoney(evt.amount, evt.currency)}
                      </span>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          setPlannedEvents((prev) =>
                            prev.filter((item) => item.id !== evt.id),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  <strong style={{ fontSize: '0.88rem' }}>
                    Unscheduled Obligations (assign date to include without double-counting)
                  </strong>
                  {report.unscheduledObligations.length === 0 ? (
                    <div className="report-state-box">
                      All open supplier/client obligations are either settled or scheduled.
                    </div>
                  ) : (
                    report.unscheduledObligations.slice(0, 8).map((obl) => {
                      const key = `${obl.obligationKind}:${obl.obligationId}`;
                      return (
                        <div
                          key={key}
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 10px',
                            border: '1px solid var(--color-line)',
                            borderRadius: 6,
                            fontSize: '0.82rem',
                          }}
                        >
                          <div>
                            <strong>{obl.label}</strong>{' '}
                            <span
                              className={`report-badge ${
                                obl.type === 'inflow' ? 'is-success' : 'is-warning'
                              }`}
                            >
                              {obl.type === 'inflow' ? '+' : '-'}
                              {formatMoney(obl.amount, obl.currency)}
                            </span>
                            {obl.dueDate ? (
                              <span className="muted-copy"> (Due {formatDate(obl.dueDate)})</span>
                            ) : null}
                          </div>
                          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            <input
                              type="date"
                              aria-label={`Schedule date for ${obl.label}`}
                              value={obligationDates[key] ?? obl.dueDate ?? ''}
                              onChange={(e) =>
                                setObligationDates((prev) => ({
                                  ...prev,
                                  [key]: e.target.value,
                                }))
                              }
                            />
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() =>
                                scheduleObligation(
                                  obl.obligationKind,
                                  obl.obligationId,
                                  obl.label,
                                  obl.type,
                                  obl.amount,
                                  obl.currency,
                                  obl.dueDate,
                                )
                              }
                            >
                              Schedule
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </AnalyticsSectionCard>
          </>
        ) : (
          <>
            <div className="finance-report-grid finance-report-grid-wide">
              <article className="analytics-summary-card">
                <span className="metric-label">
                  {t('accounting.reports.transactions')}
                </span>
                <strong>{financeOverview.transactionCount}</strong>
              </article>
              <article className="analytics-summary-card">
                <span className="metric-label">
                  {t('accounting.reports.todayOperations')}
                </span>
                <strong>{financeOverview.todayTransactionCount}</strong>
              </article>
              <article className="analytics-summary-card">
                <span className="metric-label">
                  {t('accounting.reports.pendingSupplierPayments')}
                </span>
                <strong>
                  {formatMoney(financeOverview.pendingSupplierTotal, 'UAH')}
                </strong>
              </article>
              <article className="analytics-summary-card">
                <span className="metric-label">
                  {t('accounting.reports.paymentQueue')}
                </span>
                <strong>{financeOverview.pendingSupplierCount}</strong>
              </article>
            </div>
            {reportQuery.isLoading ? (
              <div className="report-state-box">Loading cashboxes report...</div>
            ) : null}
          </>
        )}

        <AnalyticsSectionCard
          title={`Transactions Drill-Down (${activeCurrency})`}
          subtitle={
            detailsQuery.data
              ? `Matching total across all pages: ${detailsQuery.data.total} operation(s)`
              : undefined
          }
        >
          <AnalyticsSortableTable
            columns={txColumns}
            rows={detailsQuery.data?.items ?? []}
            getRowKey={(tx) => tx.id}
            sortBy={sortBy}
            sortDir={sortDir}
            onSortChange={(k, d) => {
              setSortBy(k);
              setSortDir(d);
              setPage(1);
            }}
            loading={detailsQuery.isLoading}
            error={
              detailsQuery.isError
                ? detailsQuery.error instanceof Error
                  ? detailsQuery.error.message
                  : 'Failed to load cashbox transactions.'
                : null
            }
            page={detailsQuery.data?.page ?? page}
            pageSize={detailsQuery.data?.pageSize ?? 25}
            total={detailsQuery.data?.total ?? 0}
            onPageChange={setPage}
          />
        </AnalyticsSectionCard>
      </div>
    </section>
  );
};
