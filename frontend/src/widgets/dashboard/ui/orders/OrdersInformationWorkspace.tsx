import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import {
  getOrdersProcurementDetails,
  getOrdersRepairsDetails,
  getOrdersSalesDetails,
  useOrdersProcurementDetailsQuery,
  useOrdersProcurementReportQuery,
  useOrdersRepairsDetailsQuery,
  useOrdersRepairsReportQuery,
  useOrdersSalesDetailsQuery,
  useOrdersSalesReportQuery,
  type BoundedReportPeriod,
  type OrdersProcurementDetailRow,
  type OrdersProcurementReportResponse,
  type OrdersRepairDetailRow,
  type OrdersSaleDetailRow,
  type OrdersSalesReportResponse,
} from '../../../../entities/analytics';
import type { Employee } from '../../../../entities/employee';
import { formatCurrency, formatDate, formatDateTime } from '../../../../shared/lib/format';
import { exportReportWorkbookToDownload } from '../../../../shared/lib/report-excel';
import {
  AnalyticsCoverageBanner,
  AnalyticsInteractiveBars,
  AnalyticsKpiCard,
  AnalyticsSectionCard,
  AnalyticsSortableTable,
  AnalyticsTrendChart,
  type SortableColumn,
} from '../common/AnalyticsPrimitives';
import { OrdersWorkspaceTabList } from './workspace/OrdersWorkspaceTabList';
import type { OrdersTab } from './workspace/orders-workspace-shared';
import {
  ORDERS_INFO_PERIOD_KEYS,
  translateCoverageWarnings,
  translateLineKind,
  translatePaymentStatus,
  translateReceiptStatus,
  translateRepairStatus,
  translateSaleStatus,
  translateSupplierOrderStatus,
  translateTechnicianName,
  translateTurnaroundWarning,
} from './orders-information-i18n';

type OrdersInfoSubview = 'repairs' | 'sales' | 'procurement';

export interface OrdersInformationWorkspaceProps {
  activeTab: OrdersTab;
  visibleTabs: OrdersTab[];
  permittedTabs?: OrdersTab[];
  onActiveTabChange: (tab: OrdersTab) => void;
  onToggleTabVisibility?: (tab: OrdersTab) => void;
  employees: Employee[];
  canViewRepairs: boolean;
  canViewSales: boolean;
  canViewProcurement: boolean;
  onOpenSaleCard?: (sale: { id: string; kind: 'repair' | 'sale' }) => void;
  onOpenSupplierOrderTab?: () => void;
}

const PERIOD_OPTIONS: BoundedReportPeriod[] = [...ORDERS_INFO_PERIOD_KEYS];

export const OrdersInformationWorkspace: React.FC<
  OrdersInformationWorkspaceProps
