import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFinanceProfitReportQuery } from '../../../../entities/finance/api/financeApi';
import type {
  FinanceTransactionCategory,
  ProfitReportPeriod,
  ProfitReportSource,
} from '../../../../entities/finance/model/types';
import { PaginationPanel } from '../../../../shared/ui/PaginationPanel';
import type { AnalyticsDateRange } from '../../model/analytics-date-range';
import { formatMoney } from '../../model/accounting';
import {
  buildProfitReportFilename,
  exportProfitReportWorkbook,
  getStoredProfitReportFilters,
  hasCustomProfitDateRange,
  profitReportPeriodOptions,
  profitReportSourceOptions,
  storeProfitReportFilters,
} from '../../model/profit-report';
import { AnalyticsDateFilterPanel } from '../analytics/AnalyticsDateFilterPanel';

const pageSizeDefault = 30;

const formatMargin = (value: number | null) =>
  value == null ? '—' : `${value.toFixed(1)}%`;

const categoryLabelKey = (category: FinanceTransactionCategory) =>
  `accounting.profit.categories.${category}`;

export const AccountingProfitReportsView = () => {
  const { t } = useTranslation();
  const stored = useMemo(() => getStoredProfitReportFilters(), []);
  const [source, setSource] = useState<ProfitReportSource>(stored.source);
  const [period, setPeriod] = useState<ProfitReportPeriod>(stored.period);
  const [appliedRange, setAppliedRange] = useState<AnalyticsDateRange>({
    dateFrom: stored.dateFrom,
    dateTo: stored.dateTo,
  });
  const [draftRange, setDraftRange] = useState<AnalyticsDateRange>(appliedRange);
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
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

  useEffect(() => {
    storeProfitReportFilters({
      source,
      period,
      dateFrom: appliedRange.dateFrom,
      dateTo: appliedRange.dateTo,
    });
  }, [appliedRange.dateFrom, appliedRange.dateTo, period, source]);

  useEffect(() => {
    setPage(1);
  }, [appliedRange.dateFrom, appliedRange.dateTo, period, source, pageSize]);

  const pagedRows = useMemo(() => {
    const rows = report?.rows ?? [];
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [page, pageSize, report?.rows]);

  const dateFilterCount =
    (appliedRange.dateFrom ? 1 : 0) + (appliedRange.dateTo ? 1 : 0);
  const currency = report?.currency ?? 'UAH';
  const isEmpty =
    !query.isLoading &&
    (report?.rows.length ?? 0) === 0 &&
    (report?.cash.operations.length ?? 0) === 0;

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
            className='secondary-button'
            onClick={handleExport}
            disabled={!report || query.isLoading}
          >
            {t('accounting.profit.export.button')}
          </button>
        </div>
      </div>

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
            <article className='analytics-summary-card'>
              <span className='metric-label'>{t('accounting.profit.kpis.revenue')}</span>
              <strong>{formatMoney(report?.margin.revenue ?? 0, currency)}</strong>
            </article>
            <article className='analytics-summary-card'>
              <span className='metric-label'>{t('accounting.profit.kpis.cogs')}</span>
              <strong>{formatMoney(report?.margin.cogs ?? 0, currency)}</strong>
            </article>
            <article className='analytics-summary-card'>
              <span className='metric-label'>{t('accounting.profit.kpis.grossProfit')}</span>
              <strong>{formatMoney(report?.margin.grossProfit ?? 0, currency)}</strong>
            </article>
            <article className='analytics-summary-card'>
              <span className='metric-label'>{t('accounting.profit.kpis.grossMargin')}</span>
              <strong>{formatMargin(report?.margin.grossMarginPct ?? null)}</strong>
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
            <article className='analytics-summary-card'>
              <span className='metric-label'>{t('accounting.profit.kpis.collected')}</span>
              <strong>{formatMoney(report?.cash.collected ?? 0, currency)}</strong>
            </article>
            <article className='analytics-summary-card'>
              <span className='metric-label'>{t('accounting.profit.kpis.purchases')}</span>
              <strong>{formatMoney(report?.cash.inventoryPurchases ?? 0, currency)}</strong>
            </article>
            <article className='analytics-summary-card'>
              <span className='metric-label'>{t('accounting.profit.kpis.opex')}</span>
              <strong>{formatMoney(report?.cash.opex ?? 0, currency)}</strong>
            </article>
            <article className='analytics-summary-card'>
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

      <section className='finance-info-panel finance-info-panel-wide'>
        <div className='analytics-panel-header'>
          <div>
            <p className='section-label'>{t('accounting.profit.tableSection')}</p>
            <h3>{t('accounting.profit.tableTitle')}</h3>
          </div>
        </div>
        {isEmpty ? (
          <p className='empty-state'>{t('accounting.profit.empty')}</p>
        ) : (
          <div className='finance-table-wrap'>
            <table className='data-table finance-profit-table'>
              <thead>
                <tr>
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
                {pagedRows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.name}</td>
                    <td>
                      {row.type === 'service'
                        ? t('accounting.profit.types.service')
                        : t('accounting.profit.types.product')}
                    </td>
                    <td>{row.quantity}</td>
                    <td>{row.costKnown ? formatMoney(row.cost, currency) : '—'}</td>
                    <td>{formatMoney(row.revenue, currency)}</td>
                    <td>{formatMoney(row.profit, currency)}</td>
                    <td>{formatMargin(row.marginPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(report?.rows.length ?? 0) > 0 ? (
          <PaginationPanel
            totalItems={report?.rows.length ?? 0}
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
        {(report?.cash.opexByCategory.length ?? 0) === 0 ? (
          <p className='empty-state'>{t('accounting.profit.noExpenses')}</p>
        ) : (
          <div className='finance-profit-expense-list'>
            {report?.cash.opexByCategory.map((row) => (
              <div key={row.category} className='finance-currency-row'>
                <div>
                  <span className='metric-label'>{t(categoryLabelKey(row.category))}</span>
                  <strong>{formatMoney(row.amount, currency)}</strong>
                </div>
                <span>
                  {t('accounting.profit.expenseCount', { count: row.count })}
                </span>
              </div>
            ))}
            {(report?.cash.refunds ?? 0) > 0 ? (
              <div className='finance-currency-row'>
                <div>
                  <span className='metric-label'>{t('accounting.profit.kpis.refunds')}</span>
                  <strong>{formatMoney(report?.cash.refunds ?? 0, currency)}</strong>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </section>
  );
};
