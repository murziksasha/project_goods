import { useMemo, useState } from 'react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import {
  getWarehouseReportDetails,
  useWarehouseReportDetailsQuery,
  useWarehouseReportQuery,
  type WarehouseAgeBucketKey,
  type WarehouseDetailRow,
  type WarehouseReportResponse,
} from '../../../../entities/analytics';
import type { Product } from '../../../../entities/product';
import type { Sale } from '../../../../entities/sale';
import {
  useCreateScenarioMutation,
  useDeleteScenarioMutation,
  useScenariosQuery,
  useUpdateScenarioMutation,
  type WarehouseScenarioAssumptions,
} from '../../../../entities/scenario';
import type { SupplierOrder } from '../../../../entities/supplier-order';
import type { WarehouseItem } from '../../../../entities/warehouse-settings';
import { formatCurrency, formatDate } from '../../../../shared/lib/format';
import { useStoredPageSize } from '../../../../shared/lib/page-size-preference';
import { exportReportWorkbookToDownload } from '../../../../shared/lib/report-excel';
import { useAnalyticsCollapsedSections } from '../../model/analytics-collapsed-sections';
import {
  AnalyticsCoverageBanner,
  AnalyticsInteractiveBars,
  AnalyticsKpiCard,
  AnalyticsSectionCard,
  AnalyticsSortableTable,
  ScenarioManagerBar,
  type SortableColumn,
} from '../common/AnalyticsPrimitives';
import {
  AGE_BUCKET_KEYS,
  translateAgeBucket,
  translateAssignedName,
  translateCoverageWarnings,
  translateDemandPattern,
  translateLocationLabel,
  translateStockState,
} from './warehouse-information-i18n';

export interface WarehouseInformationPanelProps {
  products: Product[];
  sales: Sale[];
  warehouses: WarehouseItem[];
  supplierOrders: SupplierOrder[];
  currentEmployeeId?: string | null;
}

const AGE_BUCKET_TONES: Record<
  WarehouseAgeBucketKey,
  'success' | 'cyan' | 'warning' | 'danger' | 'primary'
> = {
  '0-30': 'success',
  '31-60': 'cyan',
  '61-90': 'warning',
  '90+': 'danger',
  unknown: 'primary',
};

const DEMAND_BADGE_CLASS: Record<'steady' | 'sparse' | 'zero', string> = {
  steady: 'report-badge is-success',
  sparse: 'report-badge is-warning',
  zero: 'report-badge',
};

export const WarehouseInformationPanel: React.FC<
  WarehouseInformationPanelProps
