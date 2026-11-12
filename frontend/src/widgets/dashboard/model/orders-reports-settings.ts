import type {
  OrdersReportGroupBy,
  OrdersReportKind,
  OrdersReportMode,
} from '../../../entities/analytics';
import type { BoundedReportPeriod } from '../../../entities/analytics';

export const ordersReportsSettingsStorageKey = 'project-goods.orders-reports-settings';

export type OrdersReportColumnDef = {
  key: string;
  labelKey: string;
  align?: 'left' | 'right';
  finance?: boolean;
  defaultVisible?: boolean;
};

export const ORDERS_REPORT_PERIODS: BoundedReportPeriod[] = [
  'last30',
  'last7',
  'day',
  'week',
  'month',
  'year',
  'whole',
  'custom',
];

export const ORDERS_REPORT_GROUP_BY: OrdersReportGroupBy[] = [
  'master',
  'status',
  'manager',
  'client',
  'supplier',
  'day',
  'week',
  'month',
  'product',
  'service',
];

export const repairColumnDefs: OrdersReportColumnDef[] = [
  { key: 'recordNumber', labelKey: 'orders.reports.columns.recordNumber', defaultVisible: true },
  { key: 'clientName', labelKey: 'orders.reports.columns.clientName', defaultVisible: true },
  { key: 'clientPhone', labelKey: 'orders.reports.columns.clientPhone' },
  { key: 'deviceName', labelKey: 'orders.reports.columns.deviceName', defaultVisible: true },
  { key: 'serialNumber', labelKey: 'orders.reports.columns.serialNumber' },
  { key: 'masterName', labelKey: 'orders.reports.columns.masterName', defaultVisible: true },
  { key: 'managerName', labelKey: 'orders.reports.columns.managerName' },
  { key: 'status', labelKey: 'orders.reports.columns.status', defaultVisible: true },
  { key: 'intakeDate', labelKey: 'orders.reports.columns.intakeDate', defaultVisible: true },
  { key: 'completedAt', labelKey: 'orders.reports.columns.completedAt' },
  { key: 'issuedAt', labelKey: 'orders.reports.columns.issuedAt' },
  { key: 'turnaroundHours', labelKey: 'orders.reports.columns.turnaroundHours', align: 'right' },
  { key: 'total', labelKey: 'orders.reports.columns.total', align: 'right', defaultVisible: true },
  { key: 'discount', labelKey: 'orders.reports.columns.discount', align: 'right' },
  { key: 'paid', labelKey: 'orders.reports.columns.paid', align: 'right', defaultVisible: true },
  { key: 'debt', labelKey: 'orders.reports.columns.debt', align: 'right', defaultVisible: true },
  { key: 'servicesCount', labelKey: 'orders.reports.columns.servicesCount', align: 'right' },
  { key: 'productsCount', labelKey: 'orders.reports.columns.productsCount', align: 'right' },
  { key: 'knownCost', labelKey: 'orders.reports.columns.knownCost', align: 'right', finance: true },
  { key: 'knownProfit', labelKey: 'orders.reports.columns.knownProfit', align: 'right', finance: true },
  { key: 'marginPct', labelKey: 'orders.reports.columns.marginPct', align: 'right', finance: true },
  { key: 'isIncomplete', labelKey: 'orders.reports.columns.isIncomplete', finance: true },
  { key: 'missingCostCount', labelKey: 'orders.reports.columns.missingCostCount', align: 'right', finance: true },
];

