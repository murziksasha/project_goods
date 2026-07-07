import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import type { Employee } from '../../../../entities/employee/model/types';
import type { Sale } from '../../../../entities/sale/model/types';
import { formatCurrency, formatDate } from '../../../../shared/lib/format';
import { formatPercent } from '../../model/accounting';
import {
  buildEmployeeInformationReport,
  employeeInformationRoleOptions,
  type EmployeeInformationFilters,
  type EmployeeInformationRow,
  type EmployeeInformationView,
} from '../../model/employee-information';
import {
  formatAnalyticsDateRangeLabel,
  getAnalyticsDateRangeFilterCount,
} from '../../model/analytics-date-range';
import { formatMetric } from '../../model/sales-analytics';
import {
  getStatsPeriodDateRange,
  getStatsPeriodLabelKey,
  isCustomStatsDateRange,
  type StatsPeriod,
} from '../../model/stats-period';
import { StatsPeriodToggle } from '../analytics/StatsPeriodToggle';

const createDefaultFilters = (): EmployeeInformationFilters => {
  const todayRange = getStatsPeriodDateRange('today') ?? { dateFrom: '', dateTo: '' };
  return {
    search: '',
    role: 'all',
    sort: 'orders',
    sortDirection: 'desc',
    dateFrom: todayRange.dateFrom,
    dateTo: todayRange.dateTo,
  };
};

const viewLabelKeys: Record<EmployeeInformationView, string> = {
  achievements: 'employees.information.views.achievements',
  orders: 'employees.information.views.orders',
  repairs: 'employees.information.views.repairs',
  sales: 'employees.information.views.sales',
};

const chartColors = ['#2d8ae3', '#f97316', '#14b8a6'] as const;

const getRowMetricValue = (
  row: EmployeeInformationRow,
  view: EmployeeInformationView,
  sort: EmployeeInformationFilters['sort'],
) => {
  if (view === 'achievements') {
    if (sort === 'orders') return row.achievements.ordersCreated;
    if (sort === 'repairs') return row.achievements.repairsAsMaster;
    if (sort === 'sales') return row.achievements.salesAsManager;
    if (sort === 'revenue') {
      return row.achievements.ordersRevenue + row.achievements.repairsRevenue;
    }
    return row.count;
  }
  return sort === 'revenue' ? row.revenue : row.count;
};

const toExcelSheetName = (value: string) =>
  value.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Report';

