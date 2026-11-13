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
import {
  displayCurrencyCode,
  formatMoney,
  type FinanceOverview,
} from '../../model/accounting';
import {
  translateCashboxCoverageWarnings,
  translatePeriodLabel,
  translateTxType,
} from '../../model/accounting-analytics-i18n';
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

const PERIOD_KEYS: BoundedReportPeriod[] = [
  'last30',
  'last7',
  'day',
  'week',
  'month',
  'year',
  'whole',
  'custom',
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
    setScenarioNotice(
      t('accounting.reports.scenarios.saved', { name: created.name }),
    );
  };

  const handleUpdateScenario = async () => {
    if (!selectedScenarioId || !scenarioName.trim()) return;
    const updated = await updateScenarioMutation.mutateAsync({
      scenarioId: selectedScenarioId,
      payload: buildScenarioPayload(),
    });
    setScenarioNotice(
      t('accounting.reports.scenarios.updated', { name: updated.name }),
    );
  };

  const handleDeleteScenario = async () => {
    if (!selectedScenarioId) return;
    await deleteScenarioMutation.mutateAsync(selectedScenarioId);
    setSelectedScenarioId('');
    setScenarioName('');
    setScenarioNotice(t('accounting.reports.scenarios.deleted'));
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

  const allLabel = t('accounting.reports.filters.all');
  const currencyLabel = displayCurrencyCode(activeCurrency);
  const exportCol = (key: string) => t(`accounting.reports.export.cols.${key}`);
  const coverageWarnings = report
    ? translateCashboxCoverageWarnings(
        t,
        report.coverage.warnings,
        report.coverage.warningItems,
      )
    : [];

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
      const warnings = [...coverageWarnings];
      if (det.total > det.items.length) {
        warnings.push(
          t('accounting.reports.export.showingOf', {
            shown: det.items.length,
            total: det.total,
            count: det.total,
          }),
        );
      }
      const sealedOrNa = (value: number | null) =>
        value ?? t('accounting.reports.sealedUnavailable');
      exportReportWorkbookToDownload({
        filename: `cashboxes-information-${activeCurrency}-${report.generatedAt.slice(0, 10)}.xlsx`,
        title: t('accounting.reports.export.forecastTitle', {
          currency: currencyLabel,
        }),
        generatedAt: report.generatedAt,
        timeZone: report.timeZone,
        activeFilters: [
          {
            filter: t('accounting.reports.filters.period'),
            value: t('accounting.reports.periods.range', {
              from: report.period.dateFrom ?? allLabel,
              to: report.period.dateTo ?? allLabel,
            }),
          },
          {
            filter: t('accounting.reports.filters.currency'),
            value: currencyLabel,
          },
          {
            filter: t('accounting.reports.filters.cashbox'),
            value: cashboxId || allLabel,
          },
          {
            filter: t('accounting.reports.filters.transactionType'),
            value:
              txTypeFilter === 'all'
                ? t('accounting.reports.filters.allOperations')
                : translateTxType(t, txTypeFilter),
          },
          {
            filter: t('accounting.reports.filters.forecastHorizon'),
            value: t('accounting.reports.filters.horizonDaysValue', {
              count: horizonDays,
            }),
          },
        ],
        definitions: [
          {
            metric: t('accounting.reports.export.definitions.externalFlows'),
            definition: t(
              'accounting.reports.export.definitions.externalFlowsDef',
            ),
          },
          {
            metric: t('accounting.reports.export.definitions.reconciliation'),
            definition: t(
              'accounting.reports.export.definitions.reconciliationDef',
            ),
          },
          {
            metric: t('accounting.reports.export.definitions.cashForecast'),
            definition: t(
              'accounting.reports.export.definitions.cashForecastDef',
            ),
          },
        ],
        warnings,
        sheets: [
          {
            name: t('accounting.reports.export.sheetReconciliation'),
            rows: (currencyBucket?.reconciliation.perCashbox ?? []).map((cb) => ({
              [exportCol('Cashbox')]: cb.name,
              [exportCol('Currency')]: displayCurrencyCode(cb.currency),
              [exportCol('CurrentBalance')]: cb.currentBalance,
              [exportCol('OpeningBalance')]: sealedOrNa(cb.openingBalance),
              [exportCol('ClosingBalance')]: sealedOrNa(cb.closingBalance),
              [exportCol('Inflows')]: cb.inflows,
              [exportCol('Outflows')]: cb.outflows,
              [exportCol('TransfersIn')]: cb.transfersIn,
              [exportCol('TransfersOut')]: cb.transfersOut,
              [exportCol('Delta')]:
                cb.reconciliationDelta ?? t('accounting.reports.na'),
            })),
          },
          {
            name: t('accounting.reports.export.sheetTransactions'),
            rows: det.items.map((tx) => ({
              [exportCol('Date')]: tx.transactionDate.slice(0, 10),
              [exportCol('Type')]: translateTxType(t, tx.type),
              [exportCol('Category')]: tx.category,
              [exportCol('Amount')]: tx.amount,
              [exportCol('Currency')]: displayCurrencyCode(tx.currency),
              [exportCol('FromCashbox')]: tx.fromCashboxName ?? '',
              [exportCol('ToCashbox')]: tx.toCashboxName ?? '',
              [exportCol('Note')]: tx.note,
            })),
          },
          {
            name: t('accounting.reports.export.sheetForecast', {
              days: horizonDays,
            }),
            rows: (currencyBucket?.forecast.series ?? []).map((pt) => ({
              [exportCol('Day')]: pt.day,
              [exportCol('Date')]: pt.dateKey,
              [exportCol('BaselineInflow')]: pt.baselineInflow,
              [exportCol('BaselineOutflow')]: pt.baselineOutflow,
              [exportCol('PlannedInflow')]: pt.plannedInflow,
              [exportCol('PlannedOutflow')]: pt.plannedOutflow,
              [exportCol('ProjectedBalance')]: pt.projectedBalance,
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
      label: t('accounting.reports.columns.cashbox'),
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
      label: t('accounting.reports.columns.currentBalance'),
      align: 'right',
      render: (r) => <strong>{formatMoney(r.currentBalance, r.currency)}</strong>,
    },
    {
      key: 'openingBalance',
      label: t('accounting.reports.columns.opening'),
      align: 'right',
      render: (r) =>
        r.openingBalance !== null ? (
          formatMoney(r.openingBalance, r.currency)
        ) : (
          <span className="muted-copy">
            {t('accounting.reports.cells.unavailable')}
          </span>
        ),
    },
    {
      key: 'inflows',
      label: t('accounting.reports.columns.inflowsOutflows'),
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
      label: t('accounting.reports.columns.transfersInOut'),
      align: 'right',
      render: (r) => (
        <span className="muted-copy">
          +{formatMoney(r.transfersIn, r.currency)} / -{formatMoney(r.transfersOut, r.currency)}
        </span>
      ),
    },
    {
      key: 'closingBalance',
      label: t('accounting.reports.columns.closingDelta'),
      align: 'right',
      render: (r) =>
        r.closingBalance !== null ? (
          <div>
            <strong>{formatMoney(r.closingBalance, r.currency)}</strong>
            <div className="muted-copy">
              {t('accounting.reports.cells.delta', {
                amount: formatMoney(r.reconciliationDelta ?? 0, r.currency),
              })}
            </div>
          </div>
        ) : (
          <span className="muted-copy">
            {t('accounting.reports.cells.sealedAllTime')}
          </span>
        ),
    },
  ];

  const txColumns: SortableColumn<CashboxesReportDetailItem>[] = [
    {
      key: 'transactionDate',
      label: t('accounting.reports.columns.date'),
      sortable: true,
      render: (tx) => formatDateTime(tx.transactionDate),
    },
    {
      key: 'type',
      label: t('accounting.reports.columns.typeCategory'),
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
            {translateTxType(t, tx.type)}
          </span>{' '}
          <span className="muted-copy">{tx.category || '-'}</span>
        </div>
      ),
    },
    {
      key: 'cashboxes',
      label: t('accounting.reports.columns.cashboxes'),
      render: (tx) =>
        tx.type === 'transfer'
          ? t('accounting.reports.cells.transferPath', {
              from: tx.fromCashboxName ?? '',
              to: tx.toCashboxName ?? '',
            })
          : tx.toCashboxName ?? tx.fromCashboxName ?? '-',
    },
    {
      key: 'note',
      label: t('accounting.reports.columns.note'),
      render: (tx) => tx.note || '-',
    },
    {
      key: 'amount',
      label: t('accounting.reports.columns.amount'),
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
              {t('accounting.reports.subtitle')}
            </p>
          </div>
          <div className="report-upgrade-actions">
            <div
              className="report-subview-tabs"
              role="tablist"
              aria-label={t('accounting.reports.currenciesAria')}
            >
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
              {isExporting
                ? t('common.exporting')
                : t('accounting.reports.exportExcel')}
            </button>
          </div>
        </div>

        <div
          className="report-filter-bar"
          role="search"
          aria-label={t('accounting.reports.filtersAria')}
        >
          <div className="report-filter-field">
            <label htmlFor="cb-period">
              {t('accounting.reports.filters.period')}
            </label>
            <select
              id="cb-period"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value as BoundedReportPeriod);
                setPage(1);
              }}
            >
              {PERIOD_KEYS.map((key) => (
                <option key={key} value={key}>
                  {translatePeriodLabel(t, key)}
                </option>
              ))}
            </select>
          </div>
          {period === 'custom' ? (
            <>
              <div className="report-filter-field">
                <label htmlFor="cb-from">
                  {t('accounting.reports.filters.from')}
                </label>
                <input
                  id="cb-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="report-filter-field">
                <label htmlFor="cb-to">{t('accounting.reports.filters.to')}</label>
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
            <label htmlFor="cb-cashbox">
              {t('accounting.reports.filters.cashbox')}
            </label>
            <select
              id="cb-cashbox"
              value={cashboxId}
              onChange={(e) => {
                setCashboxId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">
                {t('accounting.transactions.allCashboxes')}
              </option>
              {(report?.cashboxes ?? []).map((cb) => (
                <option key={cb.id} value={cb.id}>
                  {cb.name}
                  {cb.isArchived ? t('accounting.reports.archivedSuffix') : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="report-filter-field">
            <label htmlFor="cb-tx-type">
              {t('accounting.reports.filters.operationType')}
            </label>
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
              <option value="all">
                {t('accounting.reports.filters.allOperations')}
              </option>
              <option value="deposit">
                {t('accounting.reports.filters.depositsInflows')}
              </option>
              <option value="withdraw">
                {t('accounting.reports.filters.withdrawalsOutflows')}
              </option>
              <option value="transfer">
                {t('accounting.reports.filters.internalTransfers')}
              </option>
            </select>
          </div>
          <div className="report-filter-field">
            <label htmlFor="cb-search">
              {t('accounting.reports.filters.searchNotes')}
            </label>
            <input
              id="cb-search"
              type="search"
              value={txSearch}
              placeholder={t('accounting.reports.filters.searchPlaceholder')}
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
              : t('accounting.reports.errors.loadReport')}
          </div>
        ) : null}

        {report && currencyBucket ? (
          <>
            <AnalyticsCoverageBanner
              title={t('accounting.reports.coverage.title')}
              warnings={coverageWarnings}
            />

            <div className="report-kpi-grid">
              <AnalyticsKpiCard
                label={t('accounting.reports.kpi.currentBalance', {
                  currency: currencyLabel,
                })}
                value={formatMoney(currencyBucket.currentBalance, activeCurrency)}
                hint={
                  currencyBucket.reconciliation.complete &&
                  currencyBucket.reconciliation.openingBalance !== null
                    ? t('accounting.reports.kpi.openingClosing', {
                        opening: formatMoney(
                          currencyBucket.reconciliation.openingBalance,
                          activeCurrency,
                        ),
                        closing: formatMoney(
                          currencyBucket.reconciliation.closingBalance ?? 0,
                          activeCurrency,
                        ),
                      })
                    : report.coverage.reconciliationUnavailableBySeal
                      ? t('accounting.reports.kpi.reconUnavailableSeal')
                      : t('accounting.reports.kpi.selectBoundedPeriod')
                }
              />
              <AnalyticsKpiCard
                label={t('accounting.reports.kpi.externalInflows', {
                  currency: currencyLabel,
                })}
                value={formatMoney(currencyBucket.inflows, activeCurrency)}
                deltaPct={currencyBucket.comparison?.inflowsDeltaPct}
                hint={t('accounting.reports.kpi.depositOperations', {
                  count: currencyBucket.inflowsCount,
                })}
              />
              <AnalyticsKpiCard
                label={t('accounting.reports.kpi.externalOutflows', {
                  currency: currencyLabel,
                })}
                value={formatMoney(currencyBucket.outflows, activeCurrency)}
                deltaPct={currencyBucket.comparison?.outflowsDeltaPct}
                invertDelta
                hint={t('accounting.reports.kpi.withdrawalOperations', {
                  count: currencyBucket.outflowsCount,
                })}
              />
              <AnalyticsKpiCard
                label={t('accounting.reports.kpi.netExternalCashflow', {
                  currency: currencyLabel,
                })}
                value={formatMoney(currencyBucket.netExternalCashflow, activeCurrency)}
                badge={
                  currencyBucket.comparison ? (
                    <span className="report-badge">
                      {t('accounting.reports.kpi.prev', {
                        amount: formatMoney(
                          currencyBucket.comparison.netExternalCashflowPrev,
                          activeCurrency,
                        ),
                      })}
                    </span>
                  ) : undefined
                }
                hint={t('accounting.reports.kpi.internalTransfersHint', {
                  amount: formatMoney(
                    currencyBucket.transfersVolume,
                    activeCurrency,
                  ),
                  count: currencyBucket.transfersCount,
                })}
              />
            </div>

            <div className="report-two-col-grid">
              <AnalyticsSectionCard
                title={t('accounting.reports.sections.dailyTrend', {
                  currency: currencyLabel,
                })}
                subtitle={t('accounting.reports.sections.dailyTrendSubtitle')}
              >
                <AnalyticsTrendChart
                  points={currencyBucket.trend}
                  formatYValue={(v) => formatMoney(v, activeCurrency)}
                  series={[
                    {
                      key: 'inflows',
                      label: t('accounting.reports.series.inflows'),
                      color: 'var(--color-success)',
                      getValue: (pt) => pt.inflows,
                    },
                    {
                      key: 'outflows',
                      label: t('accounting.reports.series.outflows'),
                      color: 'var(--color-danger)',
                      getValue: (pt) => pt.outflows,
                    },
                    {
                      key: 'transfers',
                      label: t('accounting.reports.series.transfers'),
                      color: 'var(--color-info)',
                      getValue: (pt) => pt.transfers,
                    },
                  ]}
                />
              </AnalyticsSectionCard>

              <AnalyticsSectionCard
                title={t('accounting.reports.sections.balancesByCashbox', {
                  currency: currencyLabel,
                })}
                subtitle={t('accounting.reports.sections.balancesSubtitle')}
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
              title={t('accounting.reports.sections.reconciliation', {
                currency: currencyLabel,
              })}
              subtitle={
                currencyBucket.reconciliation.complete
                  ? t('accounting.reports.sections.reconNetDelta', {
                      amount: formatMoney(
                        currencyBucket.reconciliation.reconciliationDelta ?? 0,
                        activeCurrency,
                      ),
                      status: currencyBucket.reconciliation.reconciled
                        ? t('accounting.reports.sections.reconciled')
                        : t('accounting.reports.sections.varianceDetected'),
                    })
                  : t('accounting.reports.sections.reconUnavailable')
              }
            >
              <AnalyticsSortableTable
                columns={reconColumns}
                rows={currencyBucket.reconciliation.perCashbox}
                getRowKey={(r) => r.cashboxId}
              />
            </AnalyticsSectionCard>

            <AnalyticsSectionCard
              title={t('accounting.reports.sections.forecastTitle', {
                currency: currencyLabel,
              })}
              subtitle={t('accounting.reports.sections.forecastSubtitle', {
                balance: formatMoney(
                  currencyBucket.forecast.startingBalance,
                  activeCurrency,
                ),
                observed: report.coverage.observedHistoryDays,
                window: report.coverage.historyWindowDays,
                inflow: formatMoney(
                  currencyBucket.forecast.avgDailyInflow,
                  activeCurrency,
                ),
                outflow: formatMoney(
                  currencyBucket.forecast.avgDailyOutflow,
                  activeCurrency,
                ),
              })}
              actions={
                <span className="report-estimate-pill">
                  {t('accounting.reports.sections.estimateOnly')}
                </span>
              }
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
                  <label htmlFor="cf-horizon">
                    {t('accounting.reports.forecast.horizon')}
                  </label>
                  <select
                    id="cf-horizon"
                    value={String(horizonDays)}
                    onChange={(e) =>
                      setHorizonDays((Number(e.target.value) as 30 | 60 | 90) || 30)
                    }
                  >
                    <option value="30">
                      {t('accounting.reports.forecast.days', { count: 30 })}
                    </option>
                    <option value="60">
                      {t('accounting.reports.forecast.days', { count: 60 })}
                    </option>
                    <option value="90">
                      {t('accounting.reports.forecast.days', { count: 90 })}
                    </option>
                  </select>
                </div>
                <div className="report-filter-field">
                  <label htmlFor="cf-demand-mult">
                    {t('accounting.reports.forecast.demandMultiplier')}
                  </label>
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
                  <label htmlFor="cf-inflow-mult">
                    {t('accounting.reports.forecast.inflowMultiplier')}
                  </label>
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
                  <label htmlFor="cf-outflow-mult">
                    {t('accounting.reports.forecast.outflowMultiplier')}
                  </label>
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
                  <label htmlFor="cf-inflow-shift">
                    {t('accounting.reports.forecast.collectionShift')}
                  </label>
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
                  <label htmlFor="cf-outflow-shift">
                    {t('accounting.reports.forecast.paymentShift')}
                  </label>
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
                  label={t('accounting.reports.kpi.projectedEnding', {
                    days: horizonDays,
                  })}
                  value={formatMoney(currencyBucket.forecast.endingProjectedBalance, activeCurrency)}
                  tone={
                    currencyBucket.forecast.endingProjectedBalance < 0
                      ? 'danger'
                      : 'default'
                  }
                  badge={<AnalyticsComparisonBadge deltaPct={null} />}
                  hint={t('accounting.reports.kpi.lowestProjected', {
                    amount: formatMoney(
                      currencyBucket.forecast.lowestProjectedBalance,
                      activeCurrency,
                    ),
                  })}
                />
                <AnalyticsKpiCard
                  label={t('accounting.reports.kpi.projectedBaseline', {
                    days: horizonDays,
                  })}
                  value={`+${formatMoney(currencyBucket.forecast.totalProjectedBaselineInflows, activeCurrency)} / -${formatMoney(currencyBucket.forecast.totalProjectedBaselineOutflows, activeCurrency)}`}
                  hint={t('accounting.reports.kpi.plannedEventsHint', {
                    inflows: formatMoney(
                      currencyBucket.forecast.totalPlannedInflows,
                      activeCurrency,
                    ),
                    outflows: formatMoney(
                      currencyBucket.forecast.totalPlannedOutflows,
                      activeCurrency,
                    ),
                  })}
                />
                <AnalyticsKpiCard
                  label={t('accounting.reports.kpi.unscheduledObligations')}
                  value={t('accounting.reports.kpi.unscheduledItems', {
                    count: report.obligationSummary.unscheduledCount,
                  })}
                  hint={t('accounting.reports.kpi.receivablesPayablesHint', {
                    receivables: formatMoney(
                      report.obligationSummary.unscheduledReceivablesTotal,
                      'UAH',
                    ),
                    payables: formatMoney(
                      report.obligationSummary.unscheduledPayablesTotal,
                      'UAH',
                    ),
                  })}
                />
              </div>

              <AnalyticsTrendChart
                points={currencyBucket.forecast.series}
                formatYValue={(v) => formatMoney(v, activeCurrency)}
                series={[
                  {
                    key: 'projectedBalance',
                    label: t('accounting.reports.series.projectedBalance', {
                      currency: currencyLabel,
                    }),
                    color: 'var(--color-primary)',
                    getValue: (pt) => pt.projectedBalance,
                  },
                ]}
              />

              <div className="report-two-col-grid">
                <div style={{ display: 'grid', gap: 8 }}>
                  <strong style={{ fontSize: '0.88rem' }}>
                    {t('accounting.reports.planned.title', {
                      count: plannedEvents.length,
                    })}
                  </strong>
                  <div className="report-filter-bar">
                    <div className="report-filter-field">
                      <label htmlFor="cf-evt-title">
                        {t('accounting.reports.planned.titleLabel')}
                      </label>
                      <input
                        id="cf-evt-title"
                        type="text"
                        value={newEventTitle}
                        placeholder={t('accounting.reports.planned.placeholder')}
                        onChange={(e) => setNewEventTitle(e.target.value)}
                      />
                    </div>
                    <div className="report-filter-field">
                      <label htmlFor="cf-evt-type">
                        {t('accounting.reports.planned.type')}
                      </label>
                      <select
                        id="cf-evt-type"
                        value={newEventType}
                        onChange={(e) =>
                          setNewEventType(
                            e.target.value === 'inflow' ? 'inflow' : 'outflow',
                          )
                        }
                      >
                        <option value="outflow">
                          {t('accounting.reports.planned.outflow')}
                        </option>
                        <option value="inflow">
                          {t('accounting.reports.planned.inflow')}
                        </option>
                      </select>
                    </div>
                    <div className="report-filter-field">
                      <label htmlFor="cf-evt-amount">
                        {t('accounting.reports.planned.amount', {
                          currency: currencyLabel,
                        })}
                      </label>
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
                      <label htmlFor="cf-evt-date">
                        {t('accounting.reports.planned.date')}
                      </label>
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
                      {t('accounting.reports.planned.add')}
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
                        {t('accounting.reports.planned.eventSummary', {
                          title: evt.title,
                          type: t(`accounting.reports.planned.${evt.type}`),
                          date: evt.scheduledDate,
                          amount: formatMoney(evt.amount, evt.currency),
                        })}
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
                        {t('accounting.reports.planned.remove')}
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  <strong style={{ fontSize: '0.88rem' }}>
                    {t('accounting.reports.obligations.title')}
                  </strong>
                  {report.unscheduledObligations.length === 0 ? (
                    <div className="report-state-box">
                      {t('accounting.reports.obligations.empty')}
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
                              <span className="muted-copy">
                                {t('accounting.reports.obligations.due', {
                                  date: formatDate(obl.dueDate),
                                })}
                              </span>
                            ) : null}
                          </div>
                          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            <input
                              type="date"
                              aria-label={t(
                                'accounting.reports.obligations.scheduleDateAria',
                                { label: obl.label },
                              )}
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
                              {t('accounting.reports.obligations.schedule')}
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
              <div className="report-state-box">
                {t('accounting.reports.loading')}
              </div>
            ) : null}
          </>
        )}

        <AnalyticsSectionCard
          title={t('accounting.reports.sections.drillDown', {
            currency: currencyLabel,
          })}
          subtitle={
            detailsQuery.data
              ? t('accounting.reports.sections.matchingTotal', {
                  count: detailsQuery.data.total,
                })
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
                  : t('accounting.reports.errors.loadDetails')
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