> = ({
  activeTab,
  visibleTabs,
  permittedTabs,
  onActiveTabChange,
  onToggleTabVisibility,
  employees,
  canViewRepairs,
  canViewSales,
  canViewProcurement,
  onOpenSaleCard,
  onOpenSupplierOrderTab,
}) => {
  const { t } = useTranslation();

  const availableSubviews = useMemo(() => {
    const list: OrdersInfoSubview[] = [];
    if (canViewRepairs) list.push('repairs');
    if (canViewSales) list.push('sales');
    if (canViewProcurement) list.push('procurement');
    return list;
  }, [canViewRepairs, canViewSales, canViewProcurement]);

  const [subview, setSubview] = useState<OrdersInfoSubview>(
    () => availableSubviews[0] ?? 'repairs',
  );

  useEffect(() => {
    if (
      availableSubviews.length > 0 &&
      !availableSubviews.some((item) => item === subview)
    ) {
      setSubview(availableSubviews[0]);
    }
  }, [availableSubviews, subview]);

  // Shared bounded period filter (initial = last30)
  const [period, setPeriod] = useState<BoundedReportPeriod>('last30');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Subview-specific filters + pagination
  const [repairStatus, setRepairStatus] = useState('');
  const [repairMasterId, setRepairMasterId] = useState('');
  const [repairUnassignedOnly, setRepairUnassignedOnly] = useState(false);
  const [repairAgeBucket, setRepairAgeBucket] = useState('');
  const [repairSearch, setRepairSearch] = useState('');
  const [repairsPage, setRepairsPage] = useState(1);
  const [repairsSortBy, setRepairsSortBy] = useState('saleDate');
  const [repairsSortDir, setRepairsSortDir] = useState<'asc' | 'desc'>('desc');

  const [salesStatus, setSalesStatus] = useState('');
  const [salesLineKind, setSalesLineKind] = useState<'all' | 'product' | 'service'>('all');
  const [salesPaymentMethod, setSalesPaymentMethod] = useState('');
  const [salesSearch, setSalesSearch] = useState('');
  const [salesPage, setSalesPage] = useState(1);
  const [salesSortBy, setSalesSortBy] = useState('saleDate');
  const [salesSortDir, setSalesSortDir] = useState<'asc' | 'desc'>('desc');

  const [procStatus, setProcStatus] = useState('');
  const [procSupplierId, setProcSupplierId] = useState('');
  const [procOverdueOnly, setProcOverdueOnly] = useState(false);
  const [procSearch, setProcSearch] = useState('');
  const [procPage, setProcPage] = useState(1);
  const [procSortBy, setProcSortBy] = useState('createdAt');
  const [procSortDir, setProcSortDir] = useState<'asc' | 'desc'>('desc');

  const [isExporting, setIsExporting] = useState(false);

  const boundedParams = useMemo(
    () => ({
      period,
      dateFrom: period === 'custom' ? dateFrom : undefined,
      dateTo: period === 'custom' ? dateTo : undefined,
    }),
    [period, dateFrom, dateTo],
  );

  // Queries — enabled STRICTLY when user holds subview permission AND subview is active
  const repairsParams = useMemo(
    () => ({
      ...boundedParams,
      status: repairStatus || undefined,
      masterId: repairMasterId || undefined,
      unassignedOnly: repairUnassignedOnly || undefined,
      openAgeBucket: repairAgeBucket || undefined,
      q: repairSearch.trim() || undefined,
    }),
    [
      boundedParams,
      repairStatus,
      repairMasterId,
      repairUnassignedOnly,
      repairAgeBucket,
      repairSearch,
    ],
  );

  const repairsReportQuery = useOrdersRepairsReportQuery(repairsParams, {
    enabled: canViewRepairs && subview === 'repairs',
  });
  const repairsDetailsQuery = useOrdersRepairsDetailsQuery(
    {
      ...repairsParams,
      page: repairsPage,
      pageSize: 25,
      sortBy: repairsSortBy,
      sortDir: repairsSortDir,
    },
    { enabled: canViewRepairs && subview === 'repairs' },
  );

  const salesParams = useMemo(
    () => ({
      ...boundedParams,
      status: salesStatus || undefined,
      lineKind: salesLineKind,
      paymentMethod: salesPaymentMethod || undefined,
      q: salesSearch.trim() || undefined,
    }),
    [boundedParams, salesStatus, salesLineKind, salesPaymentMethod, salesSearch],
  );

  const salesReportQuery = useOrdersSalesReportQuery(salesParams, {
    enabled: canViewSales && subview === 'sales',
  });
  const salesDetailsQuery = useOrdersSalesDetailsQuery(
    {
      ...salesParams,
      page: salesPage,
      pageSize: 25,
      sortBy: salesSortBy,
      sortDir: salesSortDir,
    },
    { enabled: canViewSales && subview === 'sales' },
  );

  const procParams = useMemo(
    () => ({
      ...boundedParams,
      status: procStatus || undefined,
      supplierId: procSupplierId || undefined,
      overdueOnly: procOverdueOnly || undefined,
      q: procSearch.trim() || undefined,
    }),
    [boundedParams, procStatus, procSupplierId, procOverdueOnly, procSearch],
  );

  const procReportQuery = useOrdersProcurementReportQuery(procParams, {
    enabled: canViewProcurement && subview === 'procurement',
  });
  const procDetailsQuery = useOrdersProcurementDetailsQuery(
    {
      ...procParams,
      page: procPage,
      pageSize: 25,
      sortBy: procSortBy,
      sortDir: procSortDir,
    },
    { enabled: canViewProcurement && subview === 'procurement' },
  );

  const resetActiveFilters = () => {
    setPeriod('last30');
    setDateFrom('');
    setDateTo('');
    if (subview === 'repairs') {
      setRepairStatus('');
      setRepairMasterId('');
      setRepairUnassignedOnly(false);
      setRepairAgeBucket('');
      setRepairSearch('');
      setRepairsPage(1);
    } else if (subview === 'sales') {
      setSalesStatus('');
      setSalesLineKind('all');
      setSalesPaymentMethod('');
      setSalesSearch('');
      setSalesPage(1);
    } else {
      setProcStatus('');
      setProcSupplierId('');
      setProcOverdueOnly(false);
      setProcSearch('');
      setProcPage(1);
    }
  };

  const yesNo = (value: boolean) =>
    t(value ? 'orders.information.yes' : 'orders.information.no');
  const allLabel = t('orders.information.all');
  const noneLabel = t('orders.information.none');
  const naLabel = t('orders.information.na');
  const periodFilterValue = (from: string | null, to: string | null) =>
    t('orders.information.export.periodValue', {
      from: from ?? allLabel,
      to: to ?? allLabel,
    });
  const exportShowingWarning = (shown: number, total: number) =>
    t('orders.information.export.showingRecords', {
      shown,
      total,
      count: total,
    });
  const exportCol = (key: string) => t(`orders.information.export.cols.${key}`);
  const paymentMethodLabel = (method: string) => {
    if (!method) return allLabel;
    if (method === 'cash') return t('orders.information.filters.cash');
    if (method === 'non-cash') return t('orders.information.filters.nonCash');
    return method;
  };

  const handleExportActive = async () => {
    setIsExporting(true);
    try {
      if (subview === 'repairs' && repairsReportQuery.data) {
        const rep = repairsReportQuery.data;
        const det = await getOrdersRepairsDetails({
          ...repairsParams,
          page: 1,
          pageSize: 1000,
          sortBy: repairsSortBy,
          sortDir: repairsSortDir,
        });
        const warnings = translateCoverageWarnings(
          t,
          rep.coverage.warnings,
          rep.coverage.warningItems,
        );
        const turnaroundWarning = translateTurnaroundWarning(
          t,
          rep.turnaroundCoverage.warning,
          rep.turnaroundCoverage.warningCode,
        );
        if (turnaroundWarning) warnings.push(turnaroundWarning);
        if (det.total > det.items.length)
          warnings.push(exportShowingWarning(det.items.length, det.total));
        exportReportWorkbookToDownload({
          filename: `orders-repairs-information-${rep.generatedAt.slice(0, 10)}.xlsx`,
          title: t('orders.information.export.repairsTitle'),
          generatedAt: rep.generatedAt,
          timeZone: rep.timeZone,
          activeFilters: [
            {
              filter: t('orders.information.filters.period'),
              value: periodFilterValue(rep.period.dateFrom, rep.period.dateTo),
            },
            {
              filter: t('orders.information.filters.status'),
              value: repairStatus
                ? translateRepairStatus(t, repairStatus)
                : allLabel,
            },
            {
              filter: t('orders.information.filters.technician'),
              value: repairMasterId || allLabel,
            },
            {
              filter: t('orders.information.filters.unassignedOnly'),
              value: yesNo(repairUnassignedOnly),
            },
            {
              filter: t('orders.information.filters.openAgeBucket'),
              value: repairAgeBucket || allLabel,
            },
            {
              filter: t('orders.information.filters.search'),
              value: repairSearch.trim() || noneLabel,
            },
          ],
          definitions: [
            {
              metric: t('orders.information.export.definitions.turnaroundHours'),
              definition: t(
                'orders.information.export.definitions.turnaroundHoursDef',
              ),
            },
            {
              metric: t('orders.information.export.definitions.openRepairAging'),
              definition: t(
                'orders.information.export.definitions.openRepairAgingDef',
              ),
            },
          ],
          warnings,
          sheets: [
            {
              name: t('orders.information.export.sheetRepairsDetail'),
              rows: det.items.map((r) => ({
                [exportCol('orderNumber')]: r.recordNumber || r.id,
                [exportCol('intakeDate')]: r.saleDate.slice(0, 10),
                [exportCol('status')]: translateRepairStatus(t, r.status),
                [exportCol('client')]: r.clientName,
                [exportCol('device')]: r.deviceName,
                [exportCol('serial')]: r.serialNumber,
                [exportCol('technician')]: translateTechnicianName(
                  t,
                  r.technicianName,
                  r.technicianId,
                ),
                [exportCol('isOpen')]: r.isOpen
                  ? t('orders.information.openClosed.open')
                  : t('orders.information.openClosed.closed'),
                [exportCol('openAgeDays')]: r.ageDays ?? '',
                [exportCol('ageBucket')]: r.ageBucket ?? '',
                [exportCol('completedAt')]: r.completedAt
                  ? r.completedAt.slice(0, 10)
                  : t('orders.information.export.legacyUnknown'),
                [exportCol('turnaroundHours')]: r.turnaroundHours ?? naLabel,
                [exportCol('orderTotal')]: r.total,
              })),
            },
            {
              name: t('orders.information.export.sheetByTechnician'),
              rows: rep.byTechnician.map((tRow) => ({
                [exportCol('technician')]: translateTechnicianName(
                  t,
                  tRow.name,
                  tRow.technicianId,
                ),
                [exportCol('openWorkload')]: tRow.openCount,
                [exportCol('completedInPeriod')]: tRow.completedInPeriod,
              })),
            },
            {
              name: t('orders.information.export.sheetCompletionTrend'),
              rows: rep.completionTrend.map((pt) => ({
                [exportCol('date')]: pt.dateKey,
                [exportCol('completedCount')]: pt.completedCount,
                [exportCol('avgTurnaroundHours')]:
                  pt.avgTurnaroundHours ?? naLabel,
              })),
            },
          ],
        });
      } else if (subview === 'sales' && salesReportQuery.data) {
        const rep = salesReportQuery.data;
        const det = await getOrdersSalesDetails({
          ...salesParams,
          page: 1,
          pageSize: 1000,
          sortBy: salesSortBy,
          sortDir: salesSortDir,
        });
        const warnings = translateCoverageWarnings(
          t,
          rep.coverage.warnings,
          rep.coverage.warningItems,
        );
        if (det.total > det.items.length)
          warnings.push(exportShowingWarning(det.items.length, det.total));
        exportReportWorkbookToDownload({
          filename: `orders-sales-information-${rep.generatedAt.slice(0, 10)}.xlsx`,
          title: t('orders.information.export.salesTitle'),
          generatedAt: rep.generatedAt,
          timeZone: rep.timeZone,
          activeFilters: [
            {
              filter: t('orders.information.filters.period'),
              value: periodFilterValue(rep.period.dateFrom, rep.period.dateTo),
            },
            {
              filter: t('orders.information.filters.status'),
              value: salesStatus
                ? translateSaleStatus(t, salesStatus)
                : allLabel,
            },
            {
              filter: t('orders.information.filters.lineKind'),
              value: translateLineKind(t, salesLineKind),
            },
            {
              filter: t('orders.information.filters.paymentMethod'),
              value: paymentMethodLabel(salesPaymentMethod),
            },
            {
              filter: t('orders.information.filters.search'),
              value: salesSearch.trim() || noneLabel,
            },
          ],
          definitions: [
            {
              metric: t('orders.information.export.definitions.netRevenue'),
              definition: t(
                'orders.information.export.definitions.netRevenueDef',
              ),
            },
            {
              metric: t('orders.information.export.definitions.aov'),
              definition: t('orders.information.export.definitions.aovDef'),
            },
            {
              metric: t('orders.information.export.definitions.returns'),
              definition: t('orders.information.export.definitions.returnsDef'),
            },
          ],
          warnings,
          sheets: [
            {
              name: t('orders.information.export.sheetSalesDetail'),
              rows: det.items.map((r) => ({
                [exportCol('orderNumber')]: r.recordNumber || r.id,
                [exportCol('date')]: r.saleDate.slice(0, 10),
                [exportCol('status')]: translateSaleStatus(t, r.status),
                [exportCol('client')]: r.clientName,
                [exportCol('units')]: r.units,
                [exportCol('grossTotal')]: r.grossTotal,
                [exportCol('discount')]: r.discountTotal,
                [exportCol('netTotal')]: r.netTotal,
                [exportCol('paidAmount')]: r.paidAmount,
                [exportCol('returnEvents')]: r.returnCount,
                [exportCol('rapidSale')]: yesNo(r.isRapidSale),
              })),
            },
            {
              name: t('orders.information.export.sheetTopItems'),
              rows: rep.topItems.map((i) => ({
                [exportCol('name')]: i.name,
                [exportCol('kind')]: translateLineKind(t, i.kind),
                [exportCol('units')]: i.units,
                [exportCol('revenue')]: i.revenue,
                [exportCol('knownCost')]: i.knownCost ?? '',
                [exportCol('unknownCostLines')]: i.unknownCostCount ?? '',
              })),
            },
            {
              name: t('orders.information.export.sheetDailyTrend'),
              rows: rep.trend.map((pt) => ({
                [exportCol('date')]: pt.dateKey,
                [exportCol('netRevenue')]: pt.revenue,
                [exportCol('ordersCount')]: pt.ordersCount,
                [exportCol('units')]: pt.units,
                [exportCol('returnsAmount')]: pt.returnsAmount,
              })),
            },
          ],
        });
      } else if (subview === 'procurement' && procReportQuery.data) {
        const rep = procReportQuery.data;
        const det = await getOrdersProcurementDetails({
          ...procParams,
          page: 1,
          pageSize: 1000,
          sortBy: procSortBy,
          sortDir: procSortDir,
        });
        const warnings = translateCoverageWarnings(
          t,
          rep.coverage.warnings,
          rep.coverage.warningItems,
        );
        if (det.total > det.items.length)
          warnings.push(exportShowingWarning(det.items.length, det.total));
        exportReportWorkbookToDownload({
          filename: `orders-procurement-information-${rep.generatedAt.slice(0, 10)}.xlsx`,
          title: t('orders.information.export.procurementTitle'),
          generatedAt: rep.generatedAt,
          timeZone: rep.timeZone,
          activeFilters: [
            {
              filter: t('orders.information.filters.period'),
              value: periodFilterValue(rep.period.dateFrom, rep.period.dateTo),
            },
            {
              filter: t('orders.information.filters.status'),
              value: procStatus
                ? translateSupplierOrderStatus(t, procStatus)
                : allLabel,
            },
            {
              filter: t('orders.information.filters.supplier'),
              value: procSupplierId || allLabel,
            },
            {
              filter: t('orders.information.filters.overdueOnlyExport'),
              value: yesNo(procOverdueOnly),
            },
            {
              filter: t('orders.information.filters.search'),
              value: procSearch.trim() || noneLabel,
            },
          ],
          definitions: [
            {
              metric: t(
                'orders.information.export.definitions.receiptPerformance',
              ),
              definition: t(
                'orders.information.export.definitions.receiptPerformanceDef',
              ),
            },
            {
              metric: t('orders.information.export.definitions.priceVariation'),
              definition: t(
                'orders.information.export.definitions.priceVariationDef',
              ),
            },
          ],
          warnings,
          sheets: [
            {
              name: t('orders.information.export.sheetProcurementOrders'),
              rows: det.items.map((r) => ({
                [exportCol('orderNumber')]: r.displayNumber,
                [exportCol('created')]: r.createdAt.slice(0, 10),
                [exportCol('deliveryDate')]: r.deliveryDate
                  ? r.deliveryDate.slice(0, 10)
                  : '',
                [exportCol('supplier')]: r.supplierName,
                [exportCol('status')]: translateSupplierOrderStatus(
                  t,
                  r.status,
                ),
                [exportCol('paymentStatus')]: translatePaymentStatus(
                  t,
                  r.paymentStatus,
                ),
                [exportCol('receiptStatus')]: translateReceiptStatus(
                  t,
                  r.receiptStatus,
                ),
                [exportCol('overdue')]: yesNo(r.isOverdue),
                [exportCol('orderedUnits')]: r.orderedUnits,
                [exportCol('receivedUnits')]: r.receivedUnits,
                [exportCol('totalSpend')]: r.total,
                [exportCol('paid')]: r.paid,
                [exportCol('outstanding')]: r.outstanding,
                [exportCol('stockedAt')]: r.stockedAt
                  ? r.stockedAt.slice(0, 10)
                  : t('orders.information.export.untrackedPending'),
              })),
            },
            {
              name: t('orders.information.export.sheetSupplierComparison'),
              rows: rep.bySupplier.map((s) => ({
                [exportCol('supplier')]: s.supplierName,
                [exportCol('orders')]: s.ordersCount,
                [exportCol('orderedUnits')]: s.orderedUnits,
                [exportCol('receivedUnits')]: s.receivedUnits,
                [exportCol('totalSpend')]: s.totalSpend,
                [exportCol('paid')]: s.paidAmount,
                [exportCol('outstanding')]: s.outstandingAmount,
                [exportCol('overdueCount')]: s.overdueCount,
                [exportCol('avgLeadDays')]: s.avgReceiptLeadDays ?? naLabel,
              })),
            },
            {
              name: t('orders.information.export.sheetProductPrices'),
              rows: rep.byProduct.map((prod) => ({
                [exportCol('product')]: prod.productName,
                [exportCol('orders')]: prod.ordersCount,
                [exportCol('orderedUnits')]: prod.orderedUnits,
                [exportCol('minPrice')]: prod.minPrice,
                [exportCol('maxPrice')]: prod.maxPrice,
                [exportCol('avgPrice')]: prod.avgPrice,
                [exportCol('latestPrice')]: prod.latestPrice,
                [exportCol('variationPct')]: prod.priceVariationPct,
              })),
            },
          ],
        });
      }
    } finally {
      setIsExporting(false);
    }
  };

  const technicians = useMemo(
    () => employees.filter((e) => e.isActive !== false),
    [employees],
  );

  // Table columns
  const repairDetailColumns: SortableColumn<OrdersRepairDetailRow>[] = [
    {
      key: 'recordNumber',
      label: t('orders.information.columns.order'),
      render: (r) => (
        <button
          type="button"
          className="finance-orders-number-button"
          onClick={() => onOpenSaleCard?.({ id: r.id, kind: 'repair' })}
        >
          {r.recordNumber || r.id.slice(-6)}
        </button>
      ),
    },
    {
      key: 'saleDate',
      label: t('orders.information.columns.intakeDevice'),
      sortable: true,
      render: (r) => (
        <div>
          <strong>
            {r.deviceName || t('orders.information.deviceFallback')}
          </strong>
          <div className="muted-copy">
            {formatDate(r.saleDate)} · {r.clientName}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: t('orders.information.columns.statusTechnician'),
      sortable: true,
      render: (r) => (
        <div>
          <span className="report-badge">
            {translateRepairStatus(t, r.status)}
          </span>
          <div className="muted-copy">
            {translateTechnicianName(t, r.technicianName, r.technicianId)}
          </div>
        </div>
      ),
    },
    {
      key: 'ageDays',
      label: t('orders.information.columns.ageTurnaround'),
      align: 'right',
      sortable: true,
      render: (r) =>
        r.isOpen ? (
          <span
            className={`report-badge ${
              r.ageBucket === '30+' || r.ageBucket === '15-30'
                ? 'is-warning'
                : 'is-info'
            }`}
          >
            {t('orders.information.cells.openDays', { days: r.ageDays ?? 0 })}
          </span>
        ) : r.turnaroundHours !== null ? (
          <span>
            {t('orders.information.cells.hours', { hours: r.turnaroundHours })}
          </span>
        ) : (
          <span className="muted-copy">
            {t('orders.information.cells.legacyUntracked')}
          </span>
        ),
    },
    {
      key: 'total',
      label: t('orders.information.columns.total'),
      align: 'right',
      sortable: true,
      render: (r) => formatCurrency(r.total),
    },
  ];

  const saleDetailColumns: SortableColumn<OrdersSaleDetailRow>[] = [
    {
      key: 'recordNumber',
      label: t('orders.information.columns.order'),
      render: (r) => (
        <button
          type="button"
          className="finance-orders-number-button"
          onClick={() => onOpenSaleCard?.({ id: r.id, kind: 'sale' })}
        >
          {r.recordNumber || r.id.slice(-6)}
        </button>
      ),
    },
    {
      key: 'saleDate',
      label: t('orders.information.columns.dateClient'),
      sortable: true,
      render: (r) => (
        <div>
          <strong>{r.clientName}</strong>
          <div className="muted-copy">{formatDate(r.saleDate)}</div>
        </div>
      ),
    },
    {
      key: 'status',
      label: t('orders.information.columns.status'),
      sortable: true,
      render: (r) => (
        <div>
          <span className="report-badge">{translateSaleStatus(t, r.status)}</span>
          {r.returnCount > 0 ? (
            <span className="report-badge is-warning" style={{ marginLeft: 4 }}>
              {t('orders.information.cells.returnsCount', {
                count: r.returnCount,
              })}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'units',
      label: t('orders.information.columns.units'),
      align: 'right',
      sortable: true,
      render: (r) => r.units,
    },
    {
      key: 'netTotal',
      label: t('orders.information.columns.netDiscount'),
      align: 'right',
      sortable: true,
      render: (r) => (
        <div>
          <strong>{formatCurrency(r.netTotal)}</strong>
          {r.discountTotal > 0 ? (
            <div className="muted-copy">
              {t('orders.information.cells.discountAmount', {
                amount: formatCurrency(r.discountTotal),
              })}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'paidAmount',
      label: t('orders.information.columns.paid'),
      align: 'right',
      render: (r) => formatCurrency(r.paidAmount),
    },
  ];

  const topSaleItemColumns: SortableColumn<
    OrdersSalesReportResponse['topItems'][number]
  >[] = [
    {
      key: 'name',
      label: t('orders.information.columns.itemKind'),
      sortable: true,
      sortValue: (i) => i.name,
      render: (i) => (
        <div>
          <strong>{i.name}</strong>
          <div className="muted-copy">{translateLineKind(t, i.kind)}</div>
        </div>
      ),
    },
    {
      key: 'units',
      label: t('orders.information.columns.units'),
      align: 'right',
      sortable: true,
      sortValue: (i) => i.units,
      render: (i) => i.units,
    },
    {
      key: 'revenue',
      label: t('orders.information.columns.revenue'),
      align: 'right',
      sortable: true,
      sortValue: (i) => i.revenue,
      render: (i) => formatCurrency(i.revenue),
    },
  ];

  const procSupplierColumns: SortableColumn<
    OrdersProcurementReportResponse['bySupplier'][number]
  >[] = [
    {
      key: 'supplierName',
      label: t('orders.information.columns.supplier'),
      sortable: true,
      sortValue: (s) => s.supplierName,
      render: (s) => (
        <button
          type="button"
          className="finance-orders-number-button"
          onClick={() => {
            setProcSupplierId((prev) =>
              prev === s.supplierId ? '' : s.supplierId,
            );
            setProcPage(1);
          }}
        >
          {s.supplierName}
        </button>
      ),
    },
    {
      key: 'ordersCount',
      label: t('orders.information.columns.posUnits'),
      align: 'right',
      sortable: true,
      sortValue: (s) => s.ordersCount,
      render: (s) => `${s.ordersCount} (${s.receivedUnits}/${s.orderedUnits})`,
    },
    {
      key: 'totalSpend',
      label: t('orders.information.columns.totalSpend'),
      align: 'right',
      sortable: true,
      sortValue: (s) => s.totalSpend,
      render: (s) => formatCurrency(s.totalSpend),
    },
    {
      key: 'outstandingAmount',
      label: t('orders.information.columns.outstanding'),
      align: 'right',
      sortable: true,
      sortValue: (s) => s.outstandingAmount,
      render: (s) => formatCurrency(s.outstandingAmount),
    },
    {
      key: 'avgReceiptLeadDays',
      label: t('orders.information.columns.avgLeadDays'),
      align: 'right',
      sortable: true,
      sortValue: (s) => s.avgReceiptLeadDays ?? 9999,
      render: (s) =>
        s.avgReceiptLeadDays !== null
          ? t('orders.information.cells.days', { days: s.avgReceiptLeadDays })
          : naLabel,
    },
  ];

  const procProductColumns: SortableColumn<
    OrdersProcurementReportResponse['byProduct'][number]
  >[] = [
    {
      key: 'productName',
      label: t('orders.information.columns.product'),
      sortable: true,
      sortValue: (p) => p.productName,
      render: (p) => p.productName,
    },
    {
      key: 'orderedUnits',
      label: t('orders.information.columns.orderedRecv'),
      align: 'right',
      sortable: true,
      sortValue: (p) => p.orderedUnits,
      render: (p) => `${p.orderedUnits} / ${p.receivedUnits}`,
    },
    {
      key: 'minPrice',
      label: t('orders.information.columns.minMaxPrice'),
      align: 'right',
      sortable: true,
      sortValue: (p) => p.minPrice,
      render: (p) =>
        `${formatCurrency(p.minPrice)} – ${formatCurrency(p.maxPrice)}`,
    },
    {
      key: 'avgPrice',
      label: t('orders.information.columns.avgLatest'),
      align: 'right',
      sortable: true,
      sortValue: (p) => p.avgPrice,
      render: (p) =>
        `${formatCurrency(p.avgPrice)} (${formatCurrency(p.latestPrice)})`,
    },
    {
      key: 'priceVariationPct',
      label: t('orders.information.columns.variationPct'),
      align: 'right',
      sortable: true,
      sortValue: (p) => p.priceVariationPct,
      render: (p) => (
        <span
          className={`report-badge ${
            p.priceVariationPct >= 15 ? 'is-warning' : ''
          }`.trim()}
        >
          {p.priceVariationPct}%
        </span>
      ),
    },
  ];

  const procDetailColumns: SortableColumn<OrdersProcurementDetailRow>[] = [
    {
      key: 'displayNumber',
      label: t('orders.information.columns.poNumber'),
      render: (r) => (
        <button
          type="button"
          className="finance-orders-number-button"
          onClick={() => onOpenSupplierOrderTab?.()}
        >
          {r.displayNumber}
        </button>
      ),
    },
    {
      key: 'createdAt',
      label: t('orders.information.columns.supplierCreated'),
      sortable: true,
      render: (r) => (
        <div>
          <strong>{r.supplierName}</strong>
          <div className="muted-copy">{formatDate(r.createdAt)}</div>
        </div>
      ),
    },
    {
      key: 'status',
      label: t('orders.information.columns.statusDelivery'),
      render: (r) => (
        <div>
          <span
            className={`report-badge ${r.isOverdue ? 'is-danger' : ''}`.trim()}
          >
            {translateSupplierOrderStatus(t, r.status)}
            {r.isOverdue
              ? ` ${t('orders.information.cells.overdueBadge')}`
              : ''}
          </span>
          <div className="muted-copy">
            {r.deliveryDate
              ? t('orders.information.cells.eta', {
                  date: formatDate(r.deliveryDate),
                })
              : t('orders.information.cells.etaNA')}
            {r.stockedAt
              ? t('orders.information.cells.stockedAt', {
                  datetime: formatDateTime(r.stockedAt),
                })
              : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'orderedUnits',
      label: t('orders.information.columns.recvOrdUnits'),
      align: 'right',
      render: (r) => `${r.receivedUnits} / ${r.orderedUnits}`,
    },
    {
      key: 'total',
      label: t('orders.information.columns.spendOutst'),
      align: 'right',
      sortable: true,
      render: (r) => (
        <div>
          <strong>{formatCurrency(r.total)}</strong>
          <div className="muted-copy">
            {t('orders.information.cells.dueAmount', {
              amount: formatCurrency(r.outstanding),
            })}
          </div>
        </div>
      ),
    },
  ];

  const repairsCoverageWarnings = (() => {
    if (!repairsReportQuery.data) return [];
    const items = translateCoverageWarnings(
      t,
      repairsReportQuery.data.coverage.warnings,
      repairsReportQuery.data.coverage.warningItems,
    );
    const turnaround = translateTurnaroundWarning(
      t,
      repairsReportQuery.data.turnaroundCoverage.warning,
      repairsReportQuery.data.turnaroundCoverage.warningCode,
    );
    if (turnaround) items.push(turnaround);
    return items;
  })();

  const salesCoverageWarnings = salesReportQuery.data
    ? translateCoverageWarnings(
        t,
        salesReportQuery.data.coverage.warnings,
        salesReportQuery.data.coverage.warningItems,
      )
    : [];

  const procCoverageWarnings = procReportQuery.data
    ? translateCoverageWarnings(
        t,
        procReportQuery.data.coverage.warnings,
        procReportQuery.data.coverage.warningItems,
      )
    : [];

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
            <h2 className="report-upgrade-header-title">
              {t('orders.information.title')}
            </h2>
            <p className="report-upgrade-header-subtitle">
              {t('orders.information.subtitle')}
            </p>
          </div>
          <div className="report-upgrade-actions">
            <div
              className="report-subview-tabs"
              role="tablist"
              aria-label={t('orders.information.viewsAria')}
            >
              {availableSubviews.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={subview === item}
                  className={`report-toggle-chip ${
                    subview === item ? 'is-active' : ''
                  }`.trim()}
                  onClick={() => setSubview(item)}
                >
                  {t(`orders.information.subviews.${item}`)}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={resetActiveFilters}
            >
              {t('orders.information.reset')}
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={isExporting}
              onClick={() => void handleExportActive()}
            >
              {isExporting
                ? t('common.exporting')
                : t('orders.information.exportExcel')}
            </button>
          </div>
        </div>

        {/* Period & subview-specific filter bar */}
        <div
          className="report-filter-bar"
          role="search"
          aria-label={t('orders.information.filtersAria')}
        >
          <div className="report-filter-field">
            <label htmlFor="oi-period">
              {t('orders.information.filters.period')}
            </label>
            <select
              id="oi-period"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value as BoundedReportPeriod);
                setRepairsPage(1);
                setSalesPage(1);
                setProcPage(1);
              }}
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {t(`orders.information.periods.${opt}`)}
                </option>
              ))}
            </select>
          </div>

          {period === 'custom' ? (
            <>
              <div className="report-filter-field">
                <label htmlFor="oi-from">
                  {t('orders.information.filters.dateFrom')}
                </label>
                <input
                  id="oi-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="report-filter-field">
                <label htmlFor="oi-to">
                  {t('orders.information.filters.dateTo')}
                </label>
                <input
                  id="oi-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </>
          ) : null}

          {subview === 'repairs' && canViewRepairs ? (
            <>
              <div className="report-filter-field">
                <label htmlFor="oi-rep-tech">
                  {t('orders.information.filters.technician')}
                </label>
                <select
                  id="oi-rep-tech"
                  value={repairMasterId}
                  onChange={(e) => {
                    setRepairMasterId(e.target.value);
                    setRepairUnassignedOnly(false);
                    setRepairsPage(1);
                  }}
                >
                  <option value="">
                    {t('orders.information.filters.allTechnicians')}
                  </option>
                  {technicians.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="report-filter-field">
                <label htmlFor="oi-rep-status">
                  {t('orders.information.filters.status')}
                </label>
                <input
                  id="oi-rep-status"
                  type="text"
                  value={repairStatus}
                  placeholder={t('orders.information.filters.allStatuses')}
                  onChange={(e) => {
                    setRepairStatus(e.target.value);
                    setRepairsPage(1);
                  }}
                />
              </div>
              <div className="report-filter-field">
                <label htmlFor="oi-rep-search">
                  {t('orders.information.filters.search')}
                </label>
                <input
                  id="oi-rep-search"
                  type="search"
                  value={repairSearch}
                  placeholder={t(
                    'orders.information.filters.repairSearchPlaceholder',
                  )}
                  onChange={(e) => {
                    setRepairSearch(e.target.value);
                    setRepairsPage(1);
                  }}
                />
              </div>
              <button
                type="button"
                className={`report-toggle-chip ${repairUnassignedOnly ? 'is-active' : ''}`}
                aria-pressed={repairUnassignedOnly}
                onClick={() => {
                  setRepairUnassignedOnly((v) => !v);
                  setRepairMasterId('');
                  setRepairsPage(1);
                }}
              >
                {t('orders.information.filters.unassignedOnly')}
              </button>
            </>
          ) : null}

          {subview === 'sales' && canViewSales ? (
            <>
              <div className="report-filter-field">
                <label htmlFor="oi-sales-kind">
                  {t('orders.information.filters.mixFilter')}
                </label>
                <select
                  id="oi-sales-kind"
                  value={salesLineKind}
                  onChange={(e) => {
                    setSalesLineKind(
                      e.target.value as 'all' | 'product' | 'service',
                    );
                    setSalesPage(1);
                  }}
                >
                  <option value="all">
                    {t('orders.information.filters.productsAndServices')}
                  </option>
                  <option value="product">
                    {t('orders.information.filters.productsOnly')}
                  </option>
                  <option value="service">
                    {t('orders.information.filters.servicesOnly')}
                  </option>
                </select>
              </div>
              <div className="report-filter-field">
                <label htmlFor="oi-sales-pm">
                  {t('orders.information.filters.paymentMethod')}
                </label>
                <select
                  id="oi-sales-pm"
                  value={salesPaymentMethod}
                  onChange={(e) => {
                    setSalesPaymentMethod(e.target.value);
                    setSalesPage(1);
                  }}
                >
                  <option value="">
                    {t('orders.information.filters.allMethods')}
                  </option>
                  <option value="cash">
                    {t('orders.information.filters.cash')}
                  </option>
                  <option value="non-cash">
                    {t('orders.information.filters.nonCash')}
                  </option>
                </select>
              </div>
              <div className="report-filter-field">
                <label htmlFor="oi-sales-search">
                  {t('orders.information.filters.search')}
                </label>
                <input
                  id="oi-sales-search"
                  type="search"
                  value={salesSearch}
                  placeholder={t(
                    'orders.information.filters.salesSearchPlaceholder',
                  )}
                  onChange={(e) => {
                    setSalesSearch(e.target.value);
                    setSalesPage(1);
                  }}
                />
              </div>
            </>
          ) : null}

          {subview === 'procurement' && canViewProcurement ? (
            <>
              <div className="report-filter-field">
                <label htmlFor="oi-proc-sup">
                  {t('orders.information.filters.supplier')}
                </label>
                <select
                  id="oi-proc-sup"
                  value={procSupplierId}
                  onChange={(e) => {
                    setProcSupplierId(e.target.value);
                    setProcPage(1);
                  }}
                >
                  <option value="">
                    {t('orders.information.filters.allSuppliers')}
                  </option>
                  {(procReportQuery.data?.supplierOptions ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="report-filter-field">
                <label htmlFor="oi-proc-search">
                  {t('orders.information.filters.search')}
                </label>
                <input
                  id="oi-proc-search"
                  type="search"
                  value={procSearch}
                  placeholder={t(
                    'orders.information.filters.procSearchPlaceholder',
                  )}
                  onChange={(e) => {
                    setProcSearch(e.target.value);
                    setProcPage(1);
                  }}
                />
              </div>
              <button
                type="button"
                className={`report-toggle-chip ${procOverdueOnly ? 'is-active' : ''}`}
                aria-pressed={procOverdueOnly}
                onClick={() => {
                  setProcOverdueOnly((v) => !v);
                  setProcPage(1);
                }}
              >
                {t('orders.information.filters.overdueOnly')}
              </button>
            </>
          ) : null}
        </div>

        {period === 'whole' ? (
          <div className="report-coverage-banner is-info" role="status">
            {t('orders.information.comparisonDisabledNotice')}
          </div>
        ) : null}

        {/* REPAIRS SUBVIEW */}
        {subview === 'repairs' && canViewRepairs ? (
          repairsReportQuery.isError ? (
            <div className="report-state-box is-error" role="alert">
              {repairsReportQuery.error instanceof Error
                ? repairsReportQuery.error.message
                : t('orders.information.errors.loadRepairsReport')}
            </div>
          ) : repairsReportQuery.data ? (
            <>
              <AnalyticsCoverageBanner
                title={t('orders.information.coverage.structuredHistoryTitle')}
                warnings={repairsCoverageWarnings}
              />

              <div className="report-kpi-grid">
                <AnalyticsKpiCard
                  label={t('orders.information.kpi.openWorkload')}
                  value={repairsReportQuery.data.summary.openCount}
                  hint={t('orders.information.kpi.unassignedCount', {
                    count: repairsReportQuery.data.summary.unassignedOpenCount,
                  })}
                  tone={
                    repairsReportQuery.data.summary.unassignedOpenCount > 0
                      ? 'warning'
                      : 'default'
                  }
                />
                <AnalyticsKpiCard
                  label={t('orders.information.kpi.intakeInPeriod')}
                  value={repairsReportQuery.data.summary.intakeCount}
                  deltaPct={repairsReportQuery.data.comparison?.intakeDeltaPct}
                  hint={
                    repairsReportQuery.data.comparison
                      ? t('orders.information.kpi.prevPeriod', {
                          count:
                            repairsReportQuery.data.comparison.intakeCountPrev,
                        })
                      : undefined
                  }
                />
                <AnalyticsKpiCard
                  label={t('orders.information.kpi.completionsInPeriod')}
                  value={repairsReportQuery.data.summary.totalCompletedCount}
                  deltaPct={
                    repairsReportQuery.data.comparison?.completedDeltaPct
                  }
                  hint={t('orders.information.kpi.structuredAndLegacy', {
                    structured:
                      repairsReportQuery.data.summary.trackedCompletedCount,
                    legacy:
                      repairsReportQuery.data.summary.untrackedCompletedCount,
                  })}
                />
                <AnalyticsKpiCard
                  label={t('orders.information.kpi.avgMedianTurnaround')}
                  value={
                    repairsReportQuery.data.summary.avgTurnaroundHours !== null
                      ? t('orders.information.kpi.hoursPair', {
                          avg: repairsReportQuery.data.summary
                            .avgTurnaroundHours,
                          median:
                            repairsReportQuery.data.summary
                              .medianTurnaroundHours ?? '-',
                        })
                      : t('orders.information.unavailable')
                  }
                  hint={t('orders.information.kpi.turnaroundCoverage', {
                    pct: repairsReportQuery.data.turnaroundCoverage.coveragePct,
                  })}
                />
              </div>

              <div className="report-two-col-grid">
                <AnalyticsSectionCard
                  title={t('orders.information.sections.openAgingBuckets')}
                  subtitle={t(
                    'orders.information.sections.openAgingBucketsSubtitle',
                  )}
                >
                  <AnalyticsInteractiveBars
                    selectedId={repairAgeBucket || null}
                    onSelect={(b) => {
                      setRepairAgeBucket((prev) => (prev === b ? '' : b));
                      setRepairsPage(1);
                    }}
                    items={repairsReportQuery.data.openAgingBuckets.map(
                      (b) => ({
                        id: b.bucket,
                        label: t('orders.information.aging.daysOpen', {
                          bucket: b.bucket,
                        }),
                        value: b.count,
                        valueText: `${b.count}`,
                        tone:
                          b.bucket === '30+'
                            ? 'danger'
                            : b.bucket === '15-30'
                              ? 'warning'
                              : 'primary',
                      }),
                    )}
                  />
                </AnalyticsSectionCard>

                <AnalyticsSectionCard
                  title={t('orders.information.sections.workloadByStatus')}
                  subtitle={t(
                    'orders.information.sections.workloadByStatusSubtitle',
                  )}
                >
                  <AnalyticsInteractiveBars
                    selectedId={repairStatus || null}
                    onSelect={(st) => {
                      setRepairStatus((prev) => (prev === st ? '' : st));
                      setRepairsPage(1);
                    }}
                    items={repairsReportQuery.data.byStatus.map((s) => ({
                      id: s.status,
                      label: translateRepairStatus(t, s.status),
                      value: s.count,
                      valueText: `${s.count}`,
                      tone: 'cyan',
                    }))}
                  />
                </AnalyticsSectionCard>
              </div>

              <AnalyticsSectionCard
                title={t('orders.information.sections.techLoadVsCompletions')}
                subtitle={t(
                  'orders.information.sections.techLoadVsCompletionsSubtitle',
                )}
              >
                <AnalyticsInteractiveBars
                  selectedId={
                    repairUnassignedOnly
                      ? '__unassigned__'
                      : repairMasterId || null
                  }
                  onSelect={(id) => {
                    if (id === '__unassigned__') {
                      setRepairUnassignedOnly((v) => !v);
                      setRepairMasterId('');
                    } else {
                      setRepairUnassignedOnly(false);
                      setRepairMasterId((prev) => (prev === id ? '' : id));
                    }
                    setRepairsPage(1);
                  }}
                  items={repairsReportQuery.data.byTechnician.map((tech) => ({
                    id: tech.technicianId ?? '__unassigned__',
                    label: translateTechnicianName(
                      t,
                      tech.name,
                      tech.technicianId,
                    ),
                    value: tech.openCount + tech.completedInPeriod,
                    valueText: t('orders.information.tech.openAndCompleted', {
                      open: tech.openCount,
                      completed: tech.completedInPeriod,
                    }),
                    tone: tech.technicianId ? 'primary' : 'warning',
                  }))}
                />
              </AnalyticsSectionCard>

              <AnalyticsSectionCard
                title={t('orders.information.sections.completionTrend')}
                subtitle={t(
                  'orders.information.sections.completionTrendSubtitle',
                )}
              >
                <AnalyticsTrendChart
                  points={repairsReportQuery.data.completionTrend}
                  series={[
                    {
                      key: 'completed',
                      label: t('orders.information.charts.completedRepairs'),
                      color: 'var(--color-primary)',
                      getValue: (pt) => pt.completedCount,
                    },
                  ]}
                />
              </AnalyticsSectionCard>

              <AnalyticsSectionCard
                title={t('orders.information.sections.repairsDrillDown')}
              >
                <AnalyticsSortableTable
                  columns={repairDetailColumns}
                  rows={repairsDetailsQuery.data?.items ?? []}
                  getRowKey={(r) => r.id}
                  sortBy={repairsSortBy}
                  sortDir={repairsSortDir}
                  onSortChange={(k, d) => {
                    setRepairsSortBy(k);
                    setRepairsSortDir(d);
                    setRepairsPage(1);
                  }}
                  loading={repairsDetailsQuery.isLoading}
                  error={
                    repairsDetailsQuery.isError
                      ? repairsDetailsQuery.error instanceof Error
                        ? repairsDetailsQuery.error.message
                        : t('orders.information.errors.loadRepairRecords')
                      : null
                  }
                  page={repairsDetailsQuery.data?.page ?? repairsPage}
                  pageSize={repairsDetailsQuery.data?.pageSize ?? 25}
                  total={repairsDetailsQuery.data?.total ?? 0}
                  onPageChange={setRepairsPage}
                />
              </AnalyticsSectionCard>
            </>
          ) : (
            <div className="report-state-box">
              {t('orders.information.loading.repairs')}
            </div>
          )
        ) : null}

        {/* SALES SUBVIEW */}
        {subview === 'sales' && canViewSales ? (
          salesReportQuery.isError ? (
            <div className="report-state-box is-error" role="alert">
              {salesReportQuery.error instanceof Error
                ? salesReportQuery.error.message
                : t('orders.information.errors.loadSalesReport')}
            </div>
          ) : salesReportQuery.data ? (
            <>
              <AnalyticsCoverageBanner warnings={salesCoverageWarnings} />

              <div className="report-kpi-grid">
                <AnalyticsKpiCard
                  label={t('orders.information.kpi.netRevenue')}
                  value={formatCurrency(
                    salesReportQuery.data.summary.netRevenue,
                  )}
                  deltaPct={salesReportQuery.data.comparison?.netRevenueDeltaPct}
                  hint={t('orders.information.kpi.grossAndDisc', {
                    gross: formatCurrency(
                      salesReportQuery.data.summary.grossRevenue,
                    ),
                    disc: formatCurrency(
                      salesReportQuery.data.summary.discountAmount,
                    ),
                  })}
                />
                <AnalyticsKpiCard
                  label={t('orders.information.kpi.ordersUnitsSold')}
                  value={`${salesReportQuery.data.summary.ordersCount} / ${salesReportQuery.data.summary.unitsSold}`}
                  deltaPct={
                    salesReportQuery.data.comparison?.ordersCountDeltaPct
                  }
                  hint={
                    salesReportQuery.data.comparison
                      ? t('orders.information.kpi.prevUnits', {
                          count: salesReportQuery.data.comparison.unitsSoldPrev,
                        })
                      : undefined
                  }
                />
                <AnalyticsKpiCard
                  label={t('orders.information.kpi.averageOrderValue')}
                  value={formatCurrency(salesReportQuery.data.summary.aov)}
                  deltaPct={salesReportQuery.data.comparison?.aovDeltaPct}
                  hint={t('orders.information.kpi.collected', {
                    amount: formatCurrency(
                      salesReportQuery.data.summary.collectedAmount,
                    ),
                  })}
                />
                <AnalyticsKpiCard
                  label={t('orders.information.kpi.returnsAndRefunds')}
                  value={formatCurrency(
                    salesReportQuery.data.summary.returnedAmount,
                  )}
                  tone={
                    salesReportQuery.data.summary.returnsCount > 0
                      ? 'warning'
                      : 'default'
                  }
                  hint={t('orders.information.kpi.returnsHint', {
                    count: salesReportQuery.data.summary.returnsCount,
                    units: salesReportQuery.data.summary.returnedUnits,
                    amount: formatCurrency(
                      salesReportQuery.data.summary.refundedAmount,
                    ),
                  })}
                />
                <AnalyticsKpiCard
                  label={t('orders.information.kpi.productServiceMix')}
                  value={`${salesReportQuery.data.mix.productSharePct}% / ${salesReportQuery.data.mix.serviceSharePct}%`}
                  hint={t('orders.information.kpi.prodSvc', {
                    prod: formatCurrency(
                      salesReportQuery.data.mix.productRevenue,
                    ),
                    svc: formatCurrency(
                      salesReportQuery.data.mix.serviceRevenue,
                    ),
                  })}
                />
              </div>

              <div className="report-two-col-grid">
                <AnalyticsSectionCard
                  title={t('orders.information.sections.revenueTrend')}
                  subtitle={t(
                    'orders.information.sections.revenueTrendSubtitle',
                  )}
                >
                  <AnalyticsTrendChart
                    points={salesReportQuery.data.trend}
                    formatYValue={(v) => formatCurrency(v)}
                    series={[
                      {
                        key: 'revenue',
                        label: t('orders.information.charts.netRevenue'),
                        color: 'var(--color-primary)',
                        getValue: (pt) => pt.revenue,
                      },
                      {
                        key: 'returns',
                        label: t('orders.information.charts.returns'),
                        color: 'var(--color-danger)',
                        getValue: (pt) => pt.returnsAmount,
                      },
                    ]}
                  />
                </AnalyticsSectionCard>

                <AnalyticsSectionCard
                  title={t('orders.information.sections.byOrderStatus')}
                  subtitle={t(
                    'orders.information.sections.byOrderStatusSubtitle',
                  )}
                >
                  <AnalyticsInteractiveBars
                    selectedId={salesStatus || null}
                    onSelect={(st) => {
                      setSalesStatus((prev) => (prev === st ? '' : st));
                      setSalesPage(1);
                    }}
                    items={salesReportQuery.data.byStatus.map((s) => ({
                      id: s.status,
                      label: t('orders.information.statusWithCount', {
                        status: translateSaleStatus(t, s.status),
                        count: s.count,
                      }),
                      value: s.netRevenue,
                      valueText: formatCurrency(s.netRevenue),
                      tone: s.status === 'returned' ? 'danger' : 'success',
                    }))}
                  />
                </AnalyticsSectionCard>
              </div>

              <AnalyticsSectionCard
                title={t('orders.information.sections.topProductsServices')}
              >
                <AnalyticsSortableTable
                  columns={topSaleItemColumns}
                  rows={salesReportQuery.data.topItems}
                  getRowKey={(i) => i.key}
                />
              </AnalyticsSectionCard>

              <AnalyticsSectionCard
                title={t('orders.information.sections.salesDrillDown')}
              >
                <AnalyticsSortableTable
                  columns={saleDetailColumns}
                  rows={salesDetailsQuery.data?.items ?? []}
                  getRowKey={(r) => r.id}
                  sortBy={salesSortBy}
                  sortDir={salesSortDir}
                  onSortChange={(k, d) => {
                    setSalesSortBy(k);
                    setSalesSortDir(d);
                    setSalesPage(1);
                  }}
                  loading={salesDetailsQuery.isLoading}
                  error={
                    salesDetailsQuery.isError
                      ? salesDetailsQuery.error instanceof Error
                        ? salesDetailsQuery.error.message
                        : t('orders.information.errors.loadSalesRecords')
                      : null
                  }
                  page={salesDetailsQuery.data?.page ?? salesPage}
                  pageSize={salesDetailsQuery.data?.pageSize ?? 25}
                  total={salesDetailsQuery.data?.total ?? 0}
                  onPageChange={setSalesPage}
                />
              </AnalyticsSectionCard>
            </>
          ) : (
            <div className="report-state-box">
              {t('orders.information.loading.sales')}
            </div>
          )
        ) : null}

        {/* PROCUREMENT SUBVIEW */}
        {subview === 'procurement' && canViewProcurement ? (
          procReportQuery.isError ? (
            <div className="report-state-box is-error" role="alert">
              {procReportQuery.error instanceof Error
                ? procReportQuery.error.message
                : t('orders.information.errors.loadProcurementReport')}
            </div>
          ) : procReportQuery.data ? (
            <>
              <AnalyticsCoverageBanner
                title={t('orders.information.coverage.receiptHistoryTitle')}
                warnings={procCoverageWarnings}
              />

              <div className="report-kpi-grid">
                <AnalyticsKpiCard
                  label={t('orders.information.kpi.totalSpend')}
                  value={formatCurrency(procReportQuery.data.summary.totalSpend)}
                  deltaPct={procReportQuery.data.comparison?.totalSpendDeltaPct}
                  invertDelta
                  hint={t('orders.information.kpi.paidAndOutstanding', {
                    paid: formatCurrency(
                      procReportQuery.data.summary.paidAmount,
                    ),
                    outstanding: formatCurrency(
                      procReportQuery.data.summary.outstandingAmount,
                    ),
                  })}
                />
                <AnalyticsKpiCard
                  label={t('orders.information.kpi.orderedReceivedPending')}
                  value={`${procReportQuery.data.summary.orderedUnits} / ${procReportQuery.data.summary.receivedUnits} / ${procReportQuery.data.summary.pendingUnits}`}
                  deltaPct={
                    procReportQuery.data.comparison?.orderedUnitsDeltaPct
                  }
                  hint={t('orders.information.kpi.ordersAndCancelled', {
                    orders: procReportQuery.data.summary.ordersCount,
                    cancelled: procReportQuery.data.summary.cancelledUnits,
                  })}
                />
                <AnalyticsKpiCard
                  label={t('orders.information.kpi.overdueDeliveries')}
                  value={procReportQuery.data.summary.overdueOrdersCount}
                  tone={
                    procReportQuery.data.summary.overdueOrdersCount > 0
                      ? 'danger'
                      : 'default'
                  }
                  hint={t('orders.information.kpi.overduePendingUnits', {
                    count: procReportQuery.data.summary.overduePendingUnits,
                  })}
                />
                <AnalyticsKpiCard
                  label={t('orders.information.kpi.receiptPerformance')}
                  value={
                    procReportQuery.data.receiptPerformance.onTimeRatePct !==
                    null
                      ? t('orders.information.kpi.onTimeRate', {
                          pct: procReportQuery.data.receiptPerformance
                            .onTimeRatePct,
                        })
                      : t('orders.information.unavailable')
                  }
                  hint={
                    procReportQuery.data.receiptPerformance
                      .avgReceiptLeadDays !== null
                      ? t('orders.information.kpi.avgLeadTracked', {
                          days: procReportQuery.data.receiptPerformance
                            .avgReceiptLeadDays,
                          pct: procReportQuery.data.receiptPerformance
                            .coveragePct,
                        })
                      : t('orders.information.kpi.trackedItems', {
                          pct: procReportQuery.data.receiptPerformance
                            .coveragePct,
                        })
                  }
                />
              </div>

              <div className="report-two-col-grid">
                <AnalyticsSectionCard
                  title={t('orders.information.sections.spendPaymentsTrend')}
                  subtitle={t(
                    'orders.information.sections.spendPaymentsTrendSubtitle',
                  )}
                >
                  <AnalyticsTrendChart
                    points={procReportQuery.data.trend}
                    formatYValue={(v) => formatCurrency(v)}
                    series={[
                      {
                        key: 'spend',
                        label: t('orders.information.charts.spend'),
                        color: 'var(--color-primary)',
                        getValue: (pt) => pt.spend,
                      },
                      {
                        key: 'paid',
                        label: t('orders.information.charts.paid'),
                        color: 'var(--color-success)',
                        getValue: (pt) => pt.paid,
                      },
                    ]}
                  />
                </AnalyticsSectionCard>

                <AnalyticsSectionCard
                  title={t('orders.information.sections.spendBySupplier')}
                  subtitle={t(
                    'orders.information.sections.spendBySupplierSubtitle',
                  )}
                >
                  <AnalyticsInteractiveBars
                    selectedId={procSupplierId || null}
                    onSelect={(sid) => {
                      setProcSupplierId((prev) => (prev === sid ? '' : sid));
                      setProcPage(1);
                    }}
                    items={procReportQuery.data.bySupplier
                      .slice(0, 8)
                      .map((s) => ({
                        id: s.supplierId,
                        label: t('orders.information.supplierPoCount', {
                          name: s.supplierName,
                          count: s.ordersCount,
                        }),
                        value: s.totalSpend,
                        valueText: formatCurrency(s.totalSpend),
                        tone: s.overdueCount > 0 ? 'warning' : 'primary',
                      }))}
                  />
                </AnalyticsSectionCard>
              </div>

              <div className="report-two-col-grid">
                <AnalyticsSectionCard
                  title={t('orders.information.sections.supplierComparison')}
                >
                  <AnalyticsSortableTable
                    columns={procSupplierColumns}
                    rows={procReportQuery.data.bySupplier}
                    getRowKey={(s) => s.supplierId}
                  />
                </AnalyticsSectionCard>

                <AnalyticsSectionCard
                  title={t('orders.information.sections.priceVariation')}
                >
                  <AnalyticsSortableTable
                    columns={procProductColumns}
                    rows={procReportQuery.data.byProduct}
                    getRowKey={(p) => p.key}
                  />
                </AnalyticsSectionCard>
              </div>

              <AnalyticsSectionCard
                title={t('orders.information.sections.supplierOrdersDrillDown')}
              >
                <AnalyticsSortableTable
                  columns={procDetailColumns}
                  rows={procDetailsQuery.data?.items ?? []}
                  getRowKey={(r) => r.id}
                  sortBy={procSortBy}
                  sortDir={procSortDir}
                  onSortChange={(k, d) => {
                    setProcSortBy(k);
                    setProcSortDir(d);
                    setProcPage(1);
                  }}
                  loading={procDetailsQuery.isLoading}
                  error={
                    procDetailsQuery.isError
                      ? procDetailsQuery.error instanceof Error
                        ? procDetailsQuery.error.message
                        : t('orders.information.errors.loadSupplierOrders')
                      : null
                  }
                  page={procDetailsQuery.data?.page ?? procPage}
                  pageSize={procDetailsQuery.data?.pageSize ?? 25}
                  total={procDetailsQuery.data?.total ?? 0}
                  onPageChange={setProcPage}
                />
              </AnalyticsSectionCard>
            </>
          ) : (
            <div className="report-state-box">
              {t('orders.information.loading.procurement')}
            </div>
          )
        ) : null}
      </div>
    </section>
  );
};