const downloadExcelFile = ({
  activeFilters,
  filename,
  headers,
  rows,
  title,
  viewLabel,
  templateLabels,
}: {
  activeFilters: string[];
  filename: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  title: string;
  viewLabel: string;
  templateLabels: {
    view: string;
    generated: string;
    filters: string;
    noFilters: string;
    noRowsFound: string;
  };
}) => {
  const generatedAt = new Date().toLocaleString();
  const filterText =
    activeFilters.length > 0
      ? activeFilters.join('; ')
      : templateLabels.noFilters;
  const dataRows =
    rows.length > 0
      ? rows
      : [[templateLabels.noRowsFound, ...Array(Math.max(headers.length - 1, 0)).fill('')]];
  const sheetData: Array<Array<string | number>> = [
    [title],
    [templateLabels.view, viewLabel],
    [templateLabels.generated, generatedAt],
    [templateLabels.filters, filterText],
    [],
    headers,
    ...dataRows,
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, toExcelSheetName(viewLabel));
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

type EmployeeInformationPanelProps = {
  employees: Employee[];
  sales: Sale[];
  isLoading?: boolean;
};

export const EmployeeInformationPanel = ({
  employees,
  sales,
  isLoading = false,
}: EmployeeInformationPanelProps) => {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<EmployeeInformationView>('achievements');
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>('today');
  const [filters, setFilters] = useState<EmployeeInformationFilters>(createDefaultFilters);
  const [draftDateFilters, setDraftDateFilters] = useState(() => {
    const todayRange = getStatsPeriodDateRange('today') ?? { dateFrom: '', dateTo: '' };
    return todayRange;
  });
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);

  const hasCustomDateRange = useMemo(
    () =>
      isCustomStatsDateRange(
        { dateFrom: filters.dateFrom, dateTo: filters.dateTo },
        statsPeriod,
      ),
    [filters.dateFrom, filters.dateTo, statsPeriod],
  );

  const periodStatusLabel = useMemo(() => {
    if (hasCustomDateRange) {
      return formatAnalyticsDateRangeLabel(
        { dateFrom: filters.dateFrom, dateTo: filters.dateTo },
        i18n.language?.startsWith('uk') ? 'uk-UA' : 'en-US',
      );
    }
    return t(getStatsPeriodLabelKey(statsPeriod));
  }, [
    filters.dateFrom,
    filters.dateTo,
    hasCustomDateRange,
    i18n.language,
    statsPeriod,
    t,
  ]);

  const customDateFilterCount = hasCustomDateRange
    ? getAnalyticsDateRangeFilterCount({
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      })
    : 0;

  const handleStatsPeriodChange = (period: StatsPeriod) => {
    setStatsPeriod(period);
    const range = getStatsPeriodDateRange(period);
    const nextRange = {
      dateFrom: range?.dateFrom ?? '',
      dateTo: range?.dateTo ?? '',
    };
    setDraftDateFilters(nextRange);
    updateFilters((current) => ({
      ...current,
      ...nextRange,
    }));
    setIsDateFilterOpen(false);
  };

  const updateFilters = (
    updater:
      | EmployeeInformationFilters
      | ((current: EmployeeInformationFilters) => EmployeeInformationFilters),
  ) => {
    setFilters(updater);
  };

  const report = useMemo(
    () =>
      buildEmployeeInformationReport({
        employees,
        sales,
        view,
        filters,
      }),
    [employees, filters, sales, view],
  );

  const topChartRows = useMemo(
    () =>
      [...report.rows]
        .sort(
          (first, second) =>
            getRowMetricValue(second, view, filters.sort) -
            getRowMetricValue(first, view, filters.sort),
        )
        .slice(0, 8),
    [filters.sort, report.rows, view],
  );

  const topBarRows = useMemo(() => topChartRows.slice(0, 3), [topChartRows]);

  const maxBarValue = useMemo(() => {
    if (topBarRows.length === 0) return 1;
    return Math.max(
      ...topBarRows.map((row) => getRowMetricValue(row, view, filters.sort)),
      1,
    );
  }, [filters.sort, topBarRows, view]);

  const exportTemplateLabels = {
    view: t('employees.information.export.viewLabel'),
    generated: t('employees.information.export.generatedLabel'),
    filters: t('employees.information.export.filtersLabel'),
    noFilters: t('employees.information.export.noFilters'),
    noRowsFound: t('employees.information.export.noRowsFound'),
  };

  const buildActiveFilters = () => {
    const activeFilters: string[] = [];
    if (filters.search.trim()) {
      activeFilters.push(
        t('employees.information.filters.searchActive', {
          value: filters.search.trim(),
        }),
      );
    }
    if (filters.role !== 'all') {
      activeFilters.push(
        t('employees.information.filters.roleActive', { value: filters.role }),
      );
    }
    activeFilters.push(t('employees.information.filters.activeOnlyScope'));
    activeFilters.push(
      t('employees.information.filters.periodActive', {
        value: periodStatusLabel,
      }),
    );
    return activeFilters;
  };

  const exportReport = () => {
    const activeFilters = buildActiveFilters();
    const viewLabel = t(viewLabelKeys[view]);
    const headers =
      view === 'achievements'
        ? [
            t('employees.information.table.columns.employee'),
            t('employees.information.table.columns.role'),
            t('employees.information.table.columns.ordersCreated'),
            t('employees.information.table.columns.repairs'),
            t('employees.information.table.columns.repairsCompleted'),
            t('employees.information.table.columns.sales'),
            t('employees.information.table.columns.salesRevenue'),
            t('employees.information.table.columns.repairsRevenue'),
            t('employees.information.table.columns.latest'),
          ]
        : [
            t('employees.information.table.columns.employee'),
            t('employees.information.table.columns.role'),
            t('employees.information.table.columns.count'),
            t('employees.information.table.columns.revenue'),
            ...(view === 'repairs'
              ? [t('employees.information.table.columns.completed')]
              : []),
            ...(view === 'sales'
              ? [t('employees.information.table.columns.avgTicket')]
              : []),
            t('employees.information.table.columns.share'),
            t('employees.information.table.columns.latest'),
          ];
    const rows = report.rows.map((row) =>
      view === 'achievements'
        ? [
            row.name,
            row.role,
            row.achievements.ordersCreated,
            row.achievements.repairsAsMaster,
            row.achievements.repairsCompleted,
            row.achievements.salesAsManager,
            row.achievements.salesRevenue,
            row.achievements.repairsRevenue,
            row.achievements.latestActivityDate ?? '-',
          ]
        : [
            row.name,
            row.role,
            row.count,
            row.revenue,
            ...(view === 'repairs' ? [row.completedCount] : []),
            ...(view === 'sales' ? [row.avgTicket] : []),
            formatPercent(row.sharePercent),
            row.latestActivityDate ?? '-',
          ],
    );

    downloadExcelFile({
      activeFilters,
      filename: t('employees.information.export.filename'),
      headers,
      rows,
      title: t('employees.information.export.title'),
      viewLabel,
      templateLabels: exportTemplateLabels,
    });
  };

  const applyDateFilters = () => {
    updateFilters((current) => ({
      ...current,
      dateFrom: draftDateFilters.dateFrom,
      dateTo: draftDateFilters.dateTo,
    }));
    setIsDateFilterOpen(false);
  };

  const clearDateFilters = () => {
    handleStatsPeriodChange('today');
  };

  const metricValueForRow = (row: EmployeeInformationRow) =>
    getRowMetricValue(row, view, filters.sort);

  const formatMetricValue = (value: number) =>
    view === 'achievements' && filters.sort === 'revenue'
      ? formatCurrency(value)
      : filters.sort === 'revenue'
        ? formatCurrency(value)
        : formatMetric(value);

  return (
    <section className="warehouse-information">
      <div className="finance-information-header warehouse-information-header analytics-executive-header">
        <div>
          <p className="section-label">{t('employees.information.sectionLabel')}</p>
          <h2>{t('employees.information.title')}</h2>
          <div className="finance-information-status">
            <span>
              {t('employees.information.activeEmployeesStatus', {
                count: report.summary.activeEmployees,
              })}
            </span>
            <span>
              {t('employees.information.periodStatusLabel', {
                period: periodStatusLabel,
              })}
            </span>
          </div>
        </div>
        <div className="hero-controls">
          <StatsPeriodToggle
            statsPeriod={statsPeriod}
            hasCustomDateRange={hasCustomDateRange}
            onChange={handleStatsPeriodChange}
            ariaLabel={t('employees.information.statisticsPeriod')}
          />
          <button
            type="button"
            className="toolbar-filter-button toolbar-filter-toggle-button"
            aria-expanded={isDateFilterOpen}
            onClick={() => setIsDateFilterOpen((current) => !current)}
          >
            {t('employees.information.filters.date')}
            {customDateFilterCount > 0 ? (
              <span className="toolbar-filter-count">{customDateFilterCount}</span>
            ) : null}
          </button>
        </div>
      </div>

      <section
        className={
          isDateFilterOpen
            ? 'orders-filter-panel orders-filter-panel-open'
            : 'orders-filter-panel'
        }
      >
        <button
          type="button"
          className="orders-filter-close"
          aria-label={t('employees.information.filters.closeDateFiltersAriaLabel')}
          onClick={() => setIsDateFilterOpen(false)}
        >
          x
        </button>
        <div className="orders-filter-grid">
          <label className="field">
            <span>{t('employees.information.filters.dateFrom')}</span>
            <input
              type="date"
              value={draftDateFilters.dateFrom}
              onChange={(event) =>
                setDraftDateFilters((current) => ({
                  ...current,
                  dateFrom: event.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span>{t('employees.information.filters.dateTo')}</span>
            <input
              type="date"
              value={draftDateFilters.dateTo}
              onChange={(event) =>
                setDraftDateFilters((current) => ({
                  ...current,
                  dateTo: event.target.value,
                }))
              }
            />
          </label>
        </div>
        <div className="orders-filter-actions">
          <button type="button" className="primary-button" onClick={applyDateFilters}>
            {t('employees.information.filters.apply')}
          </button>
          <button type="button" className="secondary-button" onClick={clearDateFilters}>
            {t('employees.information.filters.clear')}
          </button>
        </div>
      </section>

      <div className="finance-report-grid finance-report-grid-wide warehouse-information-summary">
        <article className="analytics-summary-card">
          <span className="metric-label">
            {t('employees.information.summary.activeEmployees')}
          </span>
          <strong>{formatMetric(report.summary.activeEmployees)}</strong>
        </article>
        <article className="analytics-summary-card">
          <span className="metric-label">
            {t('employees.information.summary.ordersInPeriod')}
          </span>
          <strong>{formatMetric(report.summary.ordersInPeriod)}</strong>
        </article>
        <article className="analytics-summary-card">
          <span className="metric-label">
            {t('employees.information.summary.repairsInPeriod')}
          </span>
          <strong>{formatMetric(report.summary.repairsInPeriod)}</strong>
        </article>
        <article className="analytics-summary-card">
          <span className="metric-label">
            {t('employees.information.summary.salesInPeriod')}
          </span>
          <strong>{formatMetric(report.summary.salesInPeriod)}</strong>
        </article>
        <article className="analytics-summary-card">
          <span className="metric-label">
            {t('employees.information.summary.salesRevenue')}
          </span>
          <strong>{formatCurrency(report.summary.salesRevenue)}</strong>
        </article>
        <article className="analytics-summary-card">
          <span className="metric-label">
            {t('employees.information.summary.repairsRevenue')}
          </span>
          <strong>{formatCurrency(report.summary.repairsRevenue)}</strong>
        </article>
      </div>

      <div className="warehouse-information-controls">
        <div className="warehouse-search-modes">
          {(
            ['achievements', 'orders', 'repairs', 'sales'] as EmployeeInformationView[]
          ).map((key) => (
            <button
              key={key}
              type="button"
              className={
                view === key
                  ? 'warehouse-mode-button warehouse-mode-button-active'
                  : 'warehouse-mode-button'
              }
              onClick={() => {
                setView(key);
                setFilters((current) => ({
                  ...current,
                  sort:
                    key === 'achievements'
                      ? 'orders'
                      : key === 'orders' || key === 'repairs' || key === 'sales'
                        ? 'count'
                        : current.sort,
                }));
              }}
            >
              {t(viewLabelKeys[key])}
            </button>
          ))}
        </div>
        <button type="button" className="secondary-button" onClick={exportReport}>
          {t('employees.information.exportToFile')}
        </button>
      </div>

      <div className="warehouse-information-filters">
        <label className="field">
          <span>{t('employees.information.filters.search')}</span>
          <input
            value={filters.search}
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
            placeholder={t('employees.information.filters.searchPlaceholder')}
          />
        </label>
        <label className="field">
          <span>{t('employees.information.filters.role')}</span>
          <select
            value={filters.role}
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                role: event.target.value as EmployeeInformationFilters['role'],
              }))
            }
          >
            <option value="all">{t('employees.information.filters.allRoles')}</option>
            {employeeInformationRoleOptions
              .filter((role) => role !== 'all')
              .map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          <span>{t('employees.information.filters.sort')}</span>
          <select
            value={filters.sort}
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                sort: event.target.value as EmployeeInformationFilters['sort'],
              }))
            }
          >
            {view === 'achievements' ? (
              <>
                <option value="orders">
                  {t('employees.information.filters.sortOrders')}
                </option>
                <option value="repairs">
                  {t('employees.information.filters.sortRepairs')}
                </option>
                <option value="sales">
                  {t('employees.information.filters.sortSales')}
                </option>
                <option value="revenue">
                  {t('employees.information.filters.sortRevenue')}
                </option>
                <option value="latest">
                  {t('employees.information.filters.sortLatest')}
                </option>
              </>
            ) : (
              <>
                <option value="count">{t('employees.information.filters.sortCount')}</option>
                <option value="revenue">{t('employees.information.filters.sortRevenue')}</option>
                <option value="latest">{t('employees.information.filters.sortLatest')}</option>
              </>
            )}
          </select>
        </label>
        <label className="field">
          <span>{t('employees.information.filters.direction')}</span>
          <select
            value={filters.sortDirection}
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                sortDirection: event.target.value as EmployeeInformationFilters['sortDirection'],
              }))
            }
          >
            <option value="desc">{t('employees.information.filters.descending')}</option>
            <option value="asc">{t('employees.information.filters.ascending')}</option>
          </select>
        </label>
      </div>

      {isLoading ? (
        <p className="empty-state">{t('employees.information.loading')}</p>
      ) : (
        <>
          <div className="finance-information-grid">
            <section className="finance-info-panel finance-info-panel-wide">
              <div className="analytics-panel-header">
                <div>
                  <p className="section-label">{t('employees.information.charts.leaders')}</p>
                  <h3>{t('employees.information.charts.topPerformers')}</h3>
                </div>
              </div>
              <div className="finance-cashbox-distribution">
                {topChartRows.length === 0 ? (
                  <p className="empty-state">{t('employees.information.table.empty')}</p>
                ) : (
                  topChartRows.map((row) => (
                    <div key={row.id} className="finance-distribution-row">
                      <div>
                        <span title={row.name}>{row.name}</span>
                        <strong>{formatMetricValue(metricValueForRow(row))}</strong>
                      </div>
                      <div className="finance-distribution-track">
                        <span style={{ width: `${Math.max(row.sharePercent, 2)}%` }} />
                      </div>
                      <small>{formatPercent(row.sharePercent)}</small>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="finance-info-panel">
              <div className="analytics-panel-header">
                <div>
                  <p className="section-label">{t('employees.information.charts.comparison')}</p>
                  <h3>{t('employees.information.charts.topThree')}</h3>
                </div>
              </div>
              {topBarRows.length === 0 ? (
                <p className="empty-state">{t('employees.information.table.empty')}</p>
              ) : (
                <div className="bar-chart">
                  {topBarRows.map((row, index) => {
                    const value = metricValueForRow(row);
                    const heightPercent = (value / maxBarValue) * 100;
                    return (
                      <div key={row.id} className="bar-chart-item">
                        <strong>{formatMetricValue(value)}</strong>
                        <div className="bar-chart-track">
                          <span
                            className="bar-chart-bar"
                            style={{
                              height: `${Math.max(heightPercent, 8)}%`,
                              backgroundColor: chartColors[index % chartColors.length],
                            }}
                          />
                        </div>
                        <span>{row.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <div className="catalog-table-wrap">
            <table className="catalog-table warehouse-information-table">
              <thead>
                <tr>
                  <th>{t('employees.information.table.columns.employee')}</th>
                  <th>{t('employees.information.table.columns.role')}</th>
                  {view === 'achievements' ? (
                    <>
                      <th>{t('employees.information.table.columns.ordersCreated')}</th>
                      <th>{t('employees.information.table.columns.repairs')}</th>
                      <th>{t('employees.information.table.columns.repairsCompleted')}</th>
                      <th>{t('employees.information.table.columns.sales')}</th>
                      <th>{t('employees.information.table.columns.salesRevenue')}</th>
                      <th>{t('employees.information.table.columns.repairsRevenue')}</th>
                    </>
                  ) : (
                    <>
                      <th>{t('employees.information.table.columns.count')}</th>
                      <th>{t('employees.information.table.columns.revenue')}</th>
                      {view === 'repairs' ? (
                        <th>{t('employees.information.table.columns.completed')}</th>
                      ) : null}
                      {view === 'sales' ? (
                        <th>{t('employees.information.table.columns.avgTicket')}</th>
                      ) : null}
                      <th>{t('employees.information.table.columns.share')}</th>
                    </>
                  )}
                  <th>{t('employees.information.table.columns.latest')}</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={view === 'achievements' ? 9 : view === 'orders' ? 7 : 8}>
                      {t('employees.information.table.empty')}
                    </td>
                  </tr>
                ) : (
                  report.rows.map((row) => (
                    <tr key={row.id}>
                      <td className="catalog-name-cell">
                        <strong>{row.name}</strong>
                        {row.username ? (
                          <p className="employee-information-login">{row.username}</p>
                        ) : null}
                      </td>
                      <td>{row.role}</td>
                      {view === 'achievements' ? (
                        <>
                          <td>{formatMetric(row.achievements.ordersCreated)}</td>
                          <td>{formatMetric(row.achievements.repairsAsMaster)}</td>
                          <td>{formatMetric(row.achievements.repairsCompleted)}</td>
                          <td>{formatMetric(row.achievements.salesAsManager)}</td>
                          <td>{formatCurrency(row.achievements.salesRevenue)}</td>
                          <td>{formatCurrency(row.achievements.repairsRevenue)}</td>
                        </>
                      ) : (
                        <>
                          <td>{formatMetric(row.count)}</td>
                          <td>{formatCurrency(row.revenue)}</td>
                          {view === 'repairs' ? (
                            <td>{formatMetric(row.completedCount)}</td>
                          ) : null}
                          {view === 'sales' ? (
                            <td>{formatCurrency(row.avgTicket)}</td>
                          ) : null}
                          <td>{formatPercent(row.sharePercent)}</td>
                        </>
                      )}
                      <td>{formatDate(row.latestActivityDate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};