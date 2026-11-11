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
import { exportReportWorkbookToDownload } from '../../../../shared/lib/report-excel';
import {
  AnalyticsCoverageBanner,
  AnalyticsInteractiveBars,
  AnalyticsKpiCard,
  AnalyticsSectionCard,
  AnalyticsSortableTable,
  ScenarioManagerBar,
  type SortableColumn,
} from '../common/AnalyticsPrimitives';

export interface WarehouseInformationPanelProps {
  products: Product[];
  sales: Sale[];
  warehouses: WarehouseItem[];
  supplierOrders: SupplierOrder[];
}

const AGE_BUCKET_LABELS: Record<WarehouseAgeBucketKey, string> = {
  '0-30': '0–30 days',
  '31-60': '31–60 days',
  '61-90': '61–90 days',
  '90+': '90+ days',
  unknown: 'Unknown age',
};

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
> = ({ warehouses }) => {
  const { t } = useTranslation();

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
  const pageSize = 25;
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
    setScenarioMessage(`Saved private scenario "${saved.name}".`);
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
    setScenarioMessage(`Updated scenario "${updated.name}".`);
  };

  const handleDeleteScenario = async () => {
    if (!selectedScenarioId) return;
    await deleteScenarioMutation.mutateAsync(selectedScenarioId);
    setSelectedScenarioId('');
    setScenarioName('');
    setScenarioMessage('Deleted saved scenario.');
  };

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
      const warnings = [...report.coverage.warnings];
      if (fullDetails.total > fullDetails.items.length) {
        warnings.push(
          `Excel detail rows capped at ${fullDetails.items.length} of ${fullDetails.total} matching records.`,
        );
      }

      exportReportWorkbookToDownload({
        filename: `warehouse-information-${report.generatedAt.slice(0, 10)}.xlsx`,
        title: 'Warehouse Information & Forecasting',
        generatedAt: report.generatedAt,
        timeZone: report.timeZone,
        activeFilters: [
          { filter: 'Warehouse', value: warehouseId || 'All' },
          { filter: 'Location', value: locationId || 'All' },
          { filter: 'Supplier', value: supplier || 'All' },
          { filter: 'Stock State', value: stockState },
          { filter: 'Aging Bucket', value: ageBucket || 'All' },
          { filter: 'Search Query', value: searchQuery.trim() || 'None' },
          { filter: 'Forecast Horizon', value: `${horizonDays} days` },
          { filter: 'Lead Time (days)', value: String(leadTimeDays) },
          { filter: 'Safety Stock (days)', value: String(safetyStockDays) },
          { filter: 'Demand Multiplier', value: String(demandMultiplier) },
        ],
        definitions: [
          {
            metric: 'Available units',
            definition:
              'Current on-hand quantity minus manual reservations and uncommitted open order serial/line occupancy.',
          },
          {
            metric: 'Purchase valuation',
            definition: 'Sum of on-hand quantity multiplied by recorded purchase unit price.',
          },
          {
            metric: 'Aging buckets',
            definition:
              'Age since recorded purchaseDate (Europe/Kiev calendar); items without purchaseDate are classified under unknown age.',
          },
          {
            metric: 'Reorder suggestion',
            definition:
              'Estimate based on trailing 90-day observed daily demand x demandMultiplier x (leadTimeDays + safetyStockDays) minus available stock and optional pending supplier orders.',
          },
        ],
        warnings,
        sheets: [
          {
            name: 'Stock Records',
            rows: fullDetails.items.map((row) => ({
              Name: row.name,
              Article: row.article,
              Serial: row.serialNumber || '',
              Supplier: row.supplier,
              Warehouse: row.warehouseName,
              Location: row.locationName,
              OnHandQty: row.quantity,
              ManualReserved: row.manualReservedQuantity,
              OrderReserved: row.orderReservedQuantity,
              AvailableQty: row.availableQuantity,
              UnitCost: row.price,
              Valuation: row.valuation,
              PurchaseDate: row.purchaseDate ? row.purchaseDate.slice(0, 10) : 'Unknown',
              AgeDays: row.ageDays ?? 'Unknown',
              AgeBucket: row.ageBucket,
              StockState: row.stockState,
            })),
          },
          {
            name: 'Forecast & Reorder',
            rows: report.demandAndSuggestions.map((row) => ({
              Product: row.name,
              Supplier: row.supplier,
              OnHandQty: row.onHandQuantity,
              ReservedQty: row.reservedQuantity,
              AvailableQty: row.availableQuantity,
              PendingPOQty: row.pendingSupplierQuantity,
              ObservedDemand90d: row.observedDemand90d,
              DemandPattern: row.demandPattern,
              DailyDemand: row.observedDailyDemand,
              EstCoverageDays: row.estimatedCoverageDays ?? 'N/A',
              TargetBufferUnits: row.targetBufferUnits,
              SuggestedReorderQty: row.reorderSuggestedQty,
              EstReorderCost: row.estimatedReorderCost,
              ProjectedEndingAvail: row.horizonProjectedEndingAvailable,
            })),
          },
          {
            name: 'Aging Buckets',
            rows: report.agingBuckets.map((b) => ({
              Bucket: AGE_BUCKET_LABELS[b.bucket],
              SKUs: b.skuCount,
              Quantity: b.quantity,
              Reserved: b.reservedQuantity,
              Available: b.availableQuantity,
              Valuation: b.valuation,
            })),
          },
          {
            name: 'Suppliers & Locations',
            rows: report.distributions.bySupplier.map((s) => ({
              Supplier: s.label,
              SKUs: s.skuCount,
              Quantity: s.quantity,
              Reserved: s.reservedQuantity,
              Available: s.availableQuantity,
              Valuation: s.valuation,
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
      label: 'Product / Supplier',
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => (
        <div>
          <strong>{r.name}</strong>
          <div className="muted-copy">{r.supplier || 'Unassigned supplier'}</div>
        </div>
      ),
    },
    {
      key: 'availableQuantity',
      label: 'Avail / Reserved',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.availableQuantity,
      render: (r) => (
        <div>
          <strong>{r.availableQuantity}</strong>
          <div className="muted-copy">
            On hand {r.onHandQuantity} · Res {r.reservedQuantity}
          </div>
        </div>
      ),
    },
    {
      key: 'pendingSupplierQuantity',
      label: 'Pending PO',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.pendingSupplierQuantity,
      render: (r) => (
        <div>
          <span>{r.pendingSupplierQuantity}</span>
          {r.overdueSupplierQuantity > 0 ? (
            <div className="report-badge is-danger">
              {r.overdueSupplierQuantity} overdue
            </div>
          ) : r.earliestExpectedDelivery ? (
            <div className="muted-copy">
              ETA {formatDate(r.earliestExpectedDelivery)}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'observedDemand90d',
      label: '90d Demand',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.observedDemand90d,
      render: (r) => (
        <div>
          <span>
            {r.observedDemand90d} ({r.observedDailyDemand.toFixed(2)}/d)
          </span>
          <div>
            <span className={DEMAND_BADGE_CLASS[r.demandPattern]}>
              {r.demandPattern}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'estimatedCoverageDays',
      label: 'Est. Coverage',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.estimatedCoverageDays ?? 999999,
      render: (r) =>
        r.estimatedCoverageDays !== null ? (
          <span>
            {r.estimatedCoverageDays}d
            {r.estimatedCoverageWithPendingDays !== null &&
            r.estimatedCoverageWithPendingDays > r.estimatedCoverageDays ? (
              <span className="muted-copy">
                {' '}
                ({r.estimatedCoverageWithPendingDays}d w/ PO)
              </span>
            ) : null}
          </span>
        ) : (
          <span className="muted-copy">No demand</span>
        ),
    },
    {
      key: 'reorderSuggestedQty',
      label: 'Reorder Suggestion',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.reorderSuggestedQty,
      render: (r) =>
        r.reorderSuggestedQty > 0 ? (
          <div>
            <span className="report-badge is-warning">
              +{r.reorderSuggestedQty} units
            </span>
            <div className="muted-copy">
              Est. {formatCurrency(r.estimatedReorderCost)}
            </div>
          </div>
        ) : (
          <span className="report-badge is-success">Covered</span>
        ),
    },
    {
      key: 'horizonProjectedEndingAvailable',
      label: `${horizonDays}d Projected End`,
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
      label: 'Item / SKU',
      sortable: true,
      render: (row) => (
        <div>
          <strong>{row.name}</strong>
          <div className="muted-copy">
            {[row.article, row.serialNumber].filter(Boolean).join(' · ') ||
              'No article/serial'}
          </div>
        </div>
      ),
    },
    {
      key: 'locationName',
      label: 'Location / Supplier',
      render: (row) => (
        <div>
          <span>
            {row.warehouseName} / {row.locationName}
          </span>
          <div className="muted-copy">{row.supplier}</div>
        </div>
      ),
    },
    {
      key: 'quantity',
      label: 'On Hand',
      align: 'right',
      sortable: true,
      render: (row) => row.quantity,
    },
    {
      key: 'reservedQuantity',
      label: 'Reserved (Man / Ord)',
      align: 'right',
      render: (row) => (
        <span title="Manual reserved + open order occupancy">
          {row.reservedQuantity} ({row.manualReservedQuantity} /{' '}
          {row.orderReservedQuantity})
        </span>
      ),
    },
    {
      key: 'availableQuantity',
      label: 'Available',
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
      label: 'Valuation',
      align: 'right',
      sortable: true,
      render: (row) => (
        <div>
          <strong>{formatCurrency(row.valuation)}</strong>
          <div className="muted-copy">@{formatCurrency(row.price)}</div>
        </div>
      ),
    },
    {
      key: 'ageDays',
      label: 'Age Bucket',
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
            {AGE_BUCKET_LABELS[row.ageBucket]}
          </span>
          <div className="muted-copy">
            {row.purchaseDate ? formatDate(row.purchaseDate) : 'Unknown date'}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="report-upgrade-shell">
      <div className="report-upgrade-header">
        <div>
          <h2 className="report-upgrade-header-title">
            {t('warehouse.information.title')}
          </h2>
          <p className="report-upgrade-header-subtitle">
            Stock valuation, reservations, aging buckets, observed 90-day demand,
            and reorder forecasting scenarios (estimates only; no automatic POs).
          </p>
        </div>
        <div className="report-upgrade-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={resetFilters}
          >
            Reset Filters
          </button>
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

      <div className="report-filter-bar" role="search" aria-label="Warehouse filters">
        <div className="report-filter-field">
          <label htmlFor="wh-filter-warehouse">Warehouse</label>
          <select
            id="wh-filter-warehouse"
            value={warehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              setLocationId('');
              setPage(1);
            }}
          >
            <option value="">All warehouses</option>
            {(report?.filterOptions.warehouses ?? warehouses).map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name}
              </option>
            ))}
          </select>
        </div>

        <div className="report-filter-field">
          <label htmlFor="wh-filter-location">Location</label>
          <select
            id="wh-filter-location"
            value={locationId}
            onChange={(e) => {
              setLocationId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All locations</option>
            {availableLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        <div className="report-filter-field">
          <label htmlFor="wh-filter-supplier">Supplier</label>
          <select
            id="wh-filter-supplier"
            value={supplier}
            onChange={(e) => {
              setSupplier(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All suppliers</option>
            {(report?.filterOptions.suppliers ?? []).map((sup) => (
              <option key={sup} value={sup}>
                {sup}
              </option>
            ))}
          </select>
        </div>

        <div className="report-filter-field">
          <label htmlFor="wh-filter-state">Stock State</label>
          <select
            id="wh-filter-state"
            value={stockState}
            onChange={(e) => {
              setStockState(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All states</option>
            <option value="in_stock">In stock</option>
            <option value="low_stock">Low stock (1–2 avail)</option>
            <option value="out_of_stock">Out of stock (0 avail)</option>
            <option value="reserved">Has reservations</option>
          </select>
        </div>

        <div className="report-filter-field">
          <label htmlFor="wh-filter-age">Aging Bucket</label>
          <select
            id="wh-filter-age"
            value={ageBucket}
            onChange={(e) => {
              setAgeBucket(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All ages</option>
            {(Object.keys(AGE_BUCKET_LABELS) as WarehouseAgeBucketKey[]).map(
              (key) => (
                <option key={key} value={key}>
                  {AGE_BUCKET_LABELS[key]}
                </option>
              ),
            )}
          </select>
        </div>

        <div className="report-filter-field">
          <label htmlFor="wh-filter-search">Search</label>
          <input
            id="wh-filter-search"
            type="search"
            value={searchQuery}
            placeholder="Name, article, serial..."
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
            : 'Failed to load warehouse analytics.'}
        </div>
      ) : null}

      {report ? (
        <>
          <AnalyticsCoverageBanner
            title="Data & Forecast Coverage Notes"
            warnings={report.coverage.warnings}
          />

          <div className="report-kpi-grid">
            <AnalyticsKpiCard
              label="Total On-Hand Qty"
              value={report.summary.totalQuantity}
              hint={`${report.summary.skuCount} stock rows · ${report.summary.productGroupCount} SKU groups`}
            />
            <AnalyticsKpiCard
              label="Available / Reserved"
              value={`${report.summary.availableQuantity} / ${report.summary.reservedQuantity}`}
              hint={`Manual: ${report.summary.manualReservedQuantity} · Open orders: ${report.summary.orderReservedQuantity}`}
            />
            <AnalyticsKpiCard
              label="Purchase Valuation"
              value={formatCurrency(report.summary.purchaseValuation)}
              hint={`Available value: ${formatCurrency(report.summary.availableValuation)}`}
            />
            <AnalyticsKpiCard
              label="Out / Low / Unknown Age"
              value={`${report.summary.outOfStockCount} / ${report.summary.lowStockCount} / ${report.summary.unknownAgeOnHandCount}`}
              hint={`Unknown age units: ${report.summary.unknownAgeUnits}`}
              tone={
                report.summary.unknownAgeOnHandCount > 0 ? 'warning' : 'default'
              }
            />
            <AnalyticsKpiCard
              label="90d Observed Demand & Reorder"
              value={`${report.summary.totalObservedDemand90d} units`}
              hint={`${report.summary.reorderSkuCount} SKUs need ${report.summary.totalSuggestedReorderUnits} units (${formatCurrency(report.summary.totalEstimatedReorderCost)})`}
            />
          </div>

          <div className="report-two-col-grid">
            <AnalyticsSectionCard
              title="Inventory Aging Buckets"
              subtitle="Click any bucket to filter stock details below (click again to clear)."
            >
              <AnalyticsInteractiveBars
                selectedId={ageBucket || null}
                onSelect={(bucketKey) => {
                  setAgeBucket((prev) => (prev === bucketKey ? '' : bucketKey));
                  setPage(1);
                }}
                items={report.agingBuckets.map((bucket) => ({
                  id: bucket.bucket,
                  label: `${AGE_BUCKET_LABELS[bucket.bucket]} (${bucket.skuCount} rows)`,
                  value: bucket.valuation,
                  valueText: `${bucket.quantity} u · ${formatCurrency(bucket.valuation)}`,
                  tone: AGE_BUCKET_TONES[bucket.bucket],
                }))}
              />
            </AnalyticsSectionCard>

            <AnalyticsSectionCard
              title="Supplier Distribution"
              subtitle="Click a supplier to filter stock records and demand table."
            >
              <AnalyticsInteractiveBars
                selectedId={supplier || null}
                onSelect={(supKey) => {
                  setSupplier((prev) => (prev === supKey ? '' : supKey));
                  setPage(1);
                }}
                items={report.distributions.bySupplier.slice(0, 8).map((s) => ({
                  id: s.key,
                  label: `${s.label} (${s.skuCount} rows)`,
                  value: s.valuation,
                  valueText: `${s.availableQuantity}/${s.quantity} u · ${formatCurrency(s.valuation)}`,
                  tone: 'primary',
                }))}
              />
            </AnalyticsSectionCard>
          </div>

          <AnalyticsSectionCard
            title="Location Distribution"
            subtitle="Click a warehouse / location to filter stock records."
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
                if (warehouseId === (nextWh ?? '') && locationId === (nextLoc ?? '')) {
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
                label: `${loc.label} (${loc.skuCount} rows)`,
                value: loc.valuation,
                valueText: `${loc.availableQuantity}/${loc.quantity} u · ${formatCurrency(loc.valuation)}`,
                tone: 'cyan',
              }))}
            />
          </AnalyticsSectionCard>

          <AnalyticsSectionCard
            title="Inventory Forecasting & Reorder Suggestions"
            subtitle={`Projections based on trailing ${report.forecast.observationWindow.observedHistoryDays}/${report.forecast.observationWindow.windowDays} observed days. Scenarios never create POs automatically.`}
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
            {scenarioMessage ? (
              <div className="report-coverage-banner is-info" role="status">
                {scenarioMessage}
              </div>
            ) : null}

            <div className="report-filter-bar">
              <div className="report-filter-field">
                <label htmlFor="wh-horizon">Projection Horizon</label>
                <select
                  id="wh-horizon"
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
                <label htmlFor="wh-lead-time">Lead Time (days)</label>
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
                <label htmlFor="wh-safety-days">Safety Stock (days)</label>
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
                <label htmlFor="wh-demand-mult">Demand Multiplier</label>
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
                Include pending POs
              </label>
            </div>

            <div className="report-kpi-grid">
              <AnalyticsKpiCard
                label={`${horizonDays}d Projected Demand`}
                value={`${report.forecast.summary.projectedDemandUnits} units`}
                hint={`Window ${report.forecast.observationWindow.dateFrom} to ${report.forecast.observationWindow.dateTo}`}
              />
              <AnalyticsKpiCard
                label={`${horizonDays}d Projected Shortfall`}
                value={`${report.forecast.summary.projectedShortfallUnits} units`}
                tone={
                  report.forecast.summary.projectedShortfallUnits > 0
                    ? 'warning'
                    : 'success'
                }
                hint={`${report.forecast.summary.skusAtRiskCount} SKU(s) projected below 0`}
              />
              <AnalyticsKpiCard
                label="Pending Incoming POs"
                value={`${report.summary.pendingSupplierUnits} units`}
                hint={
                  includePendingSupplierOrders
                    ? 'Included in coverage & reorder calculations'
                    : 'Excluded by current assumption'
                }
              />
            </div>

            <AnalyticsSortableTable
              columns={suggestionColumns}
              rows={report.demandAndSuggestions}
              getRowKey={(r) => r.nameKey}
              emptyText="No matching SKUs for demand and reorder analysis."
            />
          </AnalyticsSectionCard>
        </>
      ) : reportQuery.isLoading ? (
        <div className="report-state-box">Loading warehouse analytics...</div>
      ) : null}

      <AnalyticsSectionCard
        title="Stock Records Drill-Down"
        subtitle={
          details
            ? `Matching total across all pages: ${details.total} records (${details.totals.availableQuantity} available / ${details.totals.totalQuantity} on hand · ${formatCurrency(details.totals.valuation)})`
            : 'Filter or click chart segments above to narrow down stock rows.'
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
                : 'Failed to load stock details.'
              : null
          }
          page={details?.page ?? page}
          pageSize={details?.pageSize ?? pageSize}
          total={details?.total ?? 0}
          onPageChange={setPage}
        />
      </AnalyticsSectionCard>
    </div>
  );
};
