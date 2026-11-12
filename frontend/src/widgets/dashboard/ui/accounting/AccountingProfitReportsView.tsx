import type React from 'react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  hasAnyEmployeePermission,
  hasEmployeePermission,
} from '../../../../entities/employee';
import type { Employee } from '../../../../entities/employee';
import {
  getFinanceProfitReportDetails,
  useFinancePolicyQuery,
  useFinanceProfitReportDetailsQuery,
  useFinanceProfitReportQuery,
} from '../../../../entities/finance';
import type {
  ProfitMarginRow,
  ProfitReportDetailItem,
  ProfitReportPeriod,
  ProfitReportSource,
} from '../../../../entities/finance';
import { formatDate } from '../../../../shared/lib/format';
import {
  AnalyticsComparisonBadge,
  AnalyticsCoverageBanner,
  AnalyticsKpiCard,
  AnalyticsSectionCard,
  AnalyticsSortableTable,
  AnalyticsTrendChart,
  type SortableColumn,
} from '../common/AnalyticsPrimitives';
import { OrderCostAuditModal } from '../orders/order-detail/OrderCostAuditModal';
import type { Sale } from '../../../../entities/sale';
import { useServicesQuery } from '../../../../entities/service-catalog';
import type { SupplierOrder } from '../../../../entities/supplier-order';
import { PaginationPanel } from '../../../../shared/ui/PaginationPanel';
import { useStoredPageSize } from '../../../../shared/lib/page-size-preference';
import { CopyableValue } from '../../../../shared/ui/CopyableValue';
import type { AnalyticsDateRange } from '../../model/analytics-date-range';
import { formatMoney } from '../../model/accounting';
import {
  buildProfitReportFilename,
  clearStoredProfitReportFilters,
  clearStoredProfitReportVisualSettings,
  defaultProfitReportFilters,
  defaultProfitReportRowFilters,
  defaultProfitReportVisualSettings,
  exportProfitReportWorkbook,
  filterProfitMarginRows,
  formatProfitMarginPct,
  getStoredProfitReportFilters,
  getStoredProfitReportVisualSettings,
  groupProfitMarginRowsByName,
  hasCustomProfitDateRange,
  hasProfitReportRowFilters,
  hasStoredProfitReportFilters,
  hasStoredProfitReportVisualSettings,
  isProfitLossRow,
  isProfitLossSummary,
  profitReportMarginFilterOptions,
  profitReportPeriodOptions,
  profitReportRowSortOptions,
  profitReportSourceOptions,
  profitReportTypeFilterOptions,
  resolveProfitReportCatalogTarget,
  sortProfitMarginGroups,
  sortProfitMarginRows,
  storeProfitReportFilters,
  storeProfitReportVisualSettings,
  summarizeProfitMarginRows,
  type ProfitMarginNameGroup,
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

const signedClass = (value: number | null) => {
  if (value == null || value === 0) return '';
  return value < 0
    ? 'finance-profit-kpi-negative'
    : 'finance-profit-kpi-positive';
};

export interface AccountingProfitReportsViewProps {
  currentEmployee?: Employee | null;
  sales?: Sale[];
  supplierOrders?: SupplierOrder[];
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
  onOpenSupplierOrder?: (supplierOrderId: string, itemIndex: number) => void;
};

export const AccountingProfitReportsView: React.FC<AccountingProfitReportsViewProps> = ({
  currentEmployee = null,
  sales = [],
  supplierOrders = [],
  onError,
  onSuccess,
  onOpenSupplierOrder,
}) => {
  const { t } = useTranslation();
  const policyQuery = useFinancePolicyQuery();
  const financePolicy = policyQuery.data;
  const stored = useMemo(() => getStoredProfitReportFilters(), []);
  const storedVisual = useMemo(() => getStoredProfitReportVisualSettings(), []);
  const [hasPersonalFilters, setHasPersonalFilters] = useState(
    hasStoredProfitReportFilters,
  );
  const [hasPersonalVisual, setHasPersonalVisual] = useState(
    hasStoredProfitReportVisualSettings,
  );
  const [source, setSource] = useState<ProfitReportSource>(() =>
    hasStoredProfitReportFilters()
      ? stored.source
      : (financePolicy?.reportDefaults.source ?? stored.source),
  );
  const [period, setPeriod] = useState<ProfitReportPeriod>(() =>
    hasStoredProfitReportFilters()
      ? stored.period
      : (financePolicy?.reportDefaults.period ?? stored.period),
  );
  const [appliedRange, setAppliedRange] = useState<AnalyticsDateRange>({
    dateFrom: stored.dateFrom,
    dateTo: stored.dateTo,
  });
  const [draftRange, setDraftRange] = useState<AnalyticsDateRange>(appliedRange);
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [isVisualOpen, setIsVisualOpen] = useState(false);
  const [visual, setVisual] = useState<ProfitReportVisualSettings>(() =>
    hasStoredProfitReportVisualSettings()
      ? storedVisual
      : {
          ...storedVisual,
          showCharts:
            financePolicy?.reportDefaults.showCharts ?? storedVisual.showCharts,
          showTable:
            financePolicy?.reportDefaults.showTable ?? storedVisual.showTable,
        },
  );
  const [rowFilters, setRowFilters] = useState<ProfitReportRowFilters>(
    defaultProfitReportRowFilters(),
  );
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [catalogRow, setCatalogRow] = useState<ProfitMarginRow | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useStoredPageSize('accountingReports');
  const [lossOnly, setLossOnly] = useState(false);
  const [missingCostOnly, setMissingCostOnly] = useState(false);
  const [detailSearch, setDetailSearch] = useState('');
  const [detailsPage, setDetailsPage] = useState(1);
  const [detailsSortBy, setDetailsSortBy] = useState('saleDate');
  const [detailsSortDir, setDetailsSortDir] = useState<'asc' | 'desc'>('desc');
  const [auditSaleId, setAuditSaleId] = useState<string | null>(null);

  const isServicesExcludedByPolicy =
    financePolicy?.serviceProfitMode === 'exclude';
  const effectiveSource: ProfitReportSource =
    isServicesExcludedByPolicy && source === 'services' ? 'all' : source;

  const customRange = hasCustomProfitDateRange(appliedRange);
  const reportFilterParams = {
    source: effectiveSource,
    period: customRange ? undefined : period,
    dateFrom: customRange ? appliedRange.dateFrom || undefined : undefined,
    dateTo: customRange ? appliedRange.dateTo || undefined : undefined,
    lossOnly: lossOnly || undefined,
    missingCostOnly: missingCostOnly || undefined,
  };
  const query = useFinanceProfitReportQuery(reportFilterParams, { enabled: true });
  const detailsQuery = useFinanceProfitReportDetailsQuery(
    {
      ...reportFilterParams,
      q: detailSearch.trim() || undefined,
      page: detailsPage,
      pageSize: 25,
      sortBy: detailsSortBy,
      sortDir: detailsSortDir,
    },
    { enabled: true },
  );
  const report = query.data;
  const activeServiceProfitMode =
    report?.policy?.serviceProfitMode ??
    financePolicy?.serviceProfitMode ??
    'full';
  const isServicesExcluded = activeServiceProfitMode === 'exclude';
  const activePolicyVersion =
    report?.policy?.version ?? financePolicy?.version ?? 1;
  const servicesQuery = useServicesQuery(true);
  const services = servicesQuery.data ?? [];
  const canWriteCatalog = hasEmployeePermission(
    currentEmployee,
    'inventory.manage',
  );
  const canAuditCosts =
    hasEmployeePermission(currentEmployee ?? null, 'finance.view') &&
    hasAnyEmployeePermission(currentEmployee ?? null, [
      'orders.manage',
      'sales.manage',
    ]);

  useEffect(() => {
    if (hasPersonalFilters || !financePolicy?.reportDefaults) return;
    const nextSource =
      financePolicy.serviceProfitMode === 'exclude' &&
      financePolicy.reportDefaults.source === 'services'
        ? 'all'
        : financePolicy.reportDefaults.source;
    setSource(nextSource);
    setPeriod(financePolicy.reportDefaults.period);
    setAppliedRange({ dateFrom: '', dateTo: '' });
    setDraftRange({ dateFrom: '', dateTo: '' });
  }, [financePolicy, hasPersonalFilters]);

  useEffect(() => {
    if (hasPersonalVisual || !financePolicy?.reportDefaults) return;
    setVisual((current) => ({
      ...current,
      showCharts: financePolicy.reportDefaults.showCharts,
      showTable: financePolicy.reportDefaults.showTable,
    }));
  }, [financePolicy, hasPersonalVisual]);

  useEffect(() => {
    if (isServicesExcluded && rowFilters.type === 'service') {
      setRowFilters((current) => ({ ...current, type: 'all' }));
    }
  }, [isServicesExcluded, rowFilters.type]);

  const updatePersonalFilters = (next: {
    source?: ProfitReportSource;
    period?: ProfitReportPeriod;
    range?: AnalyticsDateRange;
  }) => {
    const nextSource = next.source ?? source;
    const nextPeriod = next.period ?? period;
    const nextRange = next.range ?? appliedRange;
    setSource(nextSource);
    setPeriod(nextPeriod);
    setAppliedRange(nextRange);
    setHasPersonalFilters(true);
    storeProfitReportFilters({
      source: nextSource,
      period: nextPeriod,
      dateFrom: nextRange.dateFrom,
      dateTo: nextRange.dateTo,
    });
  };

  const updatePersonalVisual = (
    updater:
      | ProfitReportVisualSettings
      | ((current: ProfitReportVisualSettings) => ProfitReportVisualSettings),
  ) => {
    setHasPersonalVisual(true);
    setVisual((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      storeProfitReportVisualSettings(next);
      return next;
    });
  };

  const resetToCompanyDefaults = () => {
    clearStoredProfitReportFilters();
    clearStoredProfitReportVisualSettings();
    setHasPersonalFilters(false);
    setHasPersonalVisual(false);
    const fallbackFilters = defaultProfitReportFilters();
    const fallbackVisual = defaultProfitReportVisualSettings();
    const companyDefaults = financePolicy?.reportDefaults;
    const nextSource =
      companyDefaults &&
      !(
        financePolicy?.serviceProfitMode === 'exclude' &&
        companyDefaults.source === 'services'
      )
        ? companyDefaults.source
        : fallbackFilters.source;
    const nextPeriod = companyDefaults?.period ?? fallbackFilters.period;
    const emptyRange = { dateFrom: '', dateTo: '' };
    setSource(nextSource);
    setPeriod(nextPeriod);
    setAppliedRange(emptyRange);
    setDraftRange(emptyRange);
    setVisual({
      ...fallbackVisual,
      showCharts: companyDefaults?.showCharts ?? fallbackVisual.showCharts,
      showTable: companyDefaults?.showTable ?? fallbackVisual.showTable,
    });
    setLossOnly(false);
    setMissingCostOnly(false);
    setRowFilters(defaultProfitReportRowFilters());
    setSelectedKeys([]);
    setExpandedIds(new Set());
  };

  useEffect(() => {
    setPage(1);
    setExpandedIds(new Set());
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
    setExpandedIds(new Set());
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

  const groupedRows = useMemo(
    () =>
      sortProfitMarginGroups(
        groupProfitMarginRowsByName(filteredRows),
        rowFilters.sort,
      ),
    [filteredRows, rowFilters.sort],
  );

  const pagedGroups = useMemo(() => {
    const start = (page - 1) * pageSize;
    return groupedRows.slice(start, start + pageSize);
  }, [groupedRows, page, pageSize]);

  const dateFilterCount =
    (appliedRange.dateFrom ? 1 : 0) + (appliedRange.dateTo ? 1 : 0);
  const currency = report?.currency ?? 'UAH';
  const isEmpty =
    !query.isLoading &&
    (report?.rows.length ?? 0) === 0 &&
    (report?.cash.operations.length ?? 0) === 0;
  const hasRowFilters = hasProfitReportRowFilters(rowFilters);

  const buildExportLabels = () => ({
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
  });

  const handleExport = () => {
    if (!report) return;
    const flagList = [
      lossOnly ? 'lossOnly=true' : '',
      missingCostOnly ? 'missingCostOnly=true' : '',
      detailSearch.trim() ? `q=${detailSearch.trim()}` : '',
    ]
      .filter(Boolean)
      .join(', ');
    const currentDetails = detailsQuery.data;
    if (
      currentDetails &&
      currentDetails.total > currentDetails.items.length
    ) {
      void getFinanceProfitReportDetails({
        ...reportFilterParams,
        q: detailSearch.trim() || undefined,
        page: 1,
        pageSize: 1000,
        sortBy: detailsSortBy,
        sortDir: detailsSortDir,
      })
        .then((fullDetails) => {
          exportProfitReportWorkbook({
            report,
            filename: buildProfitReportFilename(report),
            detailRows: fullDetails.items,
            extraFilters: flagList,
            labels: buildExportLabels(),
          });
        })
        .catch(() => {
          exportProfitReportWorkbook({
            report,
            filename: buildProfitReportFilename(report),
            detailRows: currentDetails.items,
            extraFilters: flagList,
            labels: buildExportLabels(),
          });
        });
      return;
    }

    exportProfitReportWorkbook({
      report,
      filename: buildProfitReportFilename(report),
      detailRows: currentDetails?.items ?? [],
      extraFilters: flagList,
      labels: buildExportLabels(),
    });
  };

  const openCatalog = (row: ProfitMarginRow) => {
    if (resolveProfitReportCatalogTarget(row, services)) {
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

  const toggleGroupSelection = (keys: string[]) => {
    setSelectedKeys((current) => {
      const allSelected = keys.every((key) => current.includes(key));
      if (allSelected) return current.filter((key) => !keys.includes(key));
      return Array.from(new Set([...current, ...keys]));
    });
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderName = (
    name: string,
    catalogSource: ProfitMarginRow | null,
    options?: {
      isGroup?: boolean;
      groupId?: string;
      expanded?: boolean;
      groupCount?: number;
    },
  ) => {
    const catalogTarget = catalogSource
      ? resolveProfitReportCatalogTarget(catalogSource, services)
      : null;
    const nameNode = catalogTarget ? (
      <CatalogCopyableName
        name={name}
        onOpen={() => catalogSource && openCatalog(catalogSource)}
      />
    ) : (
      <CopyableValue
        value={name}
        className='catalog-name-cell'
        copyLabel={t('catalog.tables.copyName')}
        copiedLabel={t('catalog.tables.copied')}
        failedLabel={t('catalog.tables.copyFailed')}
      >
        <span>{name}</span>
      </CopyableValue>
    );

    return (
      <span className='warehouse-name-with-qty'>
        {options?.isGroup ? (
          <button
            type='button'
            className='warehouse-expand-button'
            aria-expanded={options.expanded === true}
            aria-label={
              options.expanded
                ? t('accounting.profit.analysis.collapseGroup', { name })
                : t('accounting.profit.analysis.expandGroup', { name })
            }
            onClick={() => options.groupId && toggleExpanded(options.groupId)}
          >
            {options.expanded ? '\u25BE' : '\u25B8'}
          </button>
        ) : null}
        {nameNode}
        {options?.isGroup && options.groupCount ? (
          <span className='warehouse-data-badge warehouse-data-badge-location'>
            {t('accounting.profit.analysis.groupCount', {
              count: options.groupCount,
            })}
          </span>
        ) : null}
      </span>
    );
  };

  const renderTypeBadge = (type: ProfitMarginNameGroup['type']) => {
    if (type === 'mixed') {
      return t('accounting.profit.analysis.typeAll');
    }
    return (
      <span className={`finance-profit-type finance-profit-type-${type}`}>
        {type === 'service'
          ? t('accounting.profit.types.service')
          : t('accounting.profit.types.product')}
      </span>
    );
  };

  const renderPositionRow = (row: ProfitMarginRow, className?: string) => {
    const catalogTarget = resolveProfitReportCatalogTarget(row, services);
    const loss = visual.highlightLosses && isProfitLossRow(row);
    return (
      <tr
        key={row.key}
        className={[
          className,
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
          {renderName(row.name, catalogTarget ? row : null)}
        </td>
        <td data-label={t('accounting.profit.table.type')}>
          {renderTypeBadge(row.type)}
        </td>
        <td data-label={t('accounting.profit.table.quantity')}>{row.quantity}</td>
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
  };

  const renderGroup = (group: ProfitMarginNameGroup) => {
    const canExpand = group.rows.length > 1;
    const firstRow = group.rows[0];
    if (!canExpand || !firstRow) {
      return firstRow ? renderPositionRow(firstRow) : null;
    }

    const expanded = expandedIds.has(group.id);
    const keys = group.rows.map((row) => row.key);
    const allSelected = keys.every((key) => selectedKeys.includes(key));
    const catalogSource =
      group.rows.find((row) =>
        resolveProfitReportCatalogTarget(row, services),
      ) ?? null;
    const loss =
      visual.highlightLosses && isProfitLossSummary(group.summary);
    const parent = (
      <tr
        key={group.id}
        className={[
          'warehouse-group-row',
          loss ? 'finance-profit-row-loss' : '',
          !group.summary.costKnown ? 'finance-profit-row-unknown' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <td data-label=''>
          <input
            type='checkbox'
            checked={allSelected}
            onChange={() => toggleGroupSelection(keys)}
            aria-label={t('accounting.profit.analysis.selectGroup', {
              name: group.name,
            })}
          />
        </td>
        <td data-label={t('accounting.profit.table.name')}>
          {renderName(group.name, catalogSource, {
            isGroup: true,
            groupId: group.id,
            expanded,
            groupCount: group.rows.length,
          })}
        </td>
        <td data-label={t('accounting.profit.table.type')}>
          {renderTypeBadge(group.type)}
        </td>
        <td data-label={t('accounting.profit.table.quantity')}>
          {group.summary.quantity}
        </td>
        <td data-label={t('accounting.profit.table.cost')}>
          {group.summary.costKnown
            ? formatMoney(group.summary.cost, currency)
            : '—'}
        </td>
        <td data-label={t('accounting.profit.table.revenue')}>
          {formatMoney(group.summary.revenue, currency)}
        </td>
        <td
          data-label={t('accounting.profit.table.profit')}
          className={signedClass(group.summary.profit)}
        >
          {formatMoney(group.summary.profit, currency)}
        </td>
        <td
          data-label={t('accounting.profit.table.marginPct')}
          className={signedClass(group.summary.marginPct)}
        >
          {formatProfitMarginPct(group.summary.marginPct)}
        </td>
      </tr>
    );

    if (!expanded) return parent;
    return (
      <Fragment key={group.id}>
        {parent}
        {group.rows.map((row) =>
          renderPositionRow(row, 'warehouse-child-row'),
        )}
      </Fragment>
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
            {profitReportSourceOptions.map((option) => {
              const disabledByPolicy =
                isServicesExcluded && option.value === 'services';
              return (
                <button
                  key={option.value}
                  type='button'
                  disabled={disabledByPolicy}
                  title={
                    disabledByPolicy
                      ? t('accounting.profit.servicesUnavailableHint')
                      : undefined
                  }
                  className={
                    option.value === effectiveSource
                      ? 'period-button period-button-active'
                      : 'period-button'
                  }
                  onClick={() => updatePersonalFilters({ source: option.value })}
                >
                  {t(option.labelKey)}
                </button>
              );
            })}
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
                  const empty = { dateFrom: '', dateTo: '' };
                  setDraftRange(empty);
                  updatePersonalFilters({ period: option.value, range: empty });
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
            className='ghost-button'
            onClick={resetToCompanyDefaults}
          >
            {t('accounting.profit.resetToCompanyDefaults')}
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
        <AccountingProfitVisualSettings
          settings={visual}
          onChange={updatePersonalVisual}
        />
      ) : null}

      <AnalyticsDateFilterPanel
        draftRange={draftRange}
        isOpen={isDateFilterOpen}
        onDraftRangeChange={setDraftRange}
        onApply={() => {
          updatePersonalFilters({ range: draftRange });
          setIsDateFilterOpen(false);
        }}
        onClear={() => {
          const empty = { dateFrom: '', dateTo: '' };
          setDraftRange(empty);
          updatePersonalFilters({ range: empty });
          setIsDateFilterOpen(false);
        }}
        onClose={() => setIsDateFilterOpen(false)}
      />

      {activeServiceProfitMode !== 'full' ? (
        <div className='report-coverage-banner is-info' role='status'>
          {t(`accounting.profit.policyBanner.${activeServiceProfitMode}`, {
            version: activePolicyVersion,
          })}
          {isServicesExcluded ? ` ${t('accounting.profit.servicesUnavailableHint')}` : ''}
        </div>
      ) : null}

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
              {report?.previousComparison ? (
                <AnalyticsComparisonBadge
                  deltaPct={
                    report.previousComparison.margin.revenue > 0
                      ? ((report.margin.revenue -
                          report.previousComparison.margin.revenue) /
                          report.previousComparison.margin.revenue) *
                        100
                      : null
                  }
                />
              ) : null}
            </article>
            <article className={kpiClass('cogs')}>
              <span className='metric-label'>{t('accounting.profit.kpis.cogs')}</span>
              <strong>{formatMoney(report?.margin.cogs ?? 0, currency)}</strong>
              {report?.margin.costCoveragePct !== undefined ? (
                <span className='muted-copy'>
                  Coverage: {report.margin.costCoveragePct}%
                </span>
              ) : null}
            </article>
            <article className={kpiClass('profit', report?.margin.grossProfit)}>
              <span className='metric-label'>{t('accounting.profit.kpis.grossProfit')}</span>
              <strong>
                {report?.margin.isIncomplete
                  ? 'Incomplete'
                  : formatMoney(report?.margin.grossProfit ?? 0, currency)}
              </strong>
              {report?.margin.isIncomplete &&
              report.margin.knownCostGrossProfit !== undefined ? (
                <span className='muted-copy'>
                  Known-cost subtotal:{' '}
                  {formatMoney(report.margin.knownCostGrossProfit, currency)} (on{' '}
                  {formatMoney(report.margin.knownCostRevenue ?? 0, currency)})
                </span>
              ) : null}
            </article>
            <article className={kpiClass('margin', report?.margin.grossMarginPct)}>
              <span className='metric-label'>{t('accounting.profit.kpis.grossMargin')}</span>
              <strong>
                {report?.margin.isIncomplete
                  ? 'Incomplete'
                  : formatProfitMarginPct(report?.margin.grossMarginPct ?? null)}
              </strong>
              {report?.margin.isIncomplete &&
              report.margin.knownCostGrossMarginPct !== undefined ? (
                <span className='muted-copy'>
                  Known-cost margin:{' '}
                  {formatProfitMarginPct(report.margin.knownCostGrossMarginPct)}
                </span>
              ) : null}
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
              {report?.previousComparison ? (
                <AnalyticsComparisonBadge
                  deltaPct={
                    report.previousComparison.cash.collected > 0
                      ? ((report.cash.collected -
                          report.previousComparison.cash.collected) /
                          report.previousComparison.cash.collected) *
                        100
                      : null
                  }
                />
              ) : null}
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
              {report?.cash.transfersVolume !== undefined &&
              report.cash.transfersCount ? (
                <span className='muted-copy'>
                  Transfers excluded: {formatMoney(report.cash.transfersVolume, currency)} (
                  {report.cash.transfersCount})
                </span>
              ) : null}
            </article>
          </div>
        </section>
      </div>

      {report?.coverage?.warnings?.length ? (
        <AnalyticsCoverageBanner
          title='Profitability & Coverage Notes'
          warnings={report.coverage.warnings}
        />
      ) : null}

      {period === 'whole' && !customRange ? (
        <div className='report-coverage-banner is-info' role='status'>
          Comparison indicators are disabled for the All-time period. Choose Last 30 days
          or another bounded window for equal-length prior period comparisons.
        </div>
      ) : null}

      <div className='report-filter-toggles' style={{ marginBottom: 12 }}>
        <button
          type='button'
          className={`report-toggle-chip ${lossOnly ? 'is-active' : ''}`}
          aria-pressed={lossOnly}
          onClick={() => {
            setLossOnly((v) => !v);
            setDetailsPage(1);
          }}
        >
          Loss records only
        </button>
        <button
          type='button'
          className={`report-toggle-chip ${missingCostOnly ? 'is-active' : ''}`}
          aria-pressed={missingCostOnly}
          onClick={() => {
            setMissingCostOnly((v) => !v);
            setDetailsPage(1);
          }}
        >
          Missing cost only
        </button>
      </div>

      {report?.otherCurrencies.length ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <p className='muted-copy'>
            {t('accounting.profit.otherCurrencies', {
              currencies: report.otherCurrencies.join(', '),
            })}
          </p>
          {report.cash.byCurrency ? (
            <div className='report-kpi-grid'>
              {report.otherCurrencies.map((curCode) => {
                const bucket = report.cash.byCurrency?.[curCode];
                if (!bucket) return null;
                return (
                  <AnalyticsKpiCard
                    key={curCode}
                    label={`Cash Flow (${curCode})`}
                    value={formatMoney(bucket.net, curCode)}
                    hint={`In: ${formatMoney(bucket.collected, curCode)} · Out/OPEX: ${formatMoney(bucket.opex + bucket.inventoryPurchases + bucket.refunds, curCode)}`}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {report?.trendSeries && report.trendSeries.length > 0 ? (
        <AnalyticsSectionCard
          title='Revenue, Known Cost & Known Profit Trend'
          subtitle='Daily accrual profitability (Europe/Kiev calendar; cash salaries stay in Cash Flow OPEX).'
        >
          <AnalyticsTrendChart
            points={report.trendSeries}
            formatYValue={(v) => formatMoney(v, currency)}
            series={[
              {
                key: 'revenue',
                label: 'Revenue',
                color: 'var(--color-primary)',
                getValue: (pt) => pt.revenue,
              },
              {
                key: 'knownCost',
                label: 'Known Cost',
                color: 'var(--color-warning)',
                getValue: (pt) => pt.knownCost,
              },
              {
                key: 'knownProfit',
                label: 'Known Profit',
                color: 'var(--color-success)',
                getValue: (pt) => pt.knownProfit,
              },
            ]}
          />
        </AnalyticsSectionCard>
      ) : null}

      {visual.showCharts ? (
        <AccountingProfitCharts
          rows={analysisRows}
          chartMetric={visual.chartMetric}
          onChartMetricChange={(nextMetric) =>
            updatePersonalVisual((current) => ({
              ...current,
              chartMetric: nextMetric,
            }))
          }
          currency={currency}
          cash={{
            collected: report?.cash.collected ?? 0,
            inventoryPurchases: report?.cash.inventoryPurchases ?? 0,
            opex: report?.cash.opex ?? 0,
            refunds: report?.cash.refunds ?? 0,
            net: report?.cash.net ?? 0,
          }}
        />
      ) : null}

      {visual.showTable ? (
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
                <option
                  key={option.value}
                  value={option.value}
                  disabled={isServicesExcluded && option.value === 'service'}
                >
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
                {pagedGroups.map((group) => renderGroup(group))}
              </tbody>
            </table>
          </div>
        )}
        {groupedRows.length > 0 ? (
          <PaginationPanel
            totalItems={groupedRows.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        ) : null}
      </section>
      ) : null}

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

      <AnalyticsSectionCard
        title='Source Orders & Repairs Drill-Down'
        subtitle={
          detailsQuery.data
            ? `Matching total across all pages: ${detailsQuery.data.total} record(s) · Revenue ${formatMoney(detailsQuery.data.totals.revenue, currency)} · Known Cost ${formatMoney(detailsQuery.data.totals.knownCost, currency)} · Incomplete Cost Records: ${detailsQuery.data.totals.missingCostRecordsCount}`
            : 'Inspect underlying closed orders/repairs and complete missing cost records.'
        }
        actions={
          <input
            type='search'
            value={detailSearch}
            placeholder='Search order # or client...'
            aria-label='Search profit source records'
            onChange={(e) => {
              setDetailSearch(e.target.value);
              setDetailsPage(1);
            }}
          />
        }
      >
        <AnalyticsSortableTable<ProfitReportDetailItem>
          columns={[
            {
              key: 'recordNumber',
              label: 'Order / Kind',
              render: (d) => (
                <div>
                  <strong>{d.recordNumber || d.id.slice(-6)}</strong>
                  <div className='muted-copy'>{d.kind} · {d.status}</div>
                </div>
              ),
            },
            {
              key: 'saleDate',
              label: 'Date / Client',
              sortable: true,
              render: (d) => (
                <div>
                  <span>{d.clientName || '-'}</span>
                  <div className='muted-copy'>{formatDate(d.saleDate)}</div>
                </div>
              ),
            },
            {
              key: 'revenue',
              label: 'Revenue',
              align: 'right',
              sortable: true,
              render: (d) => formatMoney(d.revenue, currency),
            },
            {
              key: 'knownCost',
              label: 'Known Cost',
              align: 'right',
              sortable: true,
              render: (d) => (
                <div>
                  <span>{formatMoney(d.knownCost, currency)}</span>
                  {d.isIncomplete ? (
                    <div className='report-badge is-warning'>
                      {d.missingCostCount} missing
                    </div>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'profit',
              label: 'Profit / Margin',
              align: 'right',
              sortable: true,
              render: (d) =>
                d.isIncomplete ? (
                  <div>
                    <span className='report-badge is-warning'>Incomplete</span>
                    <div className='muted-copy'>
                      Known: {formatMoney(d.knownProfit, currency)}
                    </div>
                  </div>
                ) : (
                  <div>
                    <span
                      className={`report-badge ${
                        d.isLoss ? 'is-danger' : 'is-success'
                      }`}
                    >
                      {formatMoney(d.profit ?? 0, currency)}
                    </span>
                    <div className='muted-copy'>
                      {d.marginPct !== null ? `${d.marginPct}%` : '-'}
                    </div>
                  </div>
                ),
            },
            ...(canAuditCosts
              ? ([
                  {
                    key: 'audit',
                    label: 'Audit',
                    align: 'right',
                    render: (d) => (
                      <button
                        type='button'
                        className='secondary-button'
                        onClick={() => setAuditSaleId(d.id)}
                      >
                        Audit Costs
                      </button>
                    ),
                  },
                ] as SortableColumn<ProfitReportDetailItem>[])
              : []),
          ]}
          rows={detailsQuery.data?.items ?? []}
          getRowKey={(d) => d.id}
          sortBy={detailsSortBy}
          sortDir={detailsSortDir}
          onSortChange={(k, d) => {
            setDetailsSortBy(k);
            setDetailsSortDir(d);
            setDetailsPage(1);
          }}
          loading={detailsQuery.isLoading}
          error={
            detailsQuery.isError
              ? detailsQuery.error instanceof Error
                ? detailsQuery.error.message
                : 'Failed to load profit detail records.'
              : null
          }
          page={detailsQuery.data?.page ?? detailsPage}
          pageSize={detailsQuery.data?.pageSize ?? 25}
          total={detailsQuery.data?.total ?? 0}
          onPageChange={setDetailsPage}
        />
      </AnalyticsSectionCard>

      <OrderCostAuditModal
        saleId={auditSaleId}
        isOpen={Boolean(auditSaleId)}
        onClose={() => setAuditSaleId(null)}
        onError={onError}
        onSuccess={(msg) => {
          onSuccess?.(msg);
          void query.refetch();
          void detailsQuery.refetch();
        }}
      />

      {catalogRow ? (
        <ProfitReportCatalogModalHost
          row={catalogRow}
          services={services}
          sales={sales}
          supplierOrders={supplierOrders}
          canWrite={canWriteCatalog}
          onClose={() => setCatalogRow(null)}
          onError={onError}
          onSuccess={onSuccess}
          onOpenSupplierOrder={onOpenSupplierOrder}
        />
      ) : null}
    </section>
  );
};
