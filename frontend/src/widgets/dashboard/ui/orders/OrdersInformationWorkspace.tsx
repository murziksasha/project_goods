import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
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
  const availableSubviews = useMemo(() => {
    const list: Array<{ key: OrdersInfoSubview; label: string }> = [];
    if (canViewRepairs) list.push({ key: 'repairs', label: 'Repairs' });
    if (canViewSales) list.push({ key: 'sales', label: 'Sales' });
    if (canViewProcurement)
      list.push({ key: 'procurement', label: 'Procurement' });
    return list;
  }, [canViewRepairs, canViewSales, canViewProcurement]);

  const [subview, setSubview] = useState<OrdersInfoSubview>(
    () => availableSubviews[0]?.key ?? 'repairs',
  );

  useEffect(() => {
    if (
      availableSubviews.length > 0 &&
      !availableSubviews.some((item) => item.key === subview)
    ) {
      setSubview(availableSubviews[0].key);
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
        const warnings = [...rep.coverage.warnings];
        if (rep.turnaroundCoverage.warning)
          warnings.push(rep.turnaroundCoverage.warning);
        if (det.total > det.items.length)
          warnings.push(`Showing ${det.items.length} of ${det.total} records.`);
        exportReportWorkbookToDownload({
          filename: `orders-repairs-information-${rep.generatedAt.slice(0, 10)}.xlsx`,
          title: 'Orders Information — Repairs',
          generatedAt: rep.generatedAt,
          timeZone: rep.timeZone,
          activeFilters: [
            { filter: 'Period', value: `${rep.period.dateFrom ?? 'All'} to ${rep.period.dateTo ?? 'All'}` },
            { filter: 'Status', value: repairStatus || 'All' },
            { filter: 'Technician', value: repairMasterId || 'All' },
            { filter: 'Unassigned only', value: repairUnassignedOnly ? 'Yes' : 'No' },
            { filter: 'Open Age Bucket', value: repairAgeBucket || 'All' },
            { filter: 'Search', value: repairSearch.trim() || 'None' },
          ],
          definitions: [
            {
              metric: 'Turnaround Hours',
              definition:
                'Calculated strictly from structured intake date (saleDate) to structured completedAt timestamp (never updatedAt).',
            },
            {
              metric: 'Open Repair Aging',
              definition: 'Europe/Kiev days open from intake date to report timestamp.',
            },
          ],
          warnings,
          sheets: [
            {
              name: 'Repairs Detail',
              rows: det.items.map((r) => ({
                OrderNumber: r.recordNumber || r.id,
                IntakeDate: r.saleDate.slice(0, 10),
                Status: r.status,
                Client: r.clientName,
                Device: r.deviceName,
                Serial: r.serialNumber,
                Technician: r.technicianName,
                IsOpen: r.isOpen ? 'Open' : 'Closed',
                OpenAgeDays: r.ageDays ?? '',
                AgeBucket: r.ageBucket ?? '',
                CompletedAt: r.completedAt ? r.completedAt.slice(0, 10) : 'Legacy/Unknown',
                TurnaroundHours: r.turnaroundHours ?? 'N/A',
                OrderTotal: r.total,
              })),
            },
            {
              name: 'By Technician',
              rows: rep.byTechnician.map((tRow) => ({
                Technician: tRow.name,
                OpenWorkload: tRow.openCount,
                CompletedInPeriod: tRow.completedInPeriod,
              })),
            },
            {
              name: 'Completion Trend',
              rows: rep.completionTrend.map((pt) => ({
                Date: pt.dateKey,
                CompletedCount: pt.completedCount,
                AvgTurnaroundHours: pt.avgTurnaroundHours ?? 'N/A',
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
        const warnings = [...rep.coverage.warnings];
        if (det.total > det.items.length)
          warnings.push(`Showing ${det.items.length} of ${det.total} records.`);
        exportReportWorkbookToDownload({
          filename: `orders-sales-information-${rep.generatedAt.slice(0, 10)}.xlsx`,
          title: 'Orders Information — Sales',
          generatedAt: rep.generatedAt,
          timeZone: rep.timeZone,
          activeFilters: [
            { filter: 'Period', value: `${rep.period.dateFrom ?? 'All'} to ${rep.period.dateTo ?? 'All'}` },
            { filter: 'Status', value: salesStatus || 'All' },
            { filter: 'Line Kind', value: salesLineKind },
            { filter: 'Payment Method', value: salesPaymentMethod || 'All' },
            { filter: 'Search', value: salesSearch.trim() || 'None' },
          ],
          definitions: [
            { metric: 'Net Revenue', definition: 'Gross line total minus order discount.' },
            { metric: 'AOV', definition: 'Net revenue divided by non-cancelled order count.' },
            {
              metric: 'Returns',
              definition: 'Derived from structured returnEvents and returned order statuses.',
            },
          ],
          warnings,
          sheets: [
            {
              name: 'Sales Detail',
              rows: det.items.map((r) => ({
                OrderNumber: r.recordNumber || r.id,
                Date: r.saleDate.slice(0, 10),
                Status: r.status,
                Client: r.clientName,
                Units: r.units,
                GrossTotal: r.grossTotal,
                Discount: r.discountTotal,
                NetTotal: r.netTotal,
                PaidAmount: r.paidAmount,
                ReturnEvents: r.returnCount,
                RapidSale: r.isRapidSale ? 'Yes' : 'No',
              })),
            },
            {
              name: 'Top Items',
              rows: rep.topItems.map((i) => ({
                Name: i.name,
                Kind: i.kind,
                Units: i.units,
                Revenue: i.revenue,
                KnownCost: i.knownCost ?? '',
                UnknownCostLines: i.unknownCostCount ?? '',
              })),
            },
            {
              name: 'Daily Trend',
              rows: rep.trend.map((pt) => ({
                Date: pt.dateKey,
                NetRevenue: pt.revenue,
                OrdersCount: pt.ordersCount,
                Units: pt.units,
                ReturnsAmount: pt.returnsAmount,
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
        const warnings = [...rep.coverage.warnings];
        if (det.total > det.items.length)
          warnings.push(`Showing ${det.items.length} of ${det.total} records.`);
        exportReportWorkbookToDownload({
          filename: `orders-procurement-information-${rep.generatedAt.slice(0, 10)}.xlsx`,
          title: 'Orders Information — Procurement',
          generatedAt: rep.generatedAt,
          timeZone: rep.timeZone,
          activeFilters: [
            { filter: 'Period', value: `${rep.period.dateFrom ?? 'All'} to ${rep.period.dateTo ?? 'All'}` },
            { filter: 'Status', value: procStatus || 'All' },
            { filter: 'Supplier', value: procSupplierId || 'All' },
            { filter: 'Overdue Only', value: procOverdueOnly ? 'Yes' : 'No' },
            { filter: 'Search', value: procSearch.trim() || 'None' },
          ],
          definitions: [
            {
              metric: 'Receipt Performance',
              definition:
                'On-time rate and lead days computed strictly from structured item receivedAt and order stockedAt timestamps.',
            },
            {
              metric: 'Price Variation %',
              definition: '((maxPrice - minPrice) / minPrice) x 100 across PO lines.',
            },
          ],
          warnings,
          sheets: [
            {
              name: 'Procurement Orders',
              rows: det.items.map((r) => ({
                OrderNumber: r.displayNumber,
                Created: r.createdAt.slice(0, 10),
                DeliveryDate: r.deliveryDate ? r.deliveryDate.slice(0, 10) : '',
                Supplier: r.supplierName,
                Status: r.status,
                PaymentStatus: r.paymentStatus,
                ReceiptStatus: r.receiptStatus,
                Overdue: r.isOverdue ? 'Yes' : 'No',
                OrderedUnits: r.orderedUnits,
                ReceivedUnits: r.receivedUnits,
                TotalSpend: r.total,
                Paid: r.paid,
                Outstanding: r.outstanding,
                StockedAt: r.stockedAt ? r.stockedAt.slice(0, 10) : 'Untracked/Pending',
              })),
            },
            {
              name: 'Supplier Comparison',
              rows: rep.bySupplier.map((s) => ({
                Supplier: s.supplierName,
                Orders: s.ordersCount,
                OrderedUnits: s.orderedUnits,
                ReceivedUnits: s.receivedUnits,
                TotalSpend: s.totalSpend,
                Paid: s.paidAmount,
                Outstanding: s.outstandingAmount,
                OverdueCount: s.overdueCount,
                AvgLeadDays: s.avgReceiptLeadDays ?? 'N/A',
              })),
            },
            {
              name: 'Product Prices',
              rows: rep.byProduct.map((p) => ({
                Product: p.productName,
                Orders: p.ordersCount,
                OrderedUnits: p.orderedUnits,
                MinPrice: p.minPrice,
                MaxPrice: p.maxPrice,
                AvgPrice: p.avgPrice,
                LatestPrice: p.latestPrice,
                VariationPct: p.priceVariationPct,
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
      label: 'Order',
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
      label: 'Intake / Device',
      sortable: true,
      render: (r) => (
        <div>
          <strong>{r.deviceName || 'Device'}</strong>
          <div className="muted-copy">
            {formatDate(r.saleDate)} · {r.clientName}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status / Technician',
      sortable: true,
      render: (r) => (
        <div>
          <span className="report-badge">{r.status}</span>
          <div className="muted-copy">{r.technicianName}</div>
        </div>
      ),
    },
    {
      key: 'ageDays',
      label: 'Age / Turnaround',
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
            Open {r.ageDays ?? 0}d
          </span>
        ) : r.turnaroundHours !== null ? (
          <span>{r.turnaroundHours}h</span>
        ) : (
          <span className="muted-copy">Legacy (untracked)</span>
        ),
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      sortable: true,
      render: (r) => formatCurrency(r.total),
    },
  ];

  const saleDetailColumns: SortableColumn<OrdersSaleDetailRow>[] = [
    {
      key: 'recordNumber',
      label: 'Order',
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
      label: 'Date / Client',
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
      label: 'Status',
      sortable: true,
      render: (r) => (
        <div>
          <span className="report-badge">{r.status}</span>
          {r.returnCount > 0 ? (
            <span className="report-badge is-warning" style={{ marginLeft: 4 }}>
              Returns: {r.returnCount}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'units',
      label: 'Units',
      align: 'right',
      sortable: true,
      render: (r) => r.units,
    },
    {
      key: 'netTotal',
      label: 'Net / Discount',
      align: 'right',
      sortable: true,
      render: (r) => (
        <div>
          <strong>{formatCurrency(r.netTotal)}</strong>
          {r.discountTotal > 0 ? (
            <div className="muted-copy">Disc -{formatCurrency(r.discountTotal)}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'paidAmount',
      label: 'Paid',
      align: 'right',
      render: (r) => formatCurrency(r.paidAmount),
    },
  ];

  const topSaleItemColumns: SortableColumn<
    OrdersSalesReportResponse['topItems'][number]
  >[] = [
    {
      key: 'name',
      label: 'Item / Kind',
      sortable: true,
      sortValue: (i) => i.name,
      render: (i) => (
        <div>
          <strong>{i.name}</strong>
          <div className="muted-copy">{i.kind}</div>
        </div>
      ),
    },
    {
      key: 'units',
      label: 'Units',
      align: 'right',
      sortable: true,
      sortValue: (i) => i.units,
      render: (i) => i.units,
    },
    {
      key: 'revenue',
      label: 'Revenue',
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
      label: 'Supplier',
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
      label: 'POs / Units',
      align: 'right',
      sortable: true,
      sortValue: (s) => s.ordersCount,
      render: (s) => `${s.ordersCount} (${s.receivedUnits}/${s.orderedUnits})`,
    },
    {
      key: 'totalSpend',
      label: 'Total Spend',
      align: 'right',
      sortable: true,
      sortValue: (s) => s.totalSpend,
      render: (s) => formatCurrency(s.totalSpend),
    },
    {
      key: 'outstandingAmount',
      label: 'Outstanding',
      align: 'right',
      sortable: true,
      sortValue: (s) => s.outstandingAmount,
      render: (s) => formatCurrency(s.outstandingAmount),
    },
    {
      key: 'avgReceiptLeadDays',
      label: 'Avg Lead Days',
      align: 'right',
      sortable: true,
      sortValue: (s) => s.avgReceiptLeadDays ?? 9999,
      render: (s) =>
        s.avgReceiptLeadDays !== null ? `${s.avgReceiptLeadDays}d` : 'N/A',
    },
  ];

  const procProductColumns: SortableColumn<
    OrdersProcurementReportResponse['byProduct'][number]
  >[] = [
    {
      key: 'productName',
      label: 'Product',
      sortable: true,
      sortValue: (p) => p.productName,
      render: (p) => p.productName,
    },
    {
      key: 'orderedUnits',
      label: 'Ordered / Recv',
      align: 'right',
      sortable: true,
      sortValue: (p) => p.orderedUnits,
      render: (p) => `${p.orderedUnits} / ${p.receivedUnits}`,
    },
    {
      key: 'minPrice',
      label: 'Min / Max Price',
      align: 'right',
      sortable: true,
      sortValue: (p) => p.minPrice,
      render: (p) =>
        `${formatCurrency(p.minPrice)} – ${formatCurrency(p.maxPrice)}`,
    },
    {
      key: 'avgPrice',
      label: 'Avg / Latest',
      align: 'right',
      sortable: true,
      sortValue: (p) => p.avgPrice,
      render: (p) =>
        `${formatCurrency(p.avgPrice)} (${formatCurrency(p.latestPrice)})`,
    },
    {
      key: 'priceVariationPct',
      label: 'Variation %',
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
      label: 'PO #',
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
      label: 'Supplier / Created',
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
      label: 'Status / Delivery',
      render: (r) => (
        <div>
          <span
            className={`report-badge ${r.isOverdue ? 'is-danger' : ''}`.trim()}
          >
            {r.status} {r.isOverdue ? '(OVERDUE)' : ''}
          </span>
          <div className="muted-copy">
            ETA {r.deliveryDate ? formatDate(r.deliveryDate) : 'N/A'}
            {r.stockedAt ? ` · Stocked ${formatDateTime(r.stockedAt)}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'orderedUnits',
      label: 'Recv / Ord Units',
      align: 'right',
      render: (r) => `${r.receivedUnits} / ${r.orderedUnits}`,
    },
    {
      key: 'total',
      label: 'Spend / Outst.',
      align: 'right',
      sortable: true,
      render: (r) => (
        <div>
          <strong>{formatCurrency(r.total)}</strong>
          <div className="muted-copy">Due: {formatCurrency(r.outstanding)}</div>
        </div>
      ),
    },
  ];

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
              Orders Information & Analytics
            </h2>
            <p className="report-upgrade-header-subtitle">
              Actionable analytics across Repairs, Sales, and Procurement with
              preceding equal-period comparisons and source drill-downs.
            </p>
          </div>
          <div className="report-upgrade-actions">
            <div className="report-subview-tabs" role="tablist" aria-label="Orders analytics views">
              {availableSubviews.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={subview === item.key}
                  className={`report-toggle-chip ${
                    subview === item.key ? 'is-active' : ''
                  }`.trim()}
                  onClick={() => setSubview(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={resetActiveFilters}
            >
              Reset
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={isExporting}
              onClick={() => void handleExportActive()}
            >
              {isExporting ? 'Exporting...' : 'Export Excel (.xlsx)'}
            </button>
          </div>
        </div>

        {/* Period & subview-specific filter bar */}
        <div className="report-filter-bar" role="search" aria-label="Orders analytics filters">
          <div className="report-filter-field">
            <label htmlFor="oi-period">Period</label>
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
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {period === 'custom' ? (
            <>
              <div className="report-filter-field">
                <label htmlFor="oi-from">From (Europe/Kiev)</label>
                <input
                  id="oi-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="report-filter-field">
                <label htmlFor="oi-to">To (Europe/Kiev)</label>
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
                <label htmlFor="oi-rep-tech">Technician</label>
                <select
                  id="oi-rep-tech"
                  value={repairMasterId}
                  onChange={(e) => {
                    setRepairMasterId(e.target.value);
                    setRepairUnassignedOnly(false);
                    setRepairsPage(1);
                  }}
                >
                  <option value="">All technicians</option>
                  {technicians.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="report-filter-field">
                <label htmlFor="oi-rep-status">Status</label>
                <input
                  id="oi-rep-status"
                  type="text"
                  value={repairStatus}
                  placeholder="All statuses"
                  onChange={(e) => {
                    setRepairStatus(e.target.value);
                    setRepairsPage(1);
                  }}
                />
              </div>
              <div className="report-filter-field">
                <label htmlFor="oi-rep-search">Search</label>
                <input
                  id="oi-rep-search"
                  type="search"
                  value={repairSearch}
                  placeholder="Order #, client, device..."
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
                Unassigned only
              </button>
            </>
          ) : null}

          {subview === 'sales' && canViewSales ? (
            <>
              <div className="report-filter-field">
                <label htmlFor="oi-sales-kind">Mix Filter</label>
                <select
                  id="oi-sales-kind"
                  value={salesLineKind}
                  onChange={(e) => {
                    setSalesLineKind(e.target.value as 'all' | 'product' | 'service');
                    setSalesPage(1);
                  }}
                >
                  <option value="all">Products + Services</option>
                  <option value="product">Products only</option>
                  <option value="service">Services only</option>
                </select>
              </div>
              <div className="report-filter-field">
                <label htmlFor="oi-sales-pm">Payment Method</label>
                <select
                  id="oi-sales-pm"
                  value={salesPaymentMethod}
                  onChange={(e) => {
                    setSalesPaymentMethod(e.target.value);
                    setSalesPage(1);
                  }}
                >
                  <option value="">All methods</option>
                  <option value="cash">Cash</option>
                  <option value="non-cash">Non-cash</option>
                </select>
              </div>
              <div className="report-filter-field">
                <label htmlFor="oi-sales-search">Search</label>
                <input
                  id="oi-sales-search"
                  type="search"
                  value={salesSearch}
                  placeholder="Order #, client, item..."
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
                <label htmlFor="oi-proc-sup">Supplier</label>
                <select
                  id="oi-proc-sup"
                  value={procSupplierId}
                  onChange={(e) => {
                    setProcSupplierId(e.target.value);
                    setProcPage(1);
                  }}
                >
                  <option value="">All suppliers</option>
                  {(procReportQuery.data?.supplierOptions ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="report-filter-field">
                <label htmlFor="oi-proc-search">Search</label>
                <input
                  id="oi-proc-search"
                  type="search"
                  value={procSearch}
                  placeholder="PO #, supplier, product..."
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
                Overdue only
              </button>
            </>
          ) : null}
        </div>

        {period === 'whole' ? (
          <div className="report-coverage-banner is-info" role="status">
            Comparison indicators are disabled for the All-time period. Select a
            bounded window (e.g. Last 30 days) for preceding equal-length comparisons.
          </div>
        ) : null}

        {/* REPAIRS SUBVIEW */}
        {subview === 'repairs' && canViewRepairs ? (
          repairsReportQuery.isError ? (
            <div className="report-state-box is-error" role="alert">
              {repairsReportQuery.error instanceof Error
                ? repairsReportQuery.error.message
                : 'Failed to load repairs report.'}
            </div>
          ) : repairsReportQuery.data ? (
            <>
              <AnalyticsCoverageBanner
                title="Structured History & Coverage Warnings"
                warnings={[
                  ...repairsReportQuery.data.coverage.warnings,
                  ...(repairsReportQuery.data.turnaroundCoverage.warning
                    ? [repairsReportQuery.data.turnaroundCoverage.warning]
                    : []),
                ]}
              />

              <div className="report-kpi-grid">
                <AnalyticsKpiCard
                  label="Current Open Workload"
                  value={repairsReportQuery.data.summary.openCount}
                  hint={`Unassigned: ${repairsReportQuery.data.summary.unassignedOpenCount}`}
                  tone={
                    repairsReportQuery.data.summary.unassignedOpenCount > 0
                      ? 'warning'
                      : 'default'
                  }
                />
                <AnalyticsKpiCard
                  label="Intake in Period"
                  value={repairsReportQuery.data.summary.intakeCount}
                  deltaPct={repairsReportQuery.data.comparison?.intakeDeltaPct}
                  hint={
                    repairsReportQuery.data.comparison
                      ? `Prev period: ${repairsReportQuery.data.comparison.intakeCountPrev}`
                      : undefined
                  }
                />
                <AnalyticsKpiCard
                  label="Completions in Period"
                  value={repairsReportQuery.data.summary.totalCompletedCount}
                  deltaPct={repairsReportQuery.data.comparison?.completedDeltaPct}
                  hint={`Structured timestamps: ${repairsReportQuery.data.summary.trackedCompletedCount} · Legacy: ${repairsReportQuery.data.summary.untrackedCompletedCount}`}
                />
                <AnalyticsKpiCard
                  label="Avg / Median Turnaround"
                  value={
                    repairsReportQuery.data.summary.avgTurnaroundHours !== null
                      ? `${repairsReportQuery.data.summary.avgTurnaroundHours}h / ${repairsReportQuery.data.summary.medianTurnaroundHours ?? '-'}h`
                      : 'Unavailable'
                  }
                  hint={`Structured turnaround coverage: ${repairsReportQuery.data.turnaroundCoverage.coveragePct}%`}
                />
              </div>

              <div className="report-two-col-grid">
                <AnalyticsSectionCard
                  title="Open Aging Buckets"
                  subtitle="Click a bucket to filter repairs below."
                >
                  <AnalyticsInteractiveBars
                    selectedId={repairAgeBucket || null}
                    onSelect={(b) => {
                      setRepairAgeBucket((prev) => (prev === b ? '' : b));
                      setRepairsPage(1);
                    }}
                    items={repairsReportQuery.data.openAgingBuckets.map((b) => ({
                      id: b.bucket,
                      label: `${b.bucket} days open`,
                      value: b.count,
                      valueText: `${b.count}`,
                      tone:
                        b.bucket === '30+'
                          ? 'danger'
                          : b.bucket === '15-30'
                            ? 'warning'
                            : 'primary',
                    }))}
                  />
                </AnalyticsSectionCard>

                <AnalyticsSectionCard
                  title="Workload by Status & Technician"
                  subtitle="Click a status bar to filter details."
                >
                  <AnalyticsInteractiveBars
                    selectedId={repairStatus || null}
                    onSelect={(st) => {
                      setRepairStatus((prev) => (prev === st ? '' : st));
                      setRepairsPage(1);
                    }}
                    items={repairsReportQuery.data.byStatus.map((s) => ({
                      id: s.status,
                      label: s.status,
                      value: s.count,
                      valueText: `${s.count}`,
                      tone: 'cyan',
                    }))}
                  />
                </AnalyticsSectionCard>
              </div>

              <AnalyticsSectionCard
                title="Technician Open Load vs Structured Completions"
                subtitle="Click a technician bar to filter repairs."
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
                    label: tech.name,
                    value: tech.openCount + tech.completedInPeriod,
                    valueText: `${tech.openCount} open · ${tech.completedInPeriod} completed`,
                    tone: tech.technicianId ? 'primary' : 'warning',
                  }))}
                />
              </AnalyticsSectionCard>

              <AnalyticsSectionCard
                title="Structured Completion Trend"
                subtitle="Completed repairs count by structured completedAt day (Europe/Kiev)."
              >
                <AnalyticsTrendChart
                  points={repairsReportQuery.data.completionTrend}
                  series={[
                    {
                      key: 'completed',
                      label: 'Completed repairs',
                      color: 'var(--color-primary)',
                      getValue: (pt) => pt.completedCount,
                    },
                  ]}
                />
              </AnalyticsSectionCard>

              <AnalyticsSectionCard title="Repairs Drill-Down">
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
                        : 'Failed to load repair records.'
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
            <div className="report-state-box">Loading repairs analytics...</div>
          )
        ) : null}

        {/* SALES SUBVIEW */}
        {subview === 'sales' && canViewSales ? (
          salesReportQuery.isError ? (
            <div className="report-state-box is-error" role="alert">
              {salesReportQuery.error instanceof Error
                ? salesReportQuery.error.message
                : 'Failed to load sales report.'}
            </div>
          ) : salesReportQuery.data ? (
            <>
              <AnalyticsCoverageBanner warnings={salesReportQuery.data.coverage.warnings} />

              <div className="report-kpi-grid">
                <AnalyticsKpiCard
                  label="Net Revenue"
                  value={formatCurrency(salesReportQuery.data.summary.netRevenue)}
                  deltaPct={salesReportQuery.data.comparison?.netRevenueDeltaPct}
                  hint={`Gross: ${formatCurrency(salesReportQuery.data.summary.grossRevenue)} · Disc: -${formatCurrency(salesReportQuery.data.summary.discountAmount)}`}
                />
                <AnalyticsKpiCard
                  label="Orders / Units Sold"
                  value={`${salesReportQuery.data.summary.ordersCount} / ${salesReportQuery.data.summary.unitsSold}`}
                  deltaPct={salesReportQuery.data.comparison?.ordersCountDeltaPct}
                  hint={
                    salesReportQuery.data.comparison
                      ? `Prev units: ${salesReportQuery.data.comparison.unitsSoldPrev}`
                      : undefined
                  }
                />
                <AnalyticsKpiCard
                  label="Average Order Value"
                  value={formatCurrency(salesReportQuery.data.summary.aov)}
                  deltaPct={salesReportQuery.data.comparison?.aovDeltaPct}
                  hint={`Collected: ${formatCurrency(salesReportQuery.data.summary.collectedAmount)}`}
                />
                <AnalyticsKpiCard
                  label="Returns & Refunds"
                  value={formatCurrency(salesReportQuery.data.summary.returnedAmount)}
                  tone={salesReportQuery.data.summary.returnsCount > 0 ? 'warning' : 'default'}
                  hint={`${salesReportQuery.data.summary.returnsCount} returns (${salesReportQuery.data.summary.returnedUnits} units) · Refunded ${formatCurrency(salesReportQuery.data.summary.refundedAmount)}`}
                />
                <AnalyticsKpiCard
                  label="Product / Service Mix"
                  value={`${salesReportQuery.data.mix.productSharePct}% / ${salesReportQuery.data.mix.serviceSharePct}%`}
                  hint={`Prod ${formatCurrency(salesReportQuery.data.mix.productRevenue)} · Svc ${formatCurrency(salesReportQuery.data.mix.serviceRevenue)}`}
                />
              </div>

              <div className="report-two-col-grid">
                <AnalyticsSectionCard
                  title="Revenue Trend"
                  subtitle="Daily net revenue and returns in Europe/Kiev."
                >
                  <AnalyticsTrendChart
                    points={salesReportQuery.data.trend}
                    formatYValue={(v) => formatCurrency(v)}
                    series={[
                      {
                        key: 'revenue',
                        label: 'Net Revenue',
                        color: 'var(--color-primary)',
                        getValue: (pt) => pt.revenue,
                      },
                      {
                        key: 'returns',
                        label: 'Returns',
                        color: 'var(--color-danger)',
                        getValue: (pt) => pt.returnsAmount,
                      },
                    ]}
                  />
                </AnalyticsSectionCard>

                <AnalyticsSectionCard
                  title="By Order Status"
                  subtitle="Click a status bar to filter sales orders."
                >
                  <AnalyticsInteractiveBars
                    selectedId={salesStatus || null}
                    onSelect={(st) => {
                      setSalesStatus((prev) => (prev === st ? '' : st));
                      setSalesPage(1);
                    }}
                    items={salesReportQuery.data.byStatus.map((s) => ({
                      id: s.status,
                      label: `${s.status} (${s.count})`,
                      value: s.netRevenue,
                      valueText: formatCurrency(s.netRevenue),
                      tone: s.status === 'returned' ? 'danger' : 'success',
                    }))}
                  />
                </AnalyticsSectionCard>
              </div>

              <AnalyticsSectionCard title="Top Products & Services">
                <AnalyticsSortableTable
                  columns={topSaleItemColumns}
                  rows={salesReportQuery.data.topItems}
                  getRowKey={(i) => i.key}
                />
              </AnalyticsSectionCard>

              <AnalyticsSectionCard title="Sales Orders Drill-Down">
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
                        : 'Failed to load sales records.'
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
            <div className="report-state-box">Loading sales analytics...</div>
          )
        ) : null}

        {/* PROCUREMENT SUBVIEW */}
        {subview === 'procurement' && canViewProcurement ? (
          procReportQuery.isError ? (
            <div className="report-state-box is-error" role="alert">
              {procReportQuery.error instanceof Error
                ? procReportQuery.error.message
                : 'Failed to load procurement report.'}
            </div>
          ) : procReportQuery.data ? (
            <>
              <AnalyticsCoverageBanner
                title="Receipt History Coverage"
                warnings={procReportQuery.data.coverage.warnings}
              />

              <div className="report-kpi-grid">
                <AnalyticsKpiCard
                  label="Total Spend"
                  value={formatCurrency(procReportQuery.data.summary.totalSpend)}
                  deltaPct={procReportQuery.data.comparison?.totalSpendDeltaPct}
                  invertDelta
                  hint={`Paid: ${formatCurrency(procReportQuery.data.summary.paidAmount)} · Outstanding: ${formatCurrency(procReportQuery.data.summary.outstandingAmount)}`}
                />
                <AnalyticsKpiCard
                  label="Ordered / Received / Pending"
                  value={`${procReportQuery.data.summary.orderedUnits} / ${procReportQuery.data.summary.receivedUnits} / ${procReportQuery.data.summary.pendingUnits}`}
                  deltaPct={procReportQuery.data.comparison?.orderedUnitsDeltaPct}
                  hint={`Orders: ${procReportQuery.data.summary.ordersCount} · Cancelled units: ${procReportQuery.data.summary.cancelledUnits}`}
                />
                <AnalyticsKpiCard
                  label="Overdue Deliveries"
                  value={procReportQuery.data.summary.overdueOrdersCount}
                  tone={
                    procReportQuery.data.summary.overdueOrdersCount > 0
                      ? 'danger'
                      : 'default'
                  }
                  hint={`${procReportQuery.data.summary.overduePendingUnits} overdue pending units`}
                />
                <AnalyticsKpiCard
                  label="Receipt Performance"
                  value={
                    procReportQuery.data.receiptPerformance.onTimeRatePct !== null
                      ? `${procReportQuery.data.receiptPerformance.onTimeRatePct}% on time`
                      : 'Unavailable'
                  }
                  hint={
                    procReportQuery.data.receiptPerformance.avgReceiptLeadDays !== null
                      ? `Avg lead: ${procReportQuery.data.receiptPerformance.avgReceiptLeadDays}d (${procReportQuery.data.receiptPerformance.coveragePct}% tracked)`
                      : `Tracked items: ${procReportQuery.data.receiptPerformance.coveragePct}%`
                  }
                />
              </div>

              <div className="report-two-col-grid">
                <AnalyticsSectionCard
                  title="Procurement Spend & Payments Trend"
                  subtitle="Daily PO spend vs paid amounts (Europe/Kiev)."
                >
                  <AnalyticsTrendChart
                    points={procReportQuery.data.trend}
                    formatYValue={(v) => formatCurrency(v)}
                    series={[
                      {
                        key: 'spend',
                        label: 'Spend',
                        color: 'var(--color-primary)',
                        getValue: (pt) => pt.spend,
                      },
                      {
                        key: 'paid',
                        label: 'Paid',
                        color: 'var(--color-success)',
                        getValue: (pt) => pt.paid,
                      },
                    ]}
                  />
                </AnalyticsSectionCard>

                <AnalyticsSectionCard
                  title="Spend by Supplier"
                  subtitle="Click any supplier bar to filter PO drill-down."
                >
                  <AnalyticsInteractiveBars
                    selectedId={procSupplierId || null}
                    onSelect={(sid) => {
                      setProcSupplierId((prev) => (prev === sid ? '' : sid));
                      setProcPage(1);
                    }}
                    items={procReportQuery.data.bySupplier.slice(0, 8).map((s) => ({
                      id: s.supplierId,
                      label: `${s.supplierName} (${s.ordersCount} POs)`,
                      value: s.totalSpend,
                      valueText: formatCurrency(s.totalSpend),
                      tone: s.overdueCount > 0 ? 'warning' : 'primary',
                    }))}
                  />
                </AnalyticsSectionCard>
              </div>

              <div className="report-two-col-grid">
                <AnalyticsSectionCard title="Supplier Comparison">
                  <AnalyticsSortableTable
                    columns={procSupplierColumns}
                    rows={procReportQuery.data.bySupplier}
                    getRowKey={(s) => s.supplierId}
                  />
                </AnalyticsSectionCard>

                <AnalyticsSectionCard title="Product Purchase-Price Variation">
                  <AnalyticsSortableTable
                    columns={procProductColumns}
                    rows={procReportQuery.data.byProduct}
                    getRowKey={(p) => p.key}
                  />
                </AnalyticsSectionCard>
              </div>

              <AnalyticsSectionCard title="Supplier Orders Drill-Down">
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
                        : 'Failed to load supplier orders.'
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
              Loading procurement analytics...
            </div>
          )
        ) : null}
      </div>
    </section>
  );
};