export const saleColumnDefs: OrdersReportColumnDef[] = [
  { key: 'recordNumber', labelKey: 'orders.reports.columns.recordNumber', defaultVisible: true },
  { key: 'clientName', labelKey: 'orders.reports.columns.clientName', defaultVisible: true },
  { key: 'managerName', labelKey: 'orders.reports.columns.managerName' },
  { key: 'status', labelKey: 'orders.reports.columns.status', defaultVisible: true },
  { key: 'saleDate', labelKey: 'orders.reports.columns.saleDate', defaultVisible: true },
  { key: 'units', labelKey: 'orders.reports.columns.units', align: 'right', defaultVisible: true },
  { key: 'gross', labelKey: 'orders.reports.columns.gross', align: 'right' },
  { key: 'discount', labelKey: 'orders.reports.columns.discount', align: 'right' },
  { key: 'net', labelKey: 'orders.reports.columns.net', align: 'right', defaultVisible: true },
  { key: 'paid', labelKey: 'orders.reports.columns.paid', align: 'right', defaultVisible: true },
  { key: 'paidCash', labelKey: 'orders.reports.columns.paidCash', align: 'right' },
  { key: 'paidNonCash', labelKey: 'orders.reports.columns.paidNonCash', align: 'right' },
  { key: 'returnCount', labelKey: 'orders.reports.columns.returnCount', align: 'right' },
  { key: 'returnAmount', labelKey: 'orders.reports.columns.returnAmount', align: 'right' },
  { key: 'knownCost', labelKey: 'orders.reports.columns.knownCost', align: 'right', finance: true },
  { key: 'knownProfit', labelKey: 'orders.reports.columns.knownProfit', align: 'right', finance: true },
  { key: 'marginPct', labelKey: 'orders.reports.columns.marginPct', align: 'right', finance: true },
  { key: 'isIncomplete', labelKey: 'orders.reports.columns.isIncomplete', finance: true },
  { key: 'missingCostCount', labelKey: 'orders.reports.columns.missingCostCount', align: 'right', finance: true },
];

export const procurementColumnDefs: OrdersReportColumnDef[] = [
  { key: 'displayNumber', labelKey: 'orders.reports.columns.displayNumber', defaultVisible: true },
  { key: 'supplierName', labelKey: 'orders.reports.columns.supplierName', defaultVisible: true },
  { key: 'createdAt', labelKey: 'orders.reports.columns.createdAt', defaultVisible: true },
  { key: 'deliveryDate', labelKey: 'orders.reports.columns.deliveryDate', defaultVisible: true },
  { key: 'status', labelKey: 'orders.reports.columns.status', defaultVisible: true },
  { key: 'paymentStatus', labelKey: 'orders.reports.columns.paymentStatus' },
  { key: 'receiptStatus', labelKey: 'orders.reports.columns.receiptStatus' },
  { key: 'isOverdue', labelKey: 'orders.reports.columns.isOverdue', defaultVisible: true },
  { key: 'orderedUnits', labelKey: 'orders.reports.columns.orderedUnits', align: 'right' },
  { key: 'receivedUnits', labelKey: 'orders.reports.columns.receivedUnits', align: 'right' },
  { key: 'total', labelKey: 'orders.reports.columns.total', align: 'right', defaultVisible: true },
  { key: 'paid', labelKey: 'orders.reports.columns.paid', align: 'right', defaultVisible: true },
  { key: 'outstanding', labelKey: 'orders.reports.columns.outstanding', align: 'right', defaultVisible: true },
  { key: 'stockedAt', labelKey: 'orders.reports.columns.stockedAt' },
];

export const columnDefsForKind = (kind: OrdersReportKind): OrdersReportColumnDef[] => {
  if (kind === 'sales') return saleColumnDefs;
  if (kind === 'procurement') return procurementColumnDefs;
  return repairColumnDefs;
};

export const defaultColumnsForKind = (kind: OrdersReportKind, canViewFinance: boolean) =>
  columnDefsForKind(kind)
    .filter((col) => col.defaultVisible && (!col.finance || canViewFinance))
    .map((col) => col.key);

export const groupByOptionsForKind = (kind: OrdersReportKind): OrdersReportGroupBy[] => {
  if (kind === 'procurement') {
    return ['supplier', 'status', 'day', 'week', 'month', 'product'];
  }
  if (kind === 'sales') {
    return ['status', 'manager', 'client', 'day', 'week', 'month', 'product', 'service'];
  }
  return ['master', 'status', 'manager', 'client', 'day', 'week', 'month', 'product', 'service'];
};

export type StoredOrdersReportSettings = {
  kind: OrdersReportKind;
  mode: OrdersReportMode;
  period: BoundedReportPeriod;
  dateFrom: string;
  dateTo: string;
  status: string;
  masterId: string;
  managerId: string;
  q: string;
  clientId: string;
  supplierId: string;
  lineKind: string;
  paymentMethod: string;
  unpaidOnly: boolean;
  overdueOnly: boolean;
  columnsByKind: Partial<Record<OrdersReportKind, string[]>>;
  groupBy: OrdersReportGroupBy[];
  sortBy: string;
  sortDir: 'asc' | 'desc';
  pageSize: number;
};

