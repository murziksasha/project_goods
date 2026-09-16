import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCatalogProductsQuery } from '../../../../entities/catalog-product/api/catalogProductApi';
import { hasEmployeePermission } from '../../../../entities/employee/model/permissions';
import type { Employee } from '../../../../entities/employee/model/types';
import { useFinanceProfitReportQuery } from '../../../../entities/finance/api/financeApi';
import type {
  ProfitMarginRow,
  ProfitReportPeriod,
  ProfitReportSource,
} from '../../../../entities/finance/model/types';
import { useServicesQuery } from '../../../../entities/service-catalog/api/serviceCatalogApi';
import { PaginationPanel } from '../../../../shared/ui/PaginationPanel';
import { CopyableValue } from '../../../../shared/ui/CopyableValue';
import type { AnalyticsDateRange } from '../../model/analytics-date-range';
import { formatMoney } from '../../model/accounting';
import {
  buildProfitReportFilename,
  defaultProfitReportRowFilters,
  exportProfitReportWorkbook,
  filterProfitMarginRows,
  formatProfitMarginPct,
  getStoredProfitReportFilters,
  getStoredProfitReportVisualSettings,
  hasCustomProfitDateRange,
  hasProfitReportRowFilters,
  isProfitLossRow,
  profitReportMarginFilterOptions,
  profitReportPeriodOptions,
  profitReportRowSortOptions,
  profitReportSourceOptions,
  profitReportTypeFilterOptions,
  resolveProfitReportCatalogTarget,
  sortProfitMarginRows,
  storeProfitReportFilters,
  storeProfitReportVisualSettings,
  summarizeProfitMarginRows,
  type ProfitReportRowFilters,
  type ProfitReportVisualSettings,
} from '../../model/profit-report';
import { AnalyticsDateFilterPanel } from '../analytics/AnalyticsDateFilterPanel';
import { CatalogCopyableName } from '../product-catalog/CatalogCopyableName';
import {
  AccountingProfitCharts,
  AccountingProfitExpenseBars,
} from './AccountingProfitCharts';
import { AccountingProfitVisualSettings } from './AccountingProfitVisualSettings';
import { ProfitReportCatalogModalHost } from './ProfitReportCatalogModalHost';

const pageSizeDefault = 30;

const signedClass = (value: number | null) => {
  if (value == null || value === 0) return '';
  return value < 0
    ? 'finance-profit-kpi-negative'
    : 'finance-profit-kpi-positive';
};

type AccountingProfitReportsViewProps = {
  currentEmployee?: Employee | null;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
};