> = ({ warehouses, currentEmployeeId }) => {
  const { t } = useTranslation();
  const { isSectionCollapsed, setSectionCollapsed } =
    useAnalyticsCollapsedSections(currentEmployeeId);

  // Filter controls
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [supplier, setSupplier] = useState('');
  const [stockState, setStockState] = useState('all');
  const [ageBucket, setAgeBucket] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Forecast & reorder assumptions (14d lead time, 7d safety stock defaults)
  const [horizonDays, setHorizonDays] = useState<30 | 60 | 90>(30);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(14);
  const [safetyStockDays, setSafetyStockDays] = useState<number>(7);
  const [demandMultiplier, setDemandMultiplier] = useState<number>(1);
  const [includePendingSupplierOrders, setIncludePendingSupplierOrders] =
    useState<boolean>(true);

  // Drill-down pagination & sort
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useStoredPageSize('warehouseInformationProducts');
  const [sortBy, setSortBy] = useState('valuation');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [isExporting, setIsExporting] = useState(false);

  // Saved scenarios state
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioMessage, setScenarioMessage] = useState<string | null>(null);

  const reportParams = useMemo(
    () => ({
      warehouseId: warehouseId || undefined,
      locationId: locationId || undefined,
      supplier: supplier || undefined,
      stockState: stockState !== 'all' ? stockState : undefined,
      ageBucket: ageBucket || undefined,
      q: searchQuery.trim() || undefined,
      leadTimeDays,
      safetyStockDays,
      horizonDays,
      demandMultiplier,
      includePendingSupplierOrders,
    }),
    [
      warehouseId,
      locationId,
      supplier,
      stockState,
      ageBucket,
      searchQuery,
      leadTimeDays,
      safetyStockDays,
      horizonDays,
      demandMultiplier,
      includePendingSupplierOrders,
    ],
  );

  const reportQuery = useWarehouseReportQuery(reportParams);
  const detailsQuery = useWarehouseReportDetailsQuery({
    ...reportParams,
    page,
    pageSize,
    sortBy,
    sortDir,
  });

  const scenariosQuery = useScenariosQuery('warehouse');
  const createScenarioMutation = useCreateScenarioMutation();
  const updateScenarioMutation = useUpdateScenarioMutation();
  const deleteScenarioMutation = useDeleteScenarioMutation();

  const report = reportQuery.data;
  const details = detailsQuery.data;

  const availableLocations = useMemo(() => {
    const selectedWh = warehouses.find((wh) => wh.id === warehouseId);
    const list = selectedWh
      ? selectedWh.locations
      : warehouses.flatMap((wh) => wh.locations);
    const seen = new Map<string, string>();
    for (const loc of list) {
      if (!seen.has(loc.id)) {
        seen.set(loc.id, loc.name);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [warehouses, warehouseId]);

  const resetFilters = () => {
    setWarehouseId('');
    setLocationId('');
    setSupplier('');
    setStockState('all');
    setAgeBucket('');
    setSearchQuery('');
    setPage(1);
  };

  const handleSelectScenario = (scenarioId: string) => {
    setSelectedScenarioId(scenarioId);
    setScenarioMessage(null);
    const found = (scenariosQuery.data ?? []).find((s) => s.id === scenarioId);
    if (!found) {
      setScenarioName('');
      return;
    }
    setScenarioName(found.name);
    setHorizonDays(found.horizonDays);
    const a = found.assumptions as Partial<WarehouseScenarioAssumptions>;
    if (typeof a.leadTimeDays === 'number') setLeadTimeDays(a.leadTimeDays);
    if (typeof a.safetyStockDays === 'number')
      setSafetyStockDays(a.safetyStockDays);
    if (typeof a.demandMultiplier === 'number')
      setDemandMultiplier(a.demandMultiplier);
    if (typeof a.includePendingSupplierOrders === 'boolean') {
      setIncludePendingSupplierOrders(a.includePendingSupplierOrders);
    }
    const f = (found.filters ?? {}) as Record<string, string>;
    setWarehouseId(typeof f.warehouseId === 'string' ? f.warehouseId : '');
    setLocationId(typeof f.locationId === 'string' ? f.locationId : '');
    setSupplier(typeof f.supplier === 'string' ? f.supplier : '');
    setStockState(typeof f.stockState === 'string' ? f.stockState : 'all');
    setAgeBucket(typeof f.ageBucket === 'string' ? f.ageBucket : '');
    setSearchQuery(typeof f.q === 'string' ? f.q : '');
    setPage(1);
  };

  const handleSaveNewScenario = async () => {
    if (!scenarioName.trim()) return;
    const saved = await createScenarioMutation.mutateAsync({
      domain: 'warehouse',
      name: scenarioName.trim(),
      horizonDays,
      assumptions: {
        leadTimeDays,
        safetyStockDays,
        demandMultiplier,
        includePendingSupplierOrders,
      },
      filters: {
        warehouseId,
        locationId,
        supplier,
        stockState,
        ageBucket,
        q: searchQuery.trim(),
      },
    });
    setSelectedScenarioId(saved.id);
    setScenarioMessage(
      t('warehouse.information.scenarios.saved', { name: saved.name }),
    );
  };

  const handleUpdateScenario = async () => {
    if (!selectedScenarioId || !scenarioName.trim()) return;
    const updated = await updateScenarioMutation.mutateAsync({
      scenarioId: selectedScenarioId,
      payload: {
        name: scenarioName.trim(),
        horizonDays,
        assumptions: {
          leadTimeDays,
          safetyStockDays,
          demandMultiplier,
          includePendingSupplierOrders,
        },
        filters: {
          warehouseId,
          locationId,
          supplier,
          stockState,
          ageBucket,
          q: searchQuery.trim(),
        },
      },
    });
    setScenarioMessage(
      t('warehouse.information.scenarios.updated', { name: updated.name }),
    );
  };

  const handleDeleteScenario = async () => {
    if (!selectedScenarioId) return;
    await deleteScenarioMutation.mutateAsync(selectedScenarioId);
    setSelectedScenarioId('');
    setScenarioName('');
    setScenarioMessage(t('warehouse.information.scenarios.deleted'));
  };

  const allLabel = t('warehouse.information.all');
  const noneLabel = t('warehouse.information.none');
  const naLabel = t('warehouse.information.na');
  const unknownLabel = t('warehouse.information.unknown');
  const exportCol = (key: string) =>
    t(`warehouse.information.export.cols.${key}`);

  const handleExportExcel = async () => {
    if (!report) return;
    setIsExporting(true);
    try {
      const fullDetails = await getWarehouseReportDetails({
        ...reportParams,
        page: 1,
        pageSize: 1000,
        sortBy,
        sortDir,
      });
      const warnings = translateCoverageWarnings(
        t,
        report.coverage.warnings,
        report.coverage.warningItems,
      );
      if (fullDetails.total > fullDetails.items.length) {
        warnings.push(
          t('warehouse.information.warnings.excelCapped', {
            shown: fullDetails.items.length,
            total: fullDetails.total,
          }),
        );
      }

      exportReportWorkbookToDownload({
        filename: `warehouse-information-${report.generatedAt.slice(0, 10)}.xlsx`,
        title: t('warehouse.information.export.forecastTitle'),
        generatedAt: report.generatedAt,
        timeZone: report.timeZone,
        activeFilters: [
          {
            filter: t('warehouse.information.filters.warehouse'),
            value: warehouseId || allLabel,
          },
          {
            filter: t('warehouse.information.filters.location'),
            value: locationId || allLabel,
          },
          {
            filter: t('warehouse.information.filters.supplier'),
            value: supplier || allLabel,
          },
          {
            filter: t('warehouse.information.filters.stockState'),
            value: translateStockState(t, stockState, 'filter'),
          },
          {
            filter: t('warehouse.information.filters.agingBucket'),
            value: ageBucket
              ? translateAgeBucket(t, ageBucket as WarehouseAgeBucketKey)
              : allLabel,
          },
          {
            filter: t('warehouse.information.filters.searchQuery'),
            value: searchQuery.trim() || noneLabel,
          },
          {
            filter: t('warehouse.information.filters.forecastHorizon'),
            value: t('warehouse.information.filters.horizonDaysValue', {
              count: horizonDays,
            }),
          },
          {
            filter: t('warehouse.information.filters.leadTimeDays'),
            value: String(leadTimeDays),
          },
          {
            filter: t('warehouse.information.filters.safetyStockDays'),
            value: String(safetyStockDays),
          },
          {
            filter: t('warehouse.information.filters.demandMultiplier'),
            value: String(demandMultiplier),
          },
        ],
        definitions: [
          {
            metric: t(
              'warehouse.information.export.definitions.availableUnits',
            ),
            definition: t(
              'warehouse.information.export.definitions.availableUnitsDef',
            ),
          },
          {
            metric: t(
              'warehouse.information.export.definitions.purchaseValuation',
            ),
            definition: t(
              'warehouse.information.export.definitions.purchaseValuationDef',
            ),
          },
          {
            metric: t(
              'warehouse.information.export.definitions.agingBuckets',
            ),
            definition: t(
              'warehouse.information.export.definitions.agingBucketsDef',
            ),
          },
          {
            metric: t(
              'warehouse.information.export.definitions.reorderSuggestion',
            ),
            definition: t(
              'warehouse.information.export.definitions.reorderSuggestionDef',
            ),
          },
        ],
        warnings,
        sheets: [
          {
            name: t('warehouse.information.export.sheetStockRecords'),
            rows: fullDetails.items.map((row) => ({
              [exportCol('name')]: row.name,
              [exportCol('article')]: row.article,
              [exportCol('serial')]: row.serialNumber || '',
              [exportCol('supplier')]: translateAssignedName(t, row.supplier),
              [exportCol('warehouse')]: translateAssignedName(
                t,
                row.warehouseName,
              ),
              [exportCol('location')]: translateAssignedName(
                t,
                row.locationName,
              ),
              [exportCol('onHandQty')]: row.quantity,
              [exportCol('manualReserved')]: row.manualReservedQuantity,
              [exportCol('orderReserved')]: row.orderReservedQuantity,
              [exportCol('availableQty')]: row.availableQuantity,
              [exportCol('unitCost')]: row.price,
              [exportCol('valuation')]: row.valuation,
              [exportCol('purchaseDate')]: row.purchaseDate
                ? row.purchaseDate.slice(0, 10)
                : unknownLabel,
              [exportCol('ageDays')]: row.ageDays ?? unknownLabel,
              [exportCol('ageBucket')]: translateAgeBucket(t, row.ageBucket),
              [exportCol('stockState')]: translateStockState(t, row.stockState),
            })),
          },
          {
            name: t('warehouse.information.export.sheetForecastReorder'),
            rows: report.demandAndSuggestions.map((row) => ({
              [exportCol('product')]: row.name,
              [exportCol('supplier')]: translateAssignedName(t, row.supplier),
              [exportCol('onHandQty')]: row.onHandQuantity,
              [exportCol('reservedQty')]: row.reservedQuantity,
              [exportCol('availableQty')]: row.availableQuantity,
              [exportCol('pendingPoQty')]: row.pendingSupplierQuantity,
              [exportCol('observedDemand90d')]: row.observedDemand90d,
              [exportCol('demandPattern')]: translateDemandPattern(
                t,
                row.demandPattern,
              ),
              [exportCol('dailyDemand')]: row.observedDailyDemand,
              [exportCol('estCoverageDays')]:
                row.estimatedCoverageDays ?? naLabel,
              [exportCol('targetBufferUnits')]: row.targetBufferUnits,
              [exportCol('suggestedReorderQty')]: row.reorderSuggestedQty,
              [exportCol('estReorderCost')]: row.estimatedReorderCost,
              [exportCol('projectedEndingAvail')]:
                row.horizonProjectedEndingAvailable,
            })),
          },
          {
            name: t('warehouse.information.export.sheetAgingBuckets'),
            rows: report.agingBuckets.map((b) => ({
              [exportCol('bucket')]: translateAgeBucket(t, b.bucket),
              [exportCol('skus')]: b.skuCount,
              [exportCol('quantity')]: b.quantity,
              [exportCol('reserved')]: b.reservedQuantity,
              [exportCol('available')]: b.availableQuantity,
              [exportCol('valuation')]: b.valuation,
            })),
          },
          {
            name: t('warehouse.information.export.sheetSuppliersLocations'),
            rows: report.distributions.bySupplier.map((s) => ({
              [exportCol('supplier')]: translateAssignedName(t, s.label),
              [exportCol('skus')]: s.skuCount,
              [exportCol('quantity')]: s.quantity,
              [exportCol('reserved')]: s.reservedQuantity,
              [exportCol('available')]: s.availableQuantity,
              [exportCol('valuation')]: s.valuation,
            })),
          },
        ],
      });
    } finally {
      setIsExporting(false);
    }
  };

  type SuggestionRow = WarehouseReportResponse['demandAndSuggestions'][number];
  const suggestionColumns: SortableColumn<SuggestionRow>[] = [
    {
      key: 'name',
      label: t('warehouse.information.columns.productSupplier'),
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <div>
          <strong>{r.name}</strong>
          <div className="muted-copy">
            {translateAssignedName(t, r.supplier || 'Unassigned supplier')}
          </div>
        </div>
      ),
    },
    {
      key: 'availableQuantity',
      label: t('warehouse.information.columns.availReserved'),
      align: 'right',
      sortable: true,
      sortValue: (r) => r.availableQuantity,
      render: (r) => (
        <div>
          <strong>{r.availableQuantity}</strong>
          <div className="muted-copy">
            {t('warehouse.information.cells.onHandRes', {
              onHand: r.onHandQuantity,
              reserved: r.reservedQuantity,
            })}
          </div>
        </div>
      ),
    },
    {
      key: 'pendingSupplierQuantity',
      label: t('warehouse.information.columns.pendingPo'),
      align: 'right',
      sortable: true,
      sortValue: (r) => r.pendingSupplierQuantity,
      render: (r) => (
        <div>
          <span>{r.pendingSupplierQuantity}</span>
          {r.overdueSupplierQuantity > 0 ? (
            <div className="report-badge is-danger">
              {t('warehouse.information.cells.overdue', {
                count: r.overdueSupplierQuantity,
              })}
            </div>
          ) : r.earliestExpectedDelivery ? (
            <div className="muted-copy">
              {t('warehouse.information.cells.eta', {
                date: formatDate(r.earliestExpectedDelivery),
              })}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'observedDemand90d',
      label: t('warehouse.information.columns.demand90d'),
      align: 'right',
      sortable: true,
      sortValue: (r) => r.observedDemand90d,
      render: (r) => (
        <div>
          <span>
            {r.observedDemand90d} (
            {t('warehouse.information.cells.dailyDemand', {
              value: r.observedDailyDemand.toFixed(2),
            })}
            )
          </span>
          <div>
            <span className={DEMAND_BADGE_CLASS[r.demandPattern]}>
              {translateDemandPattern(t, r.demandPattern)}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'estimatedCoverageDays',
      label: t('warehouse.information.columns.estCoverage'),
      align: 'right',
      sortable: true,
      sortValue: (r) => r.estimatedCoverageDays ?? 999999,
      render: (r) =>
        r.estimatedCoverageDays !== null ? (
          <span>
            {t('warehouse.information.cells.coverageDays', {
              days: r.estimatedCoverageDays,
            })}
            {r.estimatedCoverageWithPendingDays !== null &&
            r.estimatedCoverageWithPendingDays > r.estimatedCoverageDays ? (
              <span className="muted-copy">
                {t('warehouse.information.cells.coverageWithPo', {
                  days: r.estimatedCoverageWithPendingDays,
                })}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="muted-copy">
            {t('warehouse.information.cells.noDemand')}
          </span>
        ),
    },
    {
      key: 'reorderSuggestedQty',
      label: t('warehouse.information.columns.reorderSuggestion'),
      align: 'right',
      sortable: true,
      sortValue: (r) => r.reorderSuggestedQty,
      render: (r) =>
        r.reorderSuggestedQty > 0 ? (
          <div>
            <span className="report-badge is-warning">
              {t('warehouse.information.cells.reorderUnits', {
                count: r.reorderSuggestedQty,
              })}
            </span>
            <div className="muted-copy">
              {t('warehouse.information.cells.estCost', {
                amount: formatCurrency(r.estimatedReorderCost),
              })}
            </div>
          </div>
        ) : (
          <span className="report-badge is-success">
            {t('warehouse.information.cells.covered')}
          </span>
        ),
    },
    {
      key: 'horizonProjectedEndingAvailable',
      label: t('warehouse.information.columns.projectedEnd', {
        days: horizonDays,
      }),
      align: 'right',
      sortable: true,
      sortValue: (r) => r.horizonProjectedEndingAvailable,
      render: (r) => (
        <span
          className={
            r.horizonProjectedShortfall > 0
              ? 'report-badge is-danger'
              : 'report-badge'
          }
        >
          {r.horizonProjectedEndingAvailable}
        </span>
      ),
    },
  ];

  const detailColumns: SortableColumn<WarehouseDetailRow>[] = [
    {
      key: 'name',
      label: t('warehouse.information.columns.itemSku'),
      sortable: true,
      render: (row) => (
        <div>
          <strong>{row.name}</strong>
          <div className="muted-copy">
            {[row.article, row.serialNumber].filter(Boolean).join(' · ') ||
              t('warehouse.information.cells.noArticleSerial')}
          </div>
        </div>
      ),
    },
    {
      key: 'locationName',
      label: t('warehouse.information.columns.locationSupplier'),
      render: (row) => (
        <div>
          <span>
            {translateLocationLabel(t, row.warehouseName, row.locationName)}
          </span>
          <div className="muted-copy">
            {translateAssignedName(t, row.supplier || 'Unassigned supplier')}
          </div>
        </div>
      ),
    },
    {
      key: 'quantity',
      label: t('warehouse.information.columns.onHand'),
      align: 'right',
      sortable: true,
      render: (row) => row.quantity,
    },
    {
      key: 'reservedQuantity',
      label: t('warehouse.information.columns.reservedManOrd'),
      align: 'right',
      render: (row) => (
        <span title={t('warehouse.information.cells.reservedTitle')}>
          {row.reservedQuantity} ({row.manualReservedQuantity} /{' '}
          {row.orderReservedQuantity})
        </span>
      ),
    },
    {
      key: 'availableQuantity',
      label: t('warehouse.information.columns.available'),
      align: 'right',
      sortable: true,
      render: (row) => (
        <span
          className={`report-badge ${
            row.availableQuantity <= 0
              ? 'is-danger'
              : row.stockState === 'low_stock'
                ? 'is-warning'
                : 'is-success'
          }`}
        >
          {row.availableQuantity}
        </span>
      ),
    },
    {
      key: 'valuation',
      label: t('warehouse.information.columns.valuation'),
      align: 'right',
      sortable: true,
      render: (row) => (
        <div>
          <strong>{formatCurrency(row.valuation)}</strong>
          <div className="muted-copy">
            {t('warehouse.information.cells.unitPrice', {
              amount: formatCurrency(row.price),
            })}
          </div>
        </div>
      ),
    },
    {
      key: 'ageDays',
      label: t('warehouse.information.columns.ageBucket'),
      align: 'right',
      sortable: true,
      render: (row) => (
        <div>
          <span
            className={`report-badge ${
              row.ageBucket === '90+' || row.ageBucket === 'unknown'
                ? 'is-warning'
                : ''
            }`.trim()}
          >
            {translateAgeBucket(t, row.ageBucket)}
          </span>
          <div className="muted-copy">
            {row.purchaseDate
              ? formatDate(row.purchaseDate)
              : t('warehouse.information.unknownDate')}
          </div>
        </div>
      ),
    },
  ];

  const coverageWarnings = report
    ? translateCoverageWarnings(
        t,
        report.coverage.warnings,
        report.coverage.warningItems,
      )
    : [];

  return (
    <div className="report-upgrade-shell">
      <div className="report-upgrade-header">
        <div>
          <h2 className="report-upgrade-header-title">
            {t('warehouse.information.title')}
          </h2>
          <p className="report-upgrade-header-subtitle">
            {t('warehouse.information.subtitle')}
          </p>
        </div>
        <div className="report-upgrade-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={resetFilters}
          >
            {t('warehouse.information.resetFilters')}
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!report || isExporting}
            onClick={() => void handleExportExcel()}
          >
            {isExporting
              ? t('common.exporting')
              : t('warehouse.information.exportExcel')}
          </button>
        </div>
      </div>

      <div
        className="report-filter-bar"
        role="search"
        aria-label={t('warehouse.information.filtersAria')}
      >
        <div className="report-filter-field">
          <label htmlFor="wh-filter-warehouse">
            {t('warehouse.information.filters.warehouse')}
          </label>
          <select
            id="wh-filter-warehouse"
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              setLocationId('');
              setPage(1);
            }}
          >
            <option value="">
              {t('warehouse.information.filters.allWarehouses')}
            </option>
            {(report?.filterOptions.warehouses ?? warehouses).map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name}
              </option>
            ))}
          </select>
        </div>

        <div className="report-filter-field">
          <label htmlFor="wh-filter-location">
            {t('warehouse.information.filters.location')}
          </label>
          <select
            id="wh-filter-location"
            value={locationId}
            onChange={(e) => {
              setLocationId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">
              {t('warehouse.information.filters.allLocations')}
            </option>
            {availableLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        <div className="report-filter-field">
          <label htmlFor="wh-filter-supplier">
            {t('warehouse.information.filters.supplier')}
          </label>
          <select
            id="wh-filter-supplier"
            value={supplier}
            onChange={(e) => {
              setSupplier(e.target.value);
              setPage(1);
            }}
          >
            <option value="">
              {t('warehouse.information.filters.allSuppliers')}
            </option>
            {(report?.filterOptions.suppliers ?? []).map((sup) => (
              <option key={sup} value={sup}>
                {translateAssignedName(t, sup)}
              </option>
            ))}
          </select>
        </div>

        <div className="report-filter-field">
          <label htmlFor="wh-filter-state">
            {t('warehouse.information.filters.stockState')}
          </label>
          <select
            id="wh-filter-state"
            value={stockState}
            onChange={(e) => {
              setStockState(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">
              {t('warehouse.information.stockStates.all')}
            </option>
            <option value="in_stock">
              {t('warehouse.information.stockStates.in_stock')}
            </option>
            <option value="low_stock">
              {t('warehouse.information.stockStates.low_stock')}
            </option>
            <option value="out_of_stock">
              {t('warehouse.information.stockStates.out_of_stock')}
            </option>
            <option value="reserved">
              {t('warehouse.information.stockStates.reserved')}
            </option>
          </select>
        </div>

        <div className="report-filter-field">
          <label htmlFor="wh-filter-age">
            {t('warehouse.information.filters.agingBucket')}
          </label>
          <select
            id="wh-filter-age"
            value={ageBucket}
            onChange={(e) => {
              setAgeBucket(e.target.value);
              setPage(1);
            }}
          >
            <option value="">
              {t('warehouse.information.filters.allAges')}
            </option>
            {AGE_BUCKET_KEYS.map((key) => (
              <option key={key} value={key}>
                {translateAgeBucket(t, key)}
              </option>
            ))}
          </select>
        </div>

        <div className="report-filter-field">
          <label htmlFor="wh-filter-search">
            {t('warehouse.information.filters.search')}
          </label>
          <input
            id="wh-filter-search"
            type="search"
            value={searchQuery}
            placeholder={t(
              'warehouse.information.filters.searchPlaceholderAnalytics',
            )}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {reportQuery.isError ? (
        <div className="report-state-box is-error" role="alert">
          {reportQuery.error instanceof Error
            ? reportQuery.error.message
            : t('warehouse.information.errors.loadAnalytics')}
        </div>
      ) : null}

      {report ? (
        <>
          <AnalyticsCoverageBanner
            title={t('warehouse.information.coverage.title')}
            warnings={coverageWarnings}
          />

          <div className="report-kpi-grid">
            <AnalyticsKpiCard
              label={t('warehouse.information.kpi.totalOnHand')}
              value={report.summary.totalQuantity}
              hint={t('warehouse.information.kpi.stockRowsAndGroups', {
                rows: report.summary.skuCount,
                groups: report.summary.productGroupCount,
              })}
            />
            <AnalyticsKpiCard
              label={t('warehouse.information.kpi.availableReserved')}
              value={`${report.summary.availableQuantity} / ${report.summary.reservedQuantity}`}
              hint={t('warehouse.information.kpi.manualAndOpenOrders', {
                manual: report.summary.manualReservedQuantity,
                orders: report.summary.orderReservedQuantity,
              })}
            />
            <AnalyticsKpiCard
              label={t('warehouse.information.kpi.purchaseValuation')}
              value={formatCurrency(report.summary.purchaseValuation)}
              hint={t('warehouse.information.kpi.availableValue', {
                amount: formatCurrency(report.summary.availableValuation),
              })}
            />
            <AnalyticsKpiCard
              label={t('warehouse.information.kpi.outLowUnknown')}
              value={`${report.summary.outOfStockCount} / ${report.summary.lowStockCount} / ${report.summary.unknownAgeOnHandCount}`}
              hint={t('warehouse.information.kpi.unknownAgeUnits', {
                count: report.summary.unknownAgeUnits,
              })}
              tone={
                report.summary.unknownAgeOnHandCount > 0 ? 'warning' : 'default'
              }
            />
            <AnalyticsKpiCard
              label={t('warehouse.information.kpi.observedDemandReorder')}
              value={t('warehouse.information.kpi.unitsCount', {
                count: report.summary.totalObservedDemand90d,
              })}
              hint={t('warehouse.information.kpi.skusNeedUnits', {
                skus: report.summary.reorderSkuCount,
                units: report.summary.totalSuggestedReorderUnits,
                cost: formatCurrency(report.summary.totalEstimatedReorderCost),
              })}
            />
          </div>

          <div className="report-two-col-grid">
            <AnalyticsSectionCard
              id="warehouse-aging-buckets"
              collapsible={true}
              isCollapsed={isSectionCollapsed('warehouse-aging-buckets')}
              onCollapsedChange={(c) =>
                setSectionCollapsed('warehouse-aging-buckets', c)
              }
              title={t('warehouse.information.sections.agingBuckets')}
              subtitle={t(
                'warehouse.information.sections.agingBucketsSubtitle',
              )}
            >
              <AnalyticsInteractiveBars
                selectedId={ageBucket || null}
                onSelect={(bucketKey) => {
                  setAgeBucket((prev) => (prev === bucketKey ? '' : bucketKey));
                  setPage(1);
                }}
                items={report.agingBuckets.map((bucket) => ({
                  id: bucket.bucket,
                  label: t('warehouse.information.bars.labelRows', {
                    label: translateAgeBucket(t, bucket.bucket),
                    count: bucket.skuCount,
                  }),
                  value: bucket.valuation,
                  valueText: t('warehouse.information.bars.valueUnits', {
                    quantity: bucket.quantity,
                    value: formatCurrency(bucket.valuation),
                  }),
                  tone: AGE_BUCKET_TONES[bucket.bucket],
                }))}
              />
            </AnalyticsSectionCard>

            <AnalyticsSectionCard
              id="warehouse-supplier-distribution"
              collapsible={true}
              isCollapsed={isSectionCollapsed('warehouse-supplier-distribution')}
              onCollapsedChange={(c) =>
                setSectionCollapsed('warehouse-supplier-distribution', c)
              }
              title={t('warehouse.information.sections.supplierDistribution')}
              subtitle={t(
                'warehouse.information.sections.supplierDistributionSubtitle',
              )}
            >
              <AnalyticsInteractiveBars
                selectedId={supplier || null}
                onSelect={(supKey) => {
                  setSupplier((prev) => (prev === supKey ? '' : supKey));
                  setPage(1);
                }}
                items={report.distributions.bySupplier.slice(0, 8).map((s) => ({
                  id: s.key,
                  label: t('warehouse.information.bars.labelRows', {
                    label: translateAssignedName(t, s.label),
                    count: s.skuCount,
                  }),
                  value: s.valuation,
                  valueText: t('warehouse.information.bars.valueAvailUnits', {
                    available: s.availableQuantity,
                    quantity: s.quantity,
                    value: formatCurrency(s.valuation),
                  }),
                  tone: 'primary',
                }))}
              />
            </AnalyticsSectionCard>
          </div>

          <AnalyticsSectionCard
            id="warehouse-location-distribution"
            collapsible={true}
            isCollapsed={isSectionCollapsed('warehouse-location-distribution')}
            onCollapsedChange={(c) =>
              setSectionCollapsed('warehouse-location-distribution', c)
            }
            title={t('warehouse.information.sections.locationDistribution')}
            subtitle={t(
              'warehouse.information.sections.locationDistributionSubtitle',
            )}
          >
            <AnalyticsInteractiveBars
              selectedId={
                locationId
                  ? `${warehouseId}::${locationId}`
                  : warehouseId
                    ? `${warehouseId}::`
                    : null
              }
              onSelect={(locKey) => {
                const [nextWh, nextLoc] = locKey.split('::');
                if (
                  warehouseId === (nextWh ?? '') &&
                  locationId === (nextLoc ?? '')
                ) {
                  setWarehouseId('');
                  setLocationId('');
                } else {
                  setWarehouseId(nextWh ?? '');
                  setLocationId(nextLoc ?? '');
                }
                setPage(1);
              }}
              items={report.distributions.byLocation.slice(0, 10).map((loc) => ({
                id: `${loc.warehouseId}::${loc.locationId}`,
                label: t('warehouse.information.bars.labelRows', {
                  label: translateLocationLabel(
                    t,
                    loc.warehouseName,
                    loc.locationName,
                  ),
                  count: loc.skuCount,
                }),
                value: loc.valuation,
                valueText: t('warehouse.information.bars.valueAvailUnits', {
                  available: loc.availableQuantity,
                  quantity: loc.quantity,
                  value: formatCurrency(loc.valuation),
                }),
                tone: 'cyan',
              }))}
            />
          </AnalyticsSectionCard>

          <AnalyticsSectionCard
            id="warehouse-forecast-reorder"
            collapsible={true}
            isCollapsed={isSectionCollapsed('warehouse-forecast-reorder')}
            onCollapsedChange={(c) =>
              setSectionCollapsed('warehouse-forecast-reorder', c)
            }
            title={t('warehouse.information.sections.forecastTitle')}
            subtitle={t('warehouse.information.sections.forecastSubtitle', {
              observed: report.forecast.observationWindow.observedHistoryDays,
              window: report.forecast.observationWindow.windowDays,
            })}
            actions={
              <span className="report-estimate-pill">
                {t('warehouse.information.sections.estimateOnly')}
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
            {scenarioMessage ? (
              <div className="report-coverage-banner is-info" role="status">
                {scenarioMessage}
              </div>
            ) : null}

            <div className="report-filter-bar">
              <div className="report-filter-field">
                <label htmlFor="wh-horizon">
                  {t('warehouse.information.forecast.horizon')}
                </label>
                <select
                  id="wh-horizon"
                  value={String(horizonDays)}
                  onChange={(e) =>
                    setHorizonDays((Number(e.target.value) as 30 | 60 | 90) || 30)
                  }
                >
                  <option value="30">
                    {t('warehouse.information.forecast.days', { count: 30 })}
                  </option>
                  <option value="60">
                    {t('warehouse.information.forecast.days', { count: 60 })}
                  </option>
                  <option value="90">
                    {t('warehouse.information.forecast.days', { count: 90 })}
                  </option>
                </select>
              </div>
              <div className="report-filter-field">
                <label htmlFor="wh-lead-time">
                  {t('warehouse.information.forecast.leadTime')}
                </label>
                <input
                  id="wh-lead-time"
                  type="number"
                  min={0}
                  max={180}
                  value={leadTimeDays}
                  onChange={(e) =>
                    setLeadTimeDays(
                      Math.min(Math.max(Number(e.target.value) || 0, 0), 180),
                    )
                  }
                />
              </div>
              <div className="report-filter-field">
                <label htmlFor="wh-safety-days">
                  {t('warehouse.information.forecast.safetyStock')}
                </label>
                <input
                  id="wh-safety-days"
                  type="number"
                  min={0}
                  max={180}
                  value={safetyStockDays}
                  onChange={(e) =>
                    setSafetyStockDays(
                      Math.min(Math.max(Number(e.target.value) || 0, 0), 180),
                    )
                  }
                />
              </div>
              <div className="report-filter-field">
                <label htmlFor="wh-demand-mult">
                  {t('warehouse.information.forecast.demandMultiplier')}
                </label>
                <input
                  id="wh-demand-mult"
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
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 36,
                  fontSize: '0.84rem',
                  fontWeight: 600,
                }}
              >
                <input
                  type="checkbox"
                  checked={includePendingSupplierOrders}
                  onChange={(e) =>
                    setIncludePendingSupplierOrders(e.target.checked)
                  }
                />
                {t('warehouse.information.forecast.includePendingPos')}
              </label>
            </div>

            <div className="report-kpi-grid">
              <AnalyticsKpiCard
                label={t('warehouse.information.kpi.projectedDemand', {
                  days: horizonDays,
                })}
                value={t('warehouse.information.kpi.unitsCount', {
                  count: report.forecast.summary.projectedDemandUnits,
                })}
                hint={t('warehouse.information.kpi.windowRange', {
                  from: report.forecast.observationWindow.dateFrom,
                  to: report.forecast.observationWindow.dateTo,
                })}
              />
              <AnalyticsKpiCard
                label={t('warehouse.information.kpi.projectedShortfall', {
                  days: horizonDays,
                })}
                value={t('warehouse.information.kpi.unitsCount', {
                  count: report.forecast.summary.projectedShortfallUnits,
                })}
                tone={
                  report.forecast.summary.projectedShortfallUnits > 0
                    ? 'warning'
                    : 'success'
                }
                hint={t('warehouse.information.kpi.skusBelowZero', {
                  count: report.forecast.summary.skusAtRiskCount,
                })}
              />
              <AnalyticsKpiCard
                label={t('warehouse.information.kpi.pendingIncomingPos')}
                value={t('warehouse.information.kpi.unitsCount', {
                  count: report.summary.pendingSupplierUnits,
                })}
                hint={
                  includePendingSupplierOrders
                    ? t('warehouse.information.kpi.pendingIncluded')
                    : t('warehouse.information.kpi.pendingExcluded')
                }
              />
            </div>

            <AnalyticsSortableTable
              columns={suggestionColumns}
              rows={report.demandAndSuggestions}
              getRowKey={(r) => r.nameKey}
              emptyText={t('warehouse.information.emptyDemand')}
            />
          </AnalyticsSectionCard>
        </>
      ) : reportQuery.isLoading ? (
        <div className="report-state-box">
          {t('warehouse.information.loading')}
        </div>
      ) : null}

      <AnalyticsSectionCard
        id="warehouse-stock-drill-down"
        collapsible={true}
        isCollapsed={isSectionCollapsed('warehouse-stock-drill-down')}
        onCollapsedChange={(c) =>
          setSectionCollapsed('warehouse-stock-drill-down', c)
        }
        title={t('warehouse.information.sections.stockDrillDown')}
        subtitle={
          details
            ? t('warehouse.information.sections.matchingTotal', {
                total: details.total,
                available: details.totals.availableQuantity,
                onHand: details.totals.totalQuantity,
                valuation: formatCurrency(details.totals.valuation),
              })
            : t('warehouse.information.sections.stockDrillDownEmpty')
        }
      >
        <AnalyticsSortableTable
          columns={detailColumns}
          rows={details?.items ?? []}
          getRowKey={(row) => row.id}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={(nextKey, nextDir) => {
            setSortBy(nextKey);
            setSortDir(nextDir);
            setPage(1);
          }}
          loading={detailsQuery.isLoading}
          error={
            detailsQuery.isError
              ? detailsQuery.error instanceof Error
                ? detailsQuery.error.message
                : t('warehouse.information.errors.loadDetails')
              : null
          }
          page={details?.page ?? page}
          pageSize={pageSize}
          total={details?.total ?? 0}
          onPageChange={setPage}
          onPageSizeChange={(nextSize) => {
            setPageSize(nextSize);
            setPage(1);
          }}
        />
      </AnalyticsSectionCard>
    </div>
  );
};