export const defaultOrdersReportSettings = (
  canViewFinance = false,
): StoredOrdersReportSettings => ({
  kind: 'repairs',
  mode: 'register',
  period: 'last30',
  dateFrom: '',
  dateTo: '',
  status: '',
  masterId: '',
  managerId: '',
  q: '',
  clientId: '',
  supplierId: '',
  lineKind: 'all',
  paymentMethod: '',
  unpaidOnly: false,
  overdueOnly: false,
  columnsByKind: {
    repairs: defaultColumnsForKind('repairs', canViewFinance),
    sales: defaultColumnsForKind('sales', canViewFinance),
    procurement: defaultColumnsForKind('procurement', canViewFinance),
  },
  groupBy: [],
  sortBy: 'intakeDate',
  sortDir: 'desc',
  pageSize: 25,
});

const isKind = (v: unknown): v is OrdersReportKind =>
  v === 'repairs' || v === 'sales' || v === 'procurement';
const isMode = (v: unknown): v is OrdersReportMode =>
  v === 'register' || v === 'summary';
const isPeriod = (v: unknown): v is BoundedReportPeriod =>
  ORDERS_REPORT_PERIODS.includes(v as BoundedReportPeriod);

export const getStoredOrdersReportSettings = (
  canViewFinance = false,
): StoredOrdersReportSettings => {
  const fallback = defaultOrdersReportSettings(canViewFinance);
  try {
    const raw = window.localStorage.getItem(ordersReportsSettingsStorageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredOrdersReportSettings>;
    return {
      ...fallback,
      kind: isKind(parsed.kind) ? parsed.kind : fallback.kind,
      mode: isMode(parsed.mode) ? parsed.mode : fallback.mode,
      period: isPeriod(parsed.period) ? parsed.period : fallback.period,
      dateFrom: String(parsed.dateFrom ?? ''),
      dateTo: String(parsed.dateTo ?? ''),
      status: String(parsed.status ?? ''),
      masterId: String(parsed.masterId ?? ''),
      managerId: String(parsed.managerId ?? ''),
      q: String(parsed.q ?? ''),
      clientId: String(parsed.clientId ?? ''),
      supplierId: String(parsed.supplierId ?? ''),
      lineKind: String(parsed.lineKind ?? 'all'),
      paymentMethod: String(parsed.paymentMethod ?? ''),
      unpaidOnly: parsed.unpaidOnly === true,
      overdueOnly: parsed.overdueOnly === true,
      columnsByKind: {
        ...fallback.columnsByKind,
        ...(parsed.columnsByKind ?? {}),
      },
      groupBy: Array.isArray(parsed.groupBy)
        ? (parsed.groupBy.filter((g) =>
            ORDERS_REPORT_GROUP_BY.includes(g),
          ) as OrdersReportGroupBy[]).slice(0, 2)
        : [],
      sortBy: String(parsed.sortBy ?? fallback.sortBy),
      sortDir: parsed.sortDir === 'asc' ? 'asc' : 'desc',
      pageSize: Number(parsed.pageSize) > 0 ? Number(parsed.pageSize) : 25,
    };
  } catch {
    return fallback;
  }
};

export const storeOrdersReportSettings = (settings: StoredOrdersReportSettings) => {
  try {
    window.localStorage.setItem(
      ordersReportsSettingsStorageKey,
      JSON.stringify(settings),
    );
  } catch {
    // Ignore localStorage write errors.
  }
};

export const clearStoredOrdersReportSettings = () => {
  try {
    window.localStorage.removeItem(ordersReportsSettingsStorageKey);
  } catch {
    // Ignore localStorage remove errors.
  }
};

export const sanitizeColumns = (
  kind: OrdersReportKind,
  columns: string[] | undefined,
  canViewFinance: boolean,
): string[] => {
  const allowed = columnDefsForKind(kind).filter(
    (col) => !col.finance || canViewFinance,
  );
  const allowedKeys = new Set(allowed.map((col) => col.key));
  const ordered = (columns ?? []).filter((key) => allowedKeys.has(key));
  // Keep user order; if empty, fall back to defaults.
  if (ordered.length === 0) return defaultColumnsForKind(kind, canViewFinance);
  return ordered;
};

export const defaultSortForKind = (kind: OrdersReportKind) => {
  if (kind === 'sales') return 'saleDate';
  if (kind === 'procurement') return 'createdAt';
  return 'intakeDate';
};