export const AccountingProfitReportsView = ({
  currentEmployee = null,
  onError,
  onSuccess,
}: AccountingProfitReportsViewProps) => {
  const { t } = useTranslation();
  const stored = useMemo(() => getStoredProfitReportFilters(), []);
  const storedVisual = useMemo(() => getStoredProfitReportVisualSettings(), []);
  const [source, setSource] = useState<ProfitReportSource>(stored.source);
  const [period, setPeriod] = useState<ProfitReportPeriod>(stored.period);
  const [appliedRange, setAppliedRange] = useState<AnalyticsDateRange>({
    dateFrom: stored.dateFrom,
    dateTo: stored.dateTo,
  });
  const [draftRange, setDraftRange] = useState<AnalyticsDateRange>(appliedRange);
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [isVisualOpen, setIsVisualOpen] = useState(false);
  const [visual, setVisual] =
    useState<ProfitReportVisualSettings>(storedVisual);
  const [rowFilters, setRowFilters] = useState<ProfitReportRowFilters>(
    defaultProfitReportRowFilters(),
  );
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [catalogRow, setCatalogRow] = useState<ProfitMarginRow | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeDefault);

  const customRange = hasCustomProfitDateRange(appliedRange);
  const query = useFinanceProfitReportQuery(
    {
      source,
      period: customRange ? undefined : period,
      dateFrom: customRange ? appliedRange.dateFrom || undefined : undefined,
      dateTo: customRange ? appliedRange.dateTo || undefined : undefined,
    },
    { enabled: true },
  );
  const report = query.data;
  const catalogProductsQuery = useCatalogProductsQuery(true);
  const servicesQuery = useServicesQuery(true);
  const catalogProducts = catalogProductsQuery.data ?? [];
  const services = servicesQuery.data ?? [];
  const canWriteCatalog = hasEmployeePermission(
    currentEmployee,
    'inventory.manage',
  );

  useEffect(() => {
    storeProfitReportFilters({
      source,
      period,
      dateFrom: appliedRange.dateFrom,
      dateTo: appliedRange.dateTo,
    });
  }, [appliedRange.dateFrom, appliedRange.dateTo, period, source]);

  useEffect(() => {
    storeProfitReportVisualSettings(visual);
  }, [visual]);

  useEffect(() => {
    setPage(1);
  }, [
    appliedRange.dateFrom,
    appliedRange.dateTo,
    period,
    source,
    pageSize,
    rowFilters.search,
    rowFilters.type,
    rowFilters.margin,
    rowFilters.sort,
  ]);

  useEffect(() => {
    setSelectedKeys([]);
    setRowFilters(defaultProfitReportRowFilters());
  }, [appliedRange.dateFrom, appliedRange.dateTo, period, source]);

  const filteredRows = useMemo(() => {
    const rows = report?.rows ?? [];
    return sortProfitMarginRows(
      filterProfitMarginRows(rows, rowFilters),
      rowFilters.sort,
    );
  }, [report?.rows, rowFilters]);

  const selectedRows = useMemo(
    () => filteredRows.filter((row) => selectedKeys.includes(row.key)),
    [filteredRows, selectedKeys],
  );
  const analysisRows = selectedRows.length > 0 ? selectedRows : filteredRows;
  const analysisSummary = useMemo(
    () => summarizeProfitMarginRows(analysisRows),
    [analysisRows],
  );

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const dateFilterCount =
    (appliedRange.dateFrom ? 1 : 0) + (appliedRange.dateTo ? 1 : 0);
  const currency = report?.currency ?? 'UAH';
  const isEmpty =
    !query.isLoading &&
    (report?.rows.length ?? 0) === 0 &&
    (report?.cash.operations.length ?? 0) === 0;
  const hasRowFilters = hasProfitReportRowFilters(rowFilters);

  const handleExport = () => {
    if (!report) return;
    exportProfitReportWorkbook({
      report,
      filename: buildProfitReportFilename(report),
      labels: {
        title: t('accounting.profit.export.title'),
        generated: t('accounting.profit.export.generated'),
        source: t('accounting.profit.export.source'),
        period: t('accounting.profit.export.period'),
        filters: t('accounting.profit.export.filters'),
        summarySheet: t('accounting.profit.export.summarySheet'),
        marginSheet: t('accounting.profit.export.marginSheet'),
        cashSheet: t('accounting.profit.export.cashSheet'),
        revenue: t('accounting.profit.kpis.revenue'),
        cogs: t('accounting.profit.kpis.cogs'),
        grossProfit: t('accounting.profit.kpis.grossProfit'),
        grossMargin: t('accounting.profit.kpis.grossMargin'),
        collected: t('accounting.profit.kpis.collected'),
        purchases: t('accounting.profit.kpis.purchases'),
        opex: t('accounting.profit.kpis.opex'),
        refunds: t('accounting.profit.kpis.refunds'),
        netCash: t('accounting.profit.kpis.netCash'),
        name: t('accounting.profit.table.name'),
        type: t('accounting.profit.table.type'),
        quantity: t('accounting.profit.table.quantity'),
        cost: t('accounting.profit.table.cost'),
        profit: t('accounting.profit.table.profit'),
        marginPct: t('accounting.profit.table.marginPct'),
        category: t('accounting.profit.table.category'),
        amount: t('accounting.profit.table.amount'),
        count: t('accounting.profit.table.count'),
        note: t('accounting.profit.table.note'),
        date: t('accounting.profit.table.date'),
        currency: t('accounting.profit.table.currency'),
        product: t('accounting.profit.types.product'),
        service: t('accounting.profit.types.service'),
        unknownCost: t('accounting.profit.kpis.unknownCost'),
      },
    });
  };

  const openCatalog = (row: ProfitMarginRow) => {
    if (resolveProfitReportCatalogTarget(row, catalogProducts, services)) {
      setCatalogRow(row);
    }
  };

  const toggleRow = (key: string) => {
    setSelectedKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };

  const kpiClass = (tone: string, value?: number | null) =>
    `analytics-summary-card finance-profit-kpi-card finance-profit-kpi-${tone} ${signedClass(value ?? null)}`.trim();

  return (
    <section className='finance-information finance-profit-report'>
      <div className='finance-information-header'>
        <div>
          <p className='section-label'>{t('accounting.profit.sectionLabel')}</p>
          <h2>{t('accounting.profit.title')}</h2>
          <p className='hero-chart-note'>{t('accounting.profit.subtitle')}</p>
        </div>
        <div className='hero-controls'>
          <div className='period-toggle' role='tablist' aria-label={t('accounting.profit.sourcesAria')}>
            {profitReportSourceOptions.map((option) => (
              <button
                key={option.value}
                type='button'
                className={
                  option.value === source
                    ? 'period-button period-button-active'
                    : 'period-button'
                }
                onClick={() => setSource(option.value)}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
          <div className='period-toggle' role='tablist' aria-label={t('accounting.profit.periodsAria')}>
            {profitReportPeriodOptions.map((option) => (
              <button
                key={option.value}
                type='button'
                className={
                  option.value === period && !customRange
                    ? 'period-button period-button-active'
                    : 'period-button'
                }
                onClick={() => {
                  setPeriod(option.value);
                  setAppliedRange({ dateFrom: '', dateTo: '' });
                  setDraftRange({ dateFrom: '', dateTo: '' });
                }}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
          <button
            type='button'
            className='toolbar-filter-button toolbar-filter-toggle-button'
            aria-expanded={isDateFilterOpen}
            onClick={() => setIsDateFilterOpen((open) => !open)}
          >
            {t('accounting.profit.date')}
            {dateFilterCount > 0 ? (
              <span className='toolbar-filter-count'>{dateFilterCount}</span>
            ) : null}
          </button>
          <button
            type='button'
            className='toolbar-filter-button toolbar-filter-toggle-button'
            aria-expanded={isVisualOpen}
            aria-label={t('accounting.profit.visual.aria')}
            onClick={() => setIsVisualOpen((open) => !open)}
          >
            {t('accounting.profit.visual.button')}
          </button>
          <button
            type='button'
            className='secondary-button'
            onClick={handleExport}
            disabled={!report || query.isLoading}
          >
            {t('accounting.profit.export.button')}
          </button>
        </div>
      </div>

      {isVisualOpen ? (
        <AccountingProfitVisualSettings settings={visual} onChange={setVisual} />
      ) : null}

      <AnalyticsDateFilterPanel
        draftRange={draftRange}
        isOpen={isDateFilterOpen}
        onDraftRangeChange={setDraftRange}
        onApply={() => {
          setAppliedRange(draftRange);
          setIsDateFilterOpen(false);
        }}
        onClear={() => {
          const empty = { dateFrom: '', dateTo: '' };
          setDraftRange(empty);
          setAppliedRange(empty);
          setIsDateFilterOpen(false);
        }}
        onClose={() => setIsDateFilterOpen(false)}
      />

      {report?.coldSalesPurgedExist ? (
        <p className='muted-copy'>{t('accounting.profit.incompleteHistory')}</p>
      ) : null}

      {query.isError ? (
        <p className='empty-state'>{t('accounting.profit.loadError')}</p>
      ) : null}

      <div className='finance-profit-kpi-grid'>
        <section className='finance-info-panel'>
          <div className='analytics-panel-header'>
            <div>
              <p className='section-label'>{t('accounting.profit.marginSection')}</p>
              <h3>{t('accounting.profit.grossResult')}</h3>
            </div>
          </div>
          <div className='finance-report-grid finance-profit-kpi-cards'>
            <article className={kpiClass('revenue')}>
              <span className='metric-label'>{t('accounting.profit.kpis.revenue')}</span>
              <strong>{formatMoney(report?.margin.revenue ?? 0, currency)}</strong>
            </article>
            <article className={kpiClass('cogs')}>
              <span className='metric-label'>{t('accounting.profit.kpis.cogs')}</span>
              <strong>{formatMoney(report?.margin.cogs ?? 0, currency)}</strong>
            </article>
            <article className={kpiClass('profit', report?.margin.grossProfit)}>
              <span className='metric-label'>{t('accounting.profit.kpis.grossProfit')}</span>
              <strong>{formatMoney(report?.margin.grossProfit ?? 0, currency)}</strong>
            </article>
            <article className={kpiClass('margin', report?.margin.grossMarginPct)}>
              <span className='metric-label'>{t('accounting.profit.kpis.grossMargin')}</span>
              <strong>{formatProfitMarginPct(report?.margin.grossMarginPct ?? null)}</strong>
            </article>
          </div>
        </section>
        <section className='finance-info-panel'>
          <div className='analytics-panel-header'>
            <div>
              <p className='section-label'>{t('accounting.profit.cashSection')}</p>
              <h3>{t('accounting.profit.cashResult')}</h3>
            </div>
          </div>
          <div className='finance-report-grid finance-profit-kpi-cards'>
            <article className={kpiClass('collected')}>
              <span className='metric-label'>{t('accounting.profit.kpis.collected')}</span>
              <strong>{formatMoney(report?.cash.collected ?? 0, currency)}</strong>
            </article>
            <article className={kpiClass('purchases')}>
              <span className='metric-label'>{t('accounting.profit.kpis.purchases')}</span>
              <strong>{formatMoney(report?.cash.inventoryPurchases ?? 0, currency)}</strong>
            </article>
            <article className={kpiClass('opex')}>
              <span className='metric-label'>{t('accounting.profit.kpis.opex')}</span>
              <strong>{formatMoney(report?.cash.opex ?? 0, currency)}</strong>
            </article>
            <article className={kpiClass('net', report?.cash.net)}>
              <span className='metric-label'>{t('accounting.profit.kpis.netCash')}</span>
              <strong>{formatMoney(report?.cash.net ?? 0, currency)}</strong>
            </article>
          </div>
        </section>
      </div>

      {report?.otherCurrencies.length ? (
        <p className='muted-copy'>
          {t('accounting.profit.otherCurrencies', {
            currencies: report.otherCurrencies.join(', '),
          })}
        </p>
      ) : null}

      {visual.showCharts ? (
        <AccountingProfitCharts
          rows={analysisRows}
          chartMetric={visual.chartMetric}
          currency={currency}
          cash={{
            collected: report?.cash.collected ?? 0,
            inventoryPurchases: report?.cash.inventoryPurchases ?? 0,
            opex: report?.cash.opex ?? 0,
            refunds: report?.cash.refunds ?? 0,
            net: report?.cash.net ?? 0,
          }}
          onSelectName={(name) =>
            setRowFilters((current) => ({ ...current, search: name }))
          }
        />
      ) : null}

      <section className='finance-info-panel finance-info-panel-wide'>
        <div className='analytics-panel-header'>
          <div>
            <p className='section-label'>{t('accounting.profit.tableSection')}</p>
            <h3>{t('accounting.profit.tableTitle')}</h3>
          </div>
        </div>
        <div className='finance-profit-table-tools'>
          <label className='orders-filter-field'>
            <span>{t('accounting.profit.analysis.search')}</span>
            <input
              value={rowFilters.search}
              onChange={(event) =>
                setRowFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder={t('accounting.profit.analysis.searchPlaceholder')}
            />
          </label>
          <label className='orders-filter-field'>
            <span>{t('accounting.profit.analysis.type')}</span>
            <select
              value={rowFilters.type}
              onChange={(event) =>
                setRowFilters((current) => ({
                  ...current,
                  type: event.target.value as ProfitReportRowFilters['type'],
                }))
              }
            >
              {profitReportTypeFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </label>
          <label className='orders-filter-field'>
            <span>{t('accounting.profit.analysis.margin')}</span>
            <select
              value={rowFilters.margin}
              onChange={(event) =>
                setRowFilters((current) => ({
                  ...current,
                  margin: event.target
                    .value as ProfitReportRowFilters['margin'],
                }))
              }
            >
              {profitReportMarginFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </label>
          <label className='orders-filter-field'>
            <span>{t('accounting.profit.analysis.sort')}</span>
            <select
              value={rowFilters.sort}
              onChange={(event) =>
                setRowFilters((current) => ({
                  ...current,
                  sort: event.target.value as ProfitReportRowFilters['sort'],
                }))
              }
            >
              {profitReportRowSortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </label>
          {hasRowFilters ? (
            <button
              type='button'
              className='ghost-button'
              onClick={() => setRowFilters(defaultProfitReportRowFilters())}
            >
              {t('accounting.profit.analysis.clearFilters')}
            </button>
          ) : null}
        </div>

        {selectedRows.length > 0 || hasRowFilters ? (
          <div className='finance-profit-analysis-strip'>
            <div>
              <span className='metric-label'>
                {selectedRows.length > 0
                  ? t('accounting.profit.analysis.analyzing', {
                      count: selectedRows.length,
                    })
                  : t('accounting.profit.analysis.filteredSummary', {
                      count: filteredRows.length,
                    })}
              </span>
              <strong>
                {formatMoney(analysisSummary.profit, currency)}
                {' · '}
                {formatProfitMarginPct(analysisSummary.marginPct)}
              </strong>
            </div>
            <p>
              {t('accounting.profit.table.quantity')}: {analysisSummary.quantity}
              {' · '}
              {t('accounting.profit.kpis.revenue')}:{' '}
              {formatMoney(analysisSummary.revenue, currency)}
              {' · '}
              {t('accounting.profit.kpis.cogs')}:{' '}
              {analysisSummary.costKnown
                ? formatMoney(analysisSummary.cost, currency)
                : '—'}
            </p>
            {selectedRows.length > 0 ? (
              <button
                type='button'
                className='ghost-button'
                onClick={() => setSelectedKeys([])}
              >
                {t('accounting.profit.analysis.clearSelection')}
              </button>
            ) : null}
          </div>
        ) : null}

        {isEmpty ? (
          <p className='empty-state'>{t('accounting.profit.empty')}</p>
        ) : filteredRows.length === 0 ? (
          <p className='empty-state'>{t('accounting.profit.analysis.noMatches')}</p>
        ) : (
          <div className='finance-table-wrap'>
            <table
              className={[
                'data-table',
                'finance-profit-table',
                'table-card-stack',
                visual.compactTable ? 'finance-profit-table-compact' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <thead>
                <tr>
                  <th className='finance-profit-select-col' />
                  <th>{t('accounting.profit.table.name')}</th>
                  <th>{t('accounting.profit.table.type')}</th>
                  <th>{t('accounting.profit.table.quantity')}</th>
                  <th>{t('accounting.profit.table.cost')}</th>
                  <th>{t('accounting.profit.table.revenue')}</th>
                  <th>{t('accounting.profit.table.profit')}</th>
                  <th>{t('accounting.profit.table.marginPct')}</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => {
                  const catalogTarget = resolveProfitReportCatalogTarget(
                    row,
                    catalogProducts,
                    services,
                  );
                  const loss = visual.highlightLosses && isProfitLossRow(row);
                  return (
                    <tr
                      key={row.key}
                      className={[
                        loss ? 'finance-profit-row-loss' : '',
                        !row.costKnown ? 'finance-profit-row-unknown' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <td data-label=''>
                        <input
                          type='checkbox'
                          checked={selectedKeys.includes(row.key)}
                          onChange={() => toggleRow(row.key)}
                          aria-label={t('accounting.profit.analysis.selectRow', {
                            name: row.name,
                          })}
                        />
                      </td>
                      <td data-label={t('accounting.profit.table.name')}>
                        {catalogTarget ? (
                          <CatalogCopyableName
                            name={row.name}
                            onOpen={() => openCatalog(row)}
                          />
                        ) : (
                          <CopyableValue
                            value={row.name}
                            className='catalog-name-cell'
                            copyLabel={t('catalog.tables.copyName')}
                            copiedLabel={t('catalog.tables.copied')}
                            failedLabel={t('catalog.tables.copyFailed')}
                          >
                            <span>{row.name}</span>
                          </CopyableValue>
                        )}
                      </td>
                      <td data-label={t('accounting.profit.table.type')}>
                        <span
                          className={`finance-profit-type finance-profit-type-${row.type}`}
                        >
                          {row.type === 'service'
                            ? t('accounting.profit.types.service')
                            : t('accounting.profit.types.product')}
                        </span>
                      </td>
                      <td data-label={t('accounting.profit.table.quantity')}>
                        {row.quantity}
                      </td>
                      <td data-label={t('accounting.profit.table.cost')}>
                        {row.costKnown ? formatMoney(row.cost, currency) : '—'}
                      </td>
                      <td data-label={t('accounting.profit.table.revenue')}>
                        {formatMoney(row.revenue, currency)}
                      </td>
                      <td
                        data-label={t('accounting.profit.table.profit')}
                        className={signedClass(row.profit)}
                      >
                        {formatMoney(row.profit, currency)}
                      </td>
                      <td
                        data-label={t('accounting.profit.table.marginPct')}
                        className={signedClass(row.marginPct)}
                      >
                        {formatProfitMarginPct(row.marginPct)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filteredRows.length > 0 ? (
          <PaginationPanel
            totalItems={filteredRows.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        ) : null}
      </section>

      <section className='finance-info-panel finance-info-panel-wide'>
        <div className='analytics-panel-header'>
          <div>
            <p className='section-label'>{t('accounting.profit.expensesSection')}</p>
            <h3>{t('accounting.profit.expensesTitle')}</h3>
          </div>
        </div>
        <AccountingProfitExpenseBars
          rows={report?.cash.opexByCategory ?? []}
          refunds={report?.cash.refunds ?? 0}
          currency={currency}
        />
      </section>

      {catalogRow ? (
        <ProfitReportCatalogModalHost
          row={catalogRow}
          catalogProducts={catalogProducts}
          services={services}
          canWrite={canWriteCatalog}
          onClose={() => setCatalogRow(null)}
          onError={onError}
          onSuccess={onSuccess}
        />
      ) : null}
    </section>
  );
};
