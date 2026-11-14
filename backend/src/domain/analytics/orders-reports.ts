import mongoose from 'mongoose';
import { Sale, type SaleDocument } from '../sale/model';

// Lean Sale documents are structurally wider than FinanceSaleLike snapshots.
type LooseSale = SaleDocument & Record<string, unknown>;
import { Product } from '../product/model';
import { Supplier } from '../supplier/model';
import { SupplierOrder, type SupplierOrderDocument } from '../supplier-order/model';
import { coldSalesPurgedExist } from '../archive/yearly-dump';
import { getSaleDocumentTotal } from '../../shared/lib/saleTotals';
import { getFinancePolicy } from '../finance/policy';
import type { ServiceProfitMode } from '../finance/model';
import {
  formatKievDateKey,
  getKievWeekBoundsKeys,
  resolveBoundedPeriodWithPrevious,
  type ResolvedBoundedPeriod,
} from './period-utils';
import {
  computeLineFinances as computeLineFinancesRaw,
  computeOrderFinance as computeOrderFinanceRaw,
  getSaleLines as getSaleLinesRaw,
  publicFinanceFields,
  round1,
  roundMoney,
  type FinanceSaleLike,
  type LineLike,
  type OrderFinanceFields,
} from './orders-reports-finance';

const computeOrderFinance = (
  sale: unknown,
  productPriceMap: Map<string, number | null> = new Map(),
  serviceProfitMode?: import('../finance/model').ServiceProfitMode,
) => computeOrderFinanceRaw(sale as FinanceSaleLike, productPriceMap, serviceProfitMode);

const computeLineFinances = (
  sale: unknown,
  productPriceMap: Map<string, number | null> = new Map(),
  serviceProfitMode?: import('../finance/model').ServiceProfitMode,
) =>
  computeLineFinancesRaw(sale as FinanceSaleLike, productPriceMap, serviceProfitMode);

const getSaleLines = (sale: unknown) => getSaleLinesRaw(sale as FinanceSaleLike);

export type OrdersTableKind = 'repairs' | 'sales' | 'procurement';
export type OrdersTableMode = 'register' | 'summary';
export type OrdersTableGroupBy =
  | 'master'
  | 'status'
  | 'manager'
  | 'client'
  | 'supplier'
  | 'day'
  | 'week'
  | 'month'
  | 'product'
  | 'service';

const GROUP_BY_VALUES: OrdersTableGroupBy[] = [
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

export type OrdersTableQuery = {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  masterId?: string;
  managerId?: string;
  clientId?: string;
  q?: string;
  supplierId?: string;
  lineKind?: string;
  lineName?: string;
  paymentMethod?: string;
  unpaidOnly?: string | boolean;
  overdueOnly?: string | boolean;
  sortBy?: string;
  sortDir?: string;
  page?: number | string;
  pageSize?: number | string;
  mode?: string;
  groupBy?: string;
  cursor?: string;
};

export type OrdersTableOptions = {
  includeCosts?: boolean;
  exportMode?: boolean;
  now?: Date;
  serviceProfitMode?: ServiceProfitMode;
};

const ISSUED_STATUSES = new Set(['issued', 'issuedwithoutrepair']);
const COMPLETION_STATUSES = new Set([
  'completed',
  'issued',
  'issuedwithoutrepair',
]);
const CANCELLED_STATUSES = new Set(['cancelled', 'unavailable']);

const statusKey = (value: unknown) => String(value ?? '').trim().toLowerCase();

const toId = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value && 'toString' in value) {
    return String((value as { toString: () => string }).toString());
  }
  return String(value);
};

const isTrue = (value: unknown) =>
  value === true || String(value ?? '').toLowerCase() === 'true';

const clampInt = (value: unknown, fallback: number, min: number, max: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), min), max);
};

const parseGroupBy = (raw: unknown): OrdersTableGroupBy[] => {
  const parts = String(raw ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const out: OrdersTableGroupBy[] = [];
  for (const part of parts) {
    if (GROUP_BY_VALUES.includes(part as OrdersTableGroupBy) && !out.includes(part as OrdersTableGroupBy)) {
      out.push(part as OrdersTableGroupBy);
    }
    if (out.length === 2) break;
  }
  return out;
};

const parseMode = (raw: unknown): OrdersTableMode =>
  String(raw ?? '').trim().toLowerCase() === 'summary' ? 'summary' : 'register';

const snapshotName = (value: unknown): string => {
  if (value && typeof value === 'object' && 'name' in (value as object)) {
    return String((value as { name?: string }).name ?? '').trim();
  }
  return '';
};

const snapshotPhone = (value: unknown): string => {
  if (!value || typeof value !== 'object') return '';
  const snap = value as { phone?: string; phones?: string[] };
  const phone = String(snap.phone ?? '').trim();
  if (phone) return phone;
  if (Array.isArray(snap.phones) && snap.phones[0]) {
    return String(snap.phones[0]).trim();
  }
  return '';
};

const resolveIssuedAt = (sale: {
  status?: string;
  statusTransitions?: Array<{ toStatus?: string; changedAt?: Date | string }>;
}): Date | null => {
  const transitions = Array.isArray(sale.statusTransitions) ? sale.statusTransitions : [];
  const matches = transitions
    .filter((t) => ISSUED_STATUSES.has(statusKey(t.toStatus)) && t.changedAt)
    .map((t) => new Date(t.changedAt as Date | string))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (matches[0]) return matches[0];
  if (ISSUED_STATUSES.has(statusKey(sale.status))) {
    return null;
  }
  return null;
};

const resolveCompletedAt = (sale: {
  saleDate?: Date | string;
  completedAt?: Date | string | null;
  status?: string;
  statusTransitions?: Array<{ toStatus?: string; changedAt?: Date | string }>;
}): { completedAt: Date | null; turnaroundHours: number | null } => {
  const saleAny = sale as { completedAt?: Date | string | null; statusTransitions?: Array<{ toStatus?: string; changedAt?: Date | string }> };
  let structured: Date | null =
    saleAny.completedAt instanceof Date
      ? saleAny.completedAt
      : saleAny.completedAt
        ? new Date(saleAny.completedAt)
        : null;
  if ((!structured || Number.isNaN(structured.getTime())) && Array.isArray(saleAny.statusTransitions)) {
    const match = saleAny.statusTransitions.find((t) =>
      COMPLETION_STATUSES.has(statusKey(t.toStatus)),
    );
    if (match?.changedAt) structured = new Date(match.changedAt);
  }
  if (structured && !Number.isNaN(structured.getTime()) && sale.saleDate) {
    const startMs = new Date(sale.saleDate).getTime();
    const hours = Math.max((structured.getTime() - startMs) / 3_600_000, 0);
    return { completedAt: structured, turnaroundHours: round1(hours) };
  }
  return { completedAt: null, turnaroundHours: null };
};

const calcGrossAndDiscount = (sale: LooseSale) => {
  const items = (sale.lineItems ?? []) as LineLike[];
  const gross =
    items.length > 0
      ? items.reduce(
          (sum, li) => sum + Number(li.price ?? 0) * Number(li.quantity ?? 0),
          0,
        )
      : Number(sale.salePrice ?? 0) * Number(sale.quantity ?? 1);
  const net = getSaleDocumentTotal(sale);
  const discount = roundMoney(Math.max(gross - net, 0));
  return { gross: roundMoney(gross), discount, net: roundMoney(net) };
};

const lineKindCounts = (sale: { lineItems?: unknown[] | null; quantity?: number; kind?: string }) => {
  const items = (sale.lineItems ?? []) as LineLike[];
  if (items.length === 0) {
    const qty = Math.max(Number(sale.quantity ?? 1), 0);
    return sale.kind === 'sale'
      ? { productsCount: qty, servicesCount: 0 }
      : { productsCount: 0, servicesCount: qty };
  }
  let productsCount = 0;
  let servicesCount = 0;
  for (const li of items) {
    const qty = Math.max(Number(li.quantity ?? 0), 0);
    if (li.kind === 'service') servicesCount += qty;
    else productsCount += qty;
  }
  return { productsCount, servicesCount };
};

const paymentBreakdown = (
  paymentHistory: Array<{ type?: string; paymentMethod?: string; amount?: number }> | undefined,
) => {
  let paidCash = 0;
  let paidNonCash = 0;
  for (const entry of paymentHistory ?? []) {
    const amount = Number(entry.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    const sign = entry.type === 'refund' ? -1 : 1;
    const delta = sign * amount;
    if (entry.paymentMethod === 'non-cash') paidNonCash += delta;
    else paidCash += delta;
  }
  return {
    paidCash: roundMoney(paidCash),
    paidNonCash: roundMoney(paidNonCash),
  };
};

const mongoIdFilter = (value: string) =>
  mongoose.isValidObjectId(value) ? value : value;

const periodMongoFilter = (
  field: 'saleDate' | 'createdAt',
  period: ResolvedBoundedPeriod,
): Record<string, unknown> => {
  if (!period.startUtc || !period.endUtc) return {};
  return { [field]: { $gte: period.startUtc, $lte: period.endUtc } };
};

const buildSaleMongoFilter = (
  kind: 'repair' | 'sale',
  query: OrdersTableQuery,
  period: ResolvedBoundedPeriod,
): Record<string, unknown> => {
  const filter: Record<string, unknown> = {
    kind,
    ...periodMongoFilter('saleDate', period),
  };
  const status = String(query.status ?? '').trim();
  if (status && status !== 'completed') {
    filter.status = status;
  }
  const masterId = String(query.masterId ?? '').trim();
  if (masterId === 'unassigned') {
    filter.$or = [{ master: null }, { master: { $exists: false } }];
  } else if (masterId) {
    filter.master = mongoIdFilter(masterId);
  }
  const managerId = String(query.managerId ?? '').trim();
  if (managerId === 'unassigned') {
    filter.$and = [
      ...((filter.$and as unknown[]) ?? []),
      { $or: [{ manager: null }, { manager: { $exists: false } }] },
    ];
  } else if (managerId) {
    filter.manager = mongoIdFilter(managerId);
  }
  const clientId = String(query.clientId ?? '').trim();
  if (clientId) {
    filter.client = mongoIdFilter(clientId);
  }
  return filter;
};

const REPAIR_SELECT = {
  _id: 1,
  recordNumber: 1,
  saleDate: 1,
  status: 1,
  salePrice: 1,
  quantity: 1,
  paidAmount: 1,
  master: 1,
  masterSnapshot: 1,
  manager: 1,
  managerSnapshot: 1,
  client: 1,
  clientSnapshot: 1,
  productSnapshot: 1,
  discount: 1,
  lineItems: 1,
  completedAt: 1,
  statusTransitions: 1,
  kind: 1,
};

const SALE_SELECT = {
  _id: 1,
  recordNumber: 1,
  saleDate: 1,
  status: 1,
  salePrice: 1,
  quantity: 1,
  paidAmount: 1,
  manager: 1,
  managerSnapshot: 1,
  client: 1,
  clientSnapshot: 1,
  discount: 1,
  lineItems: 1,
  paymentHistory: 1,
  returnEvents: 1,
  kind: 1,
};

const PROC_SELECT = {
  _id: 1,
  orderBaseId: 1,
  number: 1,
  supplier: 1,
  deliveryDate: 1,
  status: 1,
  paymentStatus: 1,
  receiptStatus: 1,
  total: 1,
  paid: 1,
  items: 1,
  stockedAt: 1,
  createdAt: 1,
};

const matchesSearch = (hay: string, q: string) =>
  !q || hay.toLowerCase().includes(q);

const matchesLineKind = (sale: { lineItems?: unknown[] | null }, lineKind: string) => {
  if (lineKind !== 'product' && lineKind !== 'service') return true;
  const items = sale.lineItems ?? [];
  if (items.length === 0) return lineKind === 'product';
  return items.some((li) => (li as LineLike).kind === lineKind);
};

const matchesLineName = (sale: { lineItems?: unknown[] | null }, lineName: string) => {
  if (!lineName) return true;
  const needle = lineName.toLowerCase();
  return (sale.lineItems ?? []).some(
    (li) => String((li as LineLike).name ?? '').trim().toLowerCase() === needle,
  );
};

const matchesPaymentMethod = (
  sale: {
    paidAmount?: number;
    paymentHistory?: Array<{ paymentMethod?: string }>;
  },
  paymentMethod: string,
) => {
  if (!paymentMethod) return true;
  if (paymentMethod === 'unpaid') return Number(sale.paidAmount ?? 0) <= 0;
  const methods = (sale.paymentHistory ?? []).map((p) => p.paymentMethod);
  return methods.includes(paymentMethod as 'cash' | 'non-cash');
};

const loadProductPriceMap = async (
  sales: Array<{ lineItems?: unknown[] | null }>,
): Promise<Map<string, number | null>> => {
  const ids = Array.from(
    new Set(
      sales.flatMap((sale) =>
        (sale.lineItems ?? [])
          .filter((li) => (li as LineLike).kind !== 'service')
          .map((li) => toId((li as LineLike).productId))
          .filter(Boolean),
      ),
    ),
  );
  if (ids.length === 0) return new Map();
  const products = await Product.find({ _id: { $in: ids } })
    .select({ price: 1 })
    .lean<Array<{ _id: { toString(): string }; price?: number }>>();
  return new Map(
    products.map((p) => [p._id.toString(), Math.max(Number(p.price ?? 0), 0)]),
  );
};

const resolveServiceProfitMode = async (
  includeCosts: boolean,
  override?: ServiceProfitMode,
): Promise<ServiceProfitMode> => {
  if (!includeCosts) return 'full';
  if (override) return override;
  try {
    const policy = await getFinancePolicy();
    return policy.serviceProfitMode ?? 'full';
  } catch {
    return 'full';
  }
};

export type RepairTableRow = {
  id: string;
  recordNumber: string | null;
  clientId: string;
  clientName: string;
  clientPhone: string;
  deviceName: string;
  serialNumber: string;
  masterId: string | null;
  masterName: string;
  managerId: string | null;
  managerName: string;
  status: string;
  intakeDate: string;
  completedAt: string | null;
  issuedAt: string | null;
  turnaroundHours: number | null;
  total: number;
  discount: number;
  paid: number;
  debt: number;
  servicesCount: number;
  productsCount: number;
  knownCost?: number;
  knownProfit?: number;
  marginPct?: number | null;
  isIncomplete?: boolean;
  missingCostCount?: number;
};

export type SaleTableRow = {
  id: string;
  recordNumber: string | null;
  clientId: string;
  clientName: string;
  managerId: string | null;
  managerName: string;
  status: string;
  saleDate: string;
  units: number;
  gross: number;
  discount: number;
  net: number;
  paid: number;
  paidCash: number;
  paidNonCash: number;
  returnCount: number;
  returnAmount: number;
  knownCost?: number;
  knownProfit?: number;
  marginPct?: number | null;
  isIncomplete?: boolean;
  missingCostCount?: number;
};

export type ProcurementTableRow = {
  id: string;
  displayNumber: string;
  orderBaseId: string;
  supplierId: string;
  supplierName: string;
  createdAt: string;
  deliveryDate: string;
  status: string;
  paymentStatus: string;
  receiptStatus: string;
  isOverdue: boolean;
  orderedUnits: number;
  receivedUnits: number;
  total: number;
  paid: number;
  outstanding: number;
  stockedAt: string | null;
  itemNames: string[];
};

export type GroupAggregate = {
  key: string;
  label: string;
  field: OrdersTableGroupBy;
  level: 1 | 2;
  parentKey?: string | null;
  filters: Record<string, string>;
  count: number;
  total: number;
  paid: number;
  debt: number;
  units?: number;
  avgTurnaroundHours: number | null;
  knownCost?: number;
  knownProfit?: number;
  isIncomplete?: boolean;
  missingCostCount?: number;
  children?: GroupAggregate[];
};

type AggregateSource = {
  id: string;
  total: number;
  paid: number;
  debt: number;
  units?: number;
  turnaroundHours: number | null;
  finance?: OrderFinanceFields;
  groupValues: Partial<Record<OrdersTableGroupBy, { key: string; label: string; filters: Record<string, string> }>>;
};

const emptyFinanceSum = () => ({
  knownCost: 0,
  knownProfit: 0,
  missingCostCount: 0,
  isIncomplete: false,
});

const aggregateSources = (
  sources: AggregateSource[],
  field: OrdersTableGroupBy,
  level: 1 | 2,
  parentKey: string | null,
  includeCosts: boolean,
): GroupAggregate[] => {
  const buckets = new Map<string, AggregateSource[]>();
  for (const src of sources) {
    const gv = src.groupValues[field] ?? {
      key: 'unassigned',
      label: 'Unassigned',
      filters: {},
    };
    const list = buckets.get(gv.key) ?? [];
    list.push(src);
    buckets.set(gv.key, list);
  }
  const groups: GroupAggregate[] = [];
  for (const [key, items] of buckets) {
    const meta = items[0]?.groupValues[field] ?? {
      key,
      label: key,
      filters: {},
    };
    let total = 0;
    let paid = 0;
    let debt = 0;
    let units = 0;
    const turnarounds: number[] = [];
    const fin = emptyFinanceSum();
    for (const item of items) {
      total = roundMoney(total + item.total);
      paid = roundMoney(paid + item.paid);
      debt = roundMoney(debt + item.debt);
      units += item.units ?? 0;
      if (item.turnaroundHours !== null) turnarounds.push(item.turnaroundHours);
      if (item.finance) {
        fin.knownCost = roundMoney(fin.knownCost + item.finance.knownCost);
        fin.knownProfit = roundMoney(fin.knownProfit + item.finance.knownProfit);
        fin.missingCostCount += item.finance.missingCostCount;
        if (item.finance.isIncomplete) fin.isIncomplete = true;
      }
    }
    const avgTurnaroundHours =
      turnarounds.length > 0
        ? round1(turnarounds.reduce((s, h) => s + h, 0) / turnarounds.length)
        : null;
    const group: GroupAggregate = {
      key: parentKey ? `${parentKey}::${key}` : key,
      label: meta.label,
      field,
      level,
      parentKey,
      filters: meta.filters,
      count: items.length,
      total,
      paid,
      debt,
      units,
      avgTurnaroundHours,
    };
    if (includeCosts) {
      group.knownCost = fin.knownCost;
      group.knownProfit = fin.knownProfit;
      group.isIncomplete = fin.isIncomplete;
      group.missingCostCount = fin.missingCostCount;
    }
    groups.push(group);
  }
  groups.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  return groups;
};

const buildGrandTotal = (
  sources: AggregateSource[],
  includeCosts: boolean,
): GroupAggregate => {
  const [group] = aggregateSources(
    sources.map((src) => ({
      ...src,
      groupValues: {
        status: { key: 'all', label: 'Total', filters: {} },
      },
    })),
    'status',
    1,
    null,
    includeCosts,
  );
  return {
    ...(group ?? {
      key: 'total',
      label: 'Total',
      field: 'status',
      level: 1,
      filters: {},
      count: 0,
      total: 0,
      paid: 0,
      debt: 0,
      units: 0,
      avgTurnaroundHours: null,
    }),
    key: 'total',
    label: 'Total',
    filters: {},
  };
};

const buildGroupedTree = (
  sources: AggregateSource[],
  groupBy: OrdersTableGroupBy[],
  includeCosts: boolean,
): GroupAggregate[] => {
  if (groupBy.length === 0) return [];
  const top = aggregateSources(sources, groupBy[0]!, 1, null, includeCosts);
  if (groupBy.length === 1) return top;
  const second = groupBy[1]!;
  return top.map((parent) => {
    const childSources = sources.filter((src) => {
      const gv = src.groupValues[groupBy[0]!];
      const parentKey = gv?.key ?? 'unassigned';
      return (parent.parentKey ? `${parent.parentKey}::${parentKey}` : parentKey) === parent.key
        || parentKey === parent.key;
    });
    const children = aggregateSources(childSources, second, 2, parent.key, includeCosts).map(
      (child) => ({
        ...child,
        filters: {
          ...parent.filters,
          ...child.filters,
        },
      }),
    );
    return { ...parent, children };
  });
};

const periodBucket = (
  dateValue: Date | string | null | undefined,
  field: 'day' | 'week' | 'month',
): { key: string; label: string; filters: Record<string, string> } => {
  const dateKey = formatKievDateKey(dateValue ?? '');
  if (!dateKey) {
    return { key: 'unassigned', label: 'Unassigned', filters: {} };
  }
  if (field === 'day') {
    return {
      key: dateKey,
      label: dateKey,
      filters: { period: 'custom', dateFrom: dateKey, dateTo: dateKey },
    };
  }
  if (field === 'month') {
    const from = `${dateKey.slice(0, 7)}-01`;
    const [y, m] = dateKey.split('-').map(Number);
    const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
    const to = `${dateKey.slice(0, 7)}-${String(last).padStart(2, '0')}`;
    return {
      key: dateKey.slice(0, 7),
      label: dateKey.slice(0, 7),
      filters: { period: 'custom', dateFrom: from, dateTo: to },
    };
  }
  const week = getKievWeekBoundsKeys(dateKey);
  return {
    key: `${week.dateFrom}:${week.dateTo}`,
    label: `${week.dateFrom} – ${week.dateTo}`,
    filters: { period: 'custom', dateFrom: week.dateFrom, dateTo: week.dateTo },
  };
};

const personGroup = (
  id: string | null,
  name: string,
  filterKey: 'masterId' | 'managerId' | 'clientId' | 'supplierId',
) =>
  id
    ? { key: id, label: name || id, filters: { [filterKey]: id } }
    : { key: 'unassigned', label: 'Unassigned', filters: { [filterKey]: 'unassigned' } };

type Paging = {
  page: number;
  pageSize: number;
  exportMode: boolean;
};

const resolvePaging = (query: OrdersTableQuery, options: OrdersTableOptions): Paging => {
  const exportMode = options.exportMode === true;
  const cursorPage = query.cursor !== undefined && query.cursor !== ''
    ? Number(query.cursor)
    : Number(query.page);
  if (exportMode) {
    return {
      page: clampInt(cursorPage, 1, 1, Number.MAX_SAFE_INTEGER),
      pageSize: 1000,
      exportMode: true,
    };
  }
  return {
    page: clampInt(query.page, 1, 1, Number.MAX_SAFE_INTEGER),
    pageSize: clampInt(query.pageSize, 25, 1, 200),
    exportMode: false,
  };
};

const paginate = <T,>(rows: T[], paging: Paging) => {
  const skip = (paging.page - 1) * paging.pageSize;
  const items = rows.slice(skip, skip + paging.pageSize);
  const hasMore = skip + items.length < rows.length;
  return {
    items,
    total: rows.length,
    page: paging.page,
    pageSize: paging.pageSize,
    nextCursor: hasMore ? String(paging.page + 1) : null,
  };
};

const compareValues = (a: unknown, b: unknown, dir: number) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1 * dir;
  if (b == null) return -1 * dir;
  if (typeof a === 'number' && typeof b === 'number') return (a - b) * dir;
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return (Number(a) - Number(b)) * dir;
  }
  return String(a).localeCompare(String(b)) * dir;
};

const sortRows = <T extends Record<string, unknown>>(
  rows: T[],
  sortBy: string,
  sortDir: 'asc' | 'desc',
  fallback: string,
) => {
  const dir = sortDir === 'asc' ? 1 : -1;
  const key = sortBy && sortBy in (rows[0] ?? { [fallback]: true }) ? sortBy : fallback;
  rows.sort((a, b) => {
    const primary = compareValues(a[key], b[key], dir);
    if (primary !== 0) return primary;
    return String(a.id ?? '').localeCompare(String(b.id ?? '')) * dir;
  });
};

const coverageFromPurged = (purged: boolean, kind: 'repairs' | 'sales' | 'procurement') => {
  const warnings: string[] = [];
  const warningItems: Array<{ code: string }> = [];
  if (purged && kind !== 'procurement') {
    const code = kind === 'repairs' ? 'coldArchiveRepairs' : 'coldArchiveSales';
    warnings.push(
      'Cold yearly archive purges exist; period analytics cover live persisted records only.',
    );
    warningItems.push({ code });
  }
  return { coldSalesPurgedExist: purged, warnings, warningItems };
};

const attachFinanceToRow = <T extends object>(
  row: T,
  finance: OrderFinanceFields | undefined,
  includeCosts: boolean,
): T => {
  if (!includeCosts || !finance) return row;
  return { ...row, ...publicFinanceFields(finance) };
};

type TableEnvelope<Row> = {
  generatedAt: string;
  timeZone: 'Europe/Kiev';
  period: { key: string; dateFrom: string | null; dateTo: string | null };
  mode: OrdersTableMode;
  groupBy: OrdersTableGroupBy[];
  items: Row[];
  groups: GroupAggregate[];
  grandTotal: GroupAggregate;
  total: number;
  page: number;
  pageSize: number;
  nextCursor: string | null;
  coverage: {
    coldSalesPurgedExist?: boolean;
    warnings: string[];
    warningItems: Array<{ code: string }>;
  };
  supplierOptions?: Array<{ id: string; name: string }>;
};

const envelope = <Row,>(
  now: Date,
  period: ResolvedBoundedPeriod,
  mode: OrdersTableMode,
  groupBy: OrdersTableGroupBy[],
  paged: { items: Row[]; total: number; page: number; pageSize: number; nextCursor: string | null },
  groups: GroupAggregate[],
  grandTotal: GroupAggregate,
  coverage: TableEnvelope<Row>['coverage'],
  extra?: Partial<TableEnvelope<Row>> & { exportMode?: boolean },
): TableEnvelope<Row> => {
  const exportMode = extra?.exportMode === true;
  const rest = { ...(extra ?? {}) };
  delete rest.exportMode;
  // /export must still page every register row even when the UI is in summary mode.
  const summaryUi = mode === 'summary' && !exportMode;
  return {
    generatedAt: now.toISOString(),
    timeZone: 'Europe/Kiev',
    period: {
      key: period.key,
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
    },
    mode,
    groupBy,
    items: summaryUi && rest.items === undefined ? [] : paged.items,
    groups: mode === 'summary' ? groups : [],
    grandTotal,
    total: summaryUi ? groups.reduce((s, g) => s + g.count, 0) : paged.total,
    page: paged.page,
    pageSize: paged.pageSize,
    nextCursor: summaryUi ? null : paged.nextCursor,
    coverage,
    ...rest,
  };
};

const resolvePeriod = (query: OrdersTableQuery, now: Date) =>
  resolveBoundedPeriodWithPrevious(query, { defaultPeriod: 'last30', now }).current;

const explodeForLineGroup = (
  sources: AggregateSource[],
  field: 'product' | 'service',
  linesById: Map<string, ReturnType<typeof computeLineFinances> | Array<{ kind: string; name: string; quantity: number; net: number; knownCost: number; costKnown: boolean }>>,
  includeCosts: boolean,
): AggregateSource[] => {
  const exploded: AggregateSource[] = [];
  for (const src of sources) {
    const lines = (linesById.get(src.id) ?? []).filter((ln) => ln.kind === field);
    if (lines.length === 0) continue;
    for (const line of lines) {
      const name = line.name || field;
      exploded.push({
        ...src,
        id: `${src.id}:${name}`,
        total: 'net' in line ? line.net : src.total,
        units: line.quantity,
        finance:
          includeCosts
            ? {
                knownCost: line.knownCost,
                knownCostRevenue: line.costKnown ? (('net' in line ? line.net : 0) as number) : 0,
                knownProfit: line.costKnown
                  ? roundMoney((('net' in line ? line.net : 0) as number) - line.knownCost)
                  : 0,
                profit: line.costKnown
                  ? roundMoney((('net' in line ? line.net : 0) as number) - line.knownCost)
                  : null,
                marginPct:
                  line.costKnown && ('net' in line ? line.net : 0) > 0
                    ? roundMoney(
                        (((('net' in line ? line.net : 0) as number) - line.knownCost) /
                          (('net' in line ? line.net : 0) as number)) *
                          100,
                      )
                    : null,
                isIncomplete: !line.costKnown,
                missingCostCount: line.costKnown ? 0 : 1,
              }
            : undefined,
        groupValues: {
          ...src.groupValues,
          [field]: {
            key: name.toLowerCase(),
            label: name,
            filters: { lineName: name, lineKind: field },
          },
        },
      });
    }
  }
  return exploded;
};

const maybeExplode = (
  sources: AggregateSource[],
  groupBy: OrdersTableGroupBy[],
  linesById: Map<string, ReturnType<typeof computeLineFinances>>,
  includeCosts: boolean,
) => {
  const lineField = groupBy.find((g) => g === 'product' || g === 'service') as
    | 'product'
    | 'service'
    | undefined;
  if (!lineField) return sources;
  return explodeForLineGroup(sources, lineField, linesById, includeCosts);
};

const REPAIR_SORT_FALLBACK = 'intakeDate';
const SALE_SORT_FALLBACK = 'saleDate';
const PROC_SORT_FALLBACK = 'createdAt';

export const getOrdersRepairsTable = async (
  query: OrdersTableQuery = {},
  options: OrdersTableOptions = {},
) => {
  const now = options.now ?? new Date();
  const includeCosts = options.includeCosts === true;
  const mode = parseMode(query.mode);
  const groupBy = parseGroupBy(query.groupBy);
  const effectiveGroupBy = mode === 'summary' && groupBy.length === 0 ? (['status'] as OrdersTableGroupBy[]) : groupBy;
  const period = resolvePeriod(query, now);
  const paging = resolvePaging(query, options);
  const mongoFilter = buildSaleMongoFilter('repair', query, period);

  const [sales, purged] = await Promise.all([
    Sale.find(mongoFilter).select(REPAIR_SELECT).lean<LooseSale[]>(),
    coldSalesPurgedExist(),
  ]);

  const q = String(query.q ?? '').trim().toLowerCase();
  const lineKind = String(query.lineKind ?? '').trim().toLowerCase();
  const lineName = String(query.lineName ?? '').trim();
  const unpaidOnly = isTrue(query.unpaidOnly);
  const unassignedOnly =
    isTrue((query as { unassignedOnly?: unknown }).unassignedOnly);
  const statusFilter = String(query.status ?? '').trim().toLowerCase();

  const productPriceMap = includeCosts ? await loadProductPriceMap(sales) : new Map<string, number | null>();
  const serviceProfitMode = await resolveServiceProfitMode(includeCosts, options.serviceProfitMode);
  const linesById = new Map<string, ReturnType<typeof computeLineFinances>>();

  const built: Array<RepairTableRow & { _source: AggregateSource }> = [];

  for (const sale of sales) {
    if (unassignedOnly && sale.master) continue;
    const masterFilter = String(query.masterId ?? '').trim();
    const saleMasterId = sale.master ? toId(sale.master) : '';
    if (masterFilter === 'unassigned' && saleMasterId) continue;
    if (masterFilter && masterFilter !== 'unassigned' && saleMasterId !== masterFilter) continue;
    const managerFilter = String(query.managerId ?? '').trim();
    const saleManagerId = sale.manager ? toId(sale.manager) : '';
    if (managerFilter === 'unassigned' && saleManagerId) continue;
    if (managerFilter && managerFilter !== 'unassigned' && saleManagerId !== managerFilter) continue;
    if (!matchesLineKind(sale, lineKind)) continue;
    if (!matchesLineName(sale, lineName)) continue;
    const money = calcGrossAndDiscount(sale);
    const paid = roundMoney(Number(sale.paidAmount ?? 0));
    const cancelled = CANCELLED_STATUSES.has(statusKey(sale.status));
    const debt = cancelled ? 0 : roundMoney(Math.max(money.net - paid, 0));
    if (unpaidOnly && debt <= 0) continue;
    if (statusFilter === 'completed') {
      const { completedAt } = resolveCompletedAt(sale);
      if (!completedAt && !COMPLETION_STATUSES.has(statusKey(sale.status))) continue;
    }
    const hay = `${sale.recordNumber ?? ''} ${snapshotName(sale.clientSnapshot)} ${snapshotPhone(sale.clientSnapshot)} ${sale.productSnapshot?.name ?? ''} ${sale.productSnapshot?.serialNumber ?? ''} ${snapshotName(sale.masterSnapshot)} ${snapshotName(sale.managerSnapshot)}`.toLowerCase();
    if (!matchesSearch(hay, q)) continue;

    const { completedAt, turnaroundHours } = resolveCompletedAt(sale);
    const issuedAt = resolveIssuedAt(sale);
    const counts = lineKindCounts(sale);
    const finance = includeCosts
      ? computeOrderFinance(sale, productPriceMap, serviceProfitMode)
      : undefined;
    const id = sale._id.toString();
    if (includeCosts) {
      linesById.set(id, computeLineFinances(sale, productPriceMap, serviceProfitMode));
    } else {
      linesById.set(
        id,
        getSaleLines(sale).map((li) => ({
          kind: (li.kind === 'service' ? 'service' : 'product') as 'product' | 'service',
          name: String(li.name ?? ''),
          quantity: Math.max(Number(li.quantity ?? 0), 0),
          net: 0,
          costKnown: false,
          knownCost: 0,
        })),
      );
    }

    const masterId = sale.master ? toId(sale.master) : null;
    const managerId = sale.manager ? toId(sale.manager) : null;
    const clientId = sale.client ? toId(sale.client) : '';
    const intakeDate = new Date(sale.saleDate).toISOString();
    const row: RepairTableRow = attachFinanceToRow(
      {
        id,
        recordNumber: sale.recordNumber ?? null,
        clientId,
        clientName: snapshotName(sale.clientSnapshot),
        clientPhone: snapshotPhone(sale.clientSnapshot),
        deviceName: sale.productSnapshot?.name ?? '',
        serialNumber: sale.productSnapshot?.serialNumber ?? '',
        masterId,
        masterName: masterId ? snapshotName(sale.masterSnapshot) || 'Assigned' : 'Unassigned',
        managerId,
        managerName: managerId ? snapshotName(sale.managerSnapshot) || 'Assigned' : 'Unassigned',
        status: sale.status,
        intakeDate,
        completedAt: completedAt ? completedAt.toISOString() : null,
        issuedAt: issuedAt ? issuedAt.toISOString() : null,
        turnaroundHours,
        total: money.net,
        discount: money.discount,
        paid,
        debt,
        servicesCount: counts.servicesCount,
        productsCount: counts.productsCount,
      },
      finance,
      includeCosts,
    );

    const source: AggregateSource = {
      id,
      total: money.net,
      paid,
      debt,
      units: counts.servicesCount + counts.productsCount,
      turnaroundHours,
      finance,
      groupValues: {
        master: personGroup(masterId, row.masterName, 'masterId'),
        manager: personGroup(managerId, row.managerName, 'managerId'),
        client: personGroup(clientId || null, row.clientName || 'Client', 'clientId'),
        status: { key: statusKey(sale.status) || 'unknown', label: sale.status || 'unknown', filters: { status: String(sale.status ?? '') } },
        day: periodBucket(sale.saleDate, 'day'),
        week: periodBucket(sale.saleDate, 'week'),
        month: periodBucket(sale.saleDate, 'month'),
      },
    };
    built.push({ ...row, _source: source });
  }

  const sortBy = String(query.sortBy ?? REPAIR_SORT_FALLBACK).trim();
  const sortDir = String(query.sortDir ?? 'desc').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';
  const rows = built.map(({ _source, ...row }) => row as RepairTableRow);
  sortRows(rows as unknown as Array<Record<string, unknown>>, sortBy, sortDir, REPAIR_SORT_FALLBACK);
  // keep sources aligned after sort by id map
  const sourceById = new Map(built.map((b) => [b.id, b._source]));
  const orderedSources = rows.map((r) => sourceById.get(r.id)!);
  const exploded = maybeExplode(orderedSources, effectiveGroupBy, linesById, includeCosts);
  const groups = buildGroupedTree(exploded, effectiveGroupBy, includeCosts);
  const grandTotal = buildGrandTotal(exploded, includeCosts);
  const paged = paginate(rows, paging);

  return envelope(
    now,
    period,
    mode,
    effectiveGroupBy,
    paged,
    groups,
    grandTotal,
    coverageFromPurged(purged, 'repairs'),
    { exportMode: options.exportMode === true },
  );
};

export const getOrdersSalesTable = async (
  query: OrdersTableQuery = {},
  options: OrdersTableOptions = {},
) => {
  const now = options.now ?? new Date();
  const includeCosts = options.includeCosts === true;
  const mode = parseMode(query.mode);
  const groupBy = parseGroupBy(query.groupBy);
  const effectiveGroupBy = mode === 'summary' && groupBy.length === 0 ? (['status'] as OrdersTableGroupBy[]) : groupBy;
  const period = resolvePeriod(query, now);
  const paging = resolvePaging(query, options);
  const mongoFilter = buildSaleMongoFilter('sale', query, period);

  const [sales, purged] = await Promise.all([
    Sale.find(mongoFilter).select(SALE_SELECT).lean<LooseSale[]>(),
    coldSalesPurgedExist(),
  ]);

  const q = String(query.q ?? '').trim().toLowerCase();
  const lineKind = String(query.lineKind ?? '').trim().toLowerCase();
  const lineName = String(query.lineName ?? '').trim();
  const paymentMethod = String(query.paymentMethod ?? '').trim().toLowerCase();
  const unpaidOnly = isTrue(query.unpaidOnly);

  const productPriceMap = includeCosts ? await loadProductPriceMap(sales) : new Map<string, number | null>();
  const serviceProfitMode = await resolveServiceProfitMode(includeCosts, options.serviceProfitMode);
  const linesById = new Map<string, ReturnType<typeof computeLineFinances>>();

  const built: Array<SaleTableRow & { _source: AggregateSource }> = [];

  for (const sale of sales) {
    if (!matchesLineKind(sale, lineKind)) continue;
    if (!matchesLineName(sale, lineName)) continue;
    if (!matchesPaymentMethod(sale, paymentMethod)) continue;
    const money = calcGrossAndDiscount(sale);
    const paid = roundMoney(Number(sale.paidAmount ?? 0));
    const cancelled = CANCELLED_STATUSES.has(statusKey(sale.status));
    const debt = cancelled ? 0 : roundMoney(Math.max(money.net - paid, 0));
    if (unpaidOnly && debt <= 0) continue;
    const itemNames = (sale.lineItems ?? []).map((li) => li.name).join(' ');
    const hay = `${sale.recordNumber ?? ''} ${snapshotName(sale.clientSnapshot)} ${itemNames} ${snapshotName(sale.managerSnapshot)}`.toLowerCase();
    if (!matchesSearch(hay, q)) continue;

    const items = sale.lineItems ?? [];
    const units =
      items.length > 0
        ? items.reduce((s, li) => s + Number(li.quantity ?? 0), 0)
        : Number(sale.quantity ?? 1);
    const payments = paymentBreakdown(
      (sale as unknown as { paymentHistory?: Array<{ type?: string; paymentMethod?: string; amount?: number }> }).paymentHistory,
    );
    const returns = ((sale as unknown as { returnEvents?: Array<{ refundAmount?: number; grossAmount?: number }> }).returnEvents ?? []);
    const returnAmount = roundMoney(
      returns.reduce((s, r) => s + Number(r.refundAmount ?? r.grossAmount ?? 0), 0),
    );
    const finance = includeCosts
      ? computeOrderFinance(sale, productPriceMap, serviceProfitMode)
      : undefined;
    const id = sale._id.toString();
    if (includeCosts) {
      linesById.set(id, computeLineFinances(sale, productPriceMap, serviceProfitMode));
    } else {
      linesById.set(
        id,
        getSaleLines(sale).map((li) => ({
          kind: (li.kind === 'service' ? 'service' : 'product') as 'product' | 'service',
          name: String(li.name ?? ''),
          quantity: Math.max(Number(li.quantity ?? 0), 0),
          net: 0,
          costKnown: false,
          knownCost: 0,
        })),
      );
    }

    const managerId = sale.manager ? toId(sale.manager) : null;
    const clientId = sale.client ? toId(sale.client) : '';
    const row: SaleTableRow = attachFinanceToRow(
      {
        id,
        recordNumber: sale.recordNumber ?? null,
        clientId,
        clientName: snapshotName(sale.clientSnapshot),
        managerId,
        managerName: managerId ? snapshotName(sale.managerSnapshot) || 'Assigned' : 'Unassigned',
        status: sale.status,
        saleDate: new Date(sale.saleDate).toISOString(),
        units,
        gross: money.gross,
        discount: money.discount,
        net: money.net,
        paid,
        paidCash: payments.paidCash,
        paidNonCash: payments.paidNonCash,
        returnCount: returns.length,
        returnAmount,
      },
      finance,
      includeCosts,
    );

    const source: AggregateSource = {
      id,
      total: money.net,
      paid,
      debt,
      units,
      turnaroundHours: null,
      finance,
      groupValues: {
        manager: personGroup(managerId, row.managerName, 'managerId'),
        client: personGroup(clientId || null, row.clientName || 'Client', 'clientId'),
        status: { key: statusKey(sale.status) || 'unknown', label: sale.status || 'unknown', filters: { status: String(sale.status ?? '') } },
        day: periodBucket(sale.saleDate, 'day'),
        week: periodBucket(sale.saleDate, 'week'),
        month: periodBucket(sale.saleDate, 'month'),
      },
    };
    built.push({ ...row, _source: source });
  }

  const sortBy = String(query.sortBy ?? SALE_SORT_FALLBACK).trim();
  const sortDir = String(query.sortDir ?? 'desc').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';
  const rows = built.map(({ _source, ...row }) => row as SaleTableRow);
  sortRows(rows as unknown as Array<Record<string, unknown>>, sortBy, sortDir, SALE_SORT_FALLBACK);
  const sourceById = new Map(built.map((b) => [b.id, b._source]));
  const orderedSources = rows.map((r) => sourceById.get(r.id)!);
  const exploded = maybeExplode(orderedSources, effectiveGroupBy, linesById, includeCosts);
  const groups = buildGroupedTree(exploded, effectiveGroupBy, includeCosts);
  const grandTotal = buildGrandTotal(exploded, includeCosts);
  const paged = paginate(rows, paging);

  return envelope(
    now,
    period,
    mode,
    effectiveGroupBy,
    paged,
    groups,
    grandTotal,
    coverageFromPurged(purged, 'sales'),
    { exportMode: options.exportMode === true },
  );
};

const isProcurementOverdue = (
  order: { status?: string; receiptStatus?: string; deliveryDate?: Date | string },
  todayKey: string,
) => {
  const deliveryKey = formatKievDateKey(order.deliveryDate);
  return (
    order.status === 'overdue' ||
    (!['cancelled', 'unavailable', 'stocked'].includes(String(order.status ?? '')) &&
      order.receiptStatus !== 'received' &&
      Boolean(deliveryKey) &&
      deliveryKey < todayKey)
  );
};

export const getOrdersProcurementTable = async (
  query: OrdersTableQuery = {},
  options: OrdersTableOptions = {},
) => {
  const now = options.now ?? new Date();
  const mode = parseMode(query.mode);
  const groupBy = parseGroupBy(query.groupBy);
  const effectiveGroupBy = mode === 'summary' && groupBy.length === 0 ? (['status'] as OrdersTableGroupBy[]) : groupBy;
  const period = resolvePeriod(query, now);
  const paging = resolvePaging(query, options);
  const todayKey = formatKievDateKey(now);

  const mongoFilter: Record<string, unknown> = {
    ...periodMongoFilter('createdAt', period),
  };
  const status = String(query.status ?? '').trim();
  if (status) mongoFilter.status = status;
  const supplierId = String(query.supplierId ?? '').trim();
  if (supplierId) mongoFilter.supplier = mongoIdFilter(supplierId);

  const [orders, suppliers] = await Promise.all([
    SupplierOrder.find(mongoFilter).select(PROC_SELECT).lean<SupplierOrderDocument[]>(),
    Supplier.find({}).select({ _id: 1, name: 1 }).lean(),
  ]);

  const supplierNameMap = new Map(suppliers.map((s) => [s._id.toString(), s.name]));
  const q = String(query.q ?? '').trim().toLowerCase();
  const lineName = String(query.lineName ?? '').trim().toLowerCase();
  const overdueOnly = isTrue(query.overdueOnly);
  const unpaidOnly = isTrue(query.unpaidOnly);

  const built: Array<ProcurementTableRow & { _source: AggregateSource }> = [];
  const linesById = new Map<string, ReturnType<typeof computeLineFinances>>();

  for (const order of orders) {
    const sid = order.supplier ? toId(order.supplier) : '';
    const sName = supplierNameMap.get(sid) ?? 'Supplier';
    const isOverdue = isProcurementOverdue(order, todayKey);
    if (overdueOnly && !isOverdue) continue;
    const itemNames = (order.items ?? []).map((i) => i.productName);
    if (lineName && !itemNames.some((n) => String(n ?? '').trim().toLowerCase() === lineName)) {
      continue;
    }
    const hay = `${order.number ?? ''} ${order.orderBaseId} ${sName} ${itemNames.join(' ')}`.toLowerCase();
    if (!matchesSearch(hay, q)) continue;
    const orderedUnits = (order.items ?? []).reduce(
      (s, i) => s + Math.max(Number(i.quantity ?? 0), 0),
      0,
    );
    const receivedUnits = (order.items ?? []).reduce(
      (s, i) =>
        s + (i.receiptStatus === 'received' ? Math.max(Number(i.quantity ?? 0), 0) : 0),
      0,
    );
    const total = roundMoney(Number(order.total ?? 0));
    const paid = roundMoney(Number(order.paid ?? 0));
    const outstanding = ['cancelled', 'unavailable'].includes(String(order.status ?? ''))
      ? 0
      : roundMoney(Math.max(total - paid, 0));
    if (unpaidOnly && outstanding <= 0) continue;

    const id = order._id.toString();
    const row: ProcurementTableRow = {
      id,
      displayNumber: order.number?.trim() || order.orderBaseId,
      orderBaseId: order.orderBaseId,
      supplierId: sid,
      supplierName: sName,
      createdAt: new Date(order.createdAt).toISOString(),
      deliveryDate: new Date(order.deliveryDate).toISOString(),
      status: order.status,
      paymentStatus: order.paymentStatus,
      receiptStatus: order.receiptStatus,
      isOverdue,
      orderedUnits,
      receivedUnits,
      total,
      paid,
      outstanding,
      stockedAt: (order as { stockedAt?: Date | null }).stockedAt
        ? new Date((order as { stockedAt: Date }).stockedAt).toISOString()
        : null,
      itemNames,
    };

    linesById.set(
      id,
      (order.items ?? []).map((item) => ({
        kind: 'product' as const,
        name: String(item.productName ?? ''),
        quantity: Math.max(Number(item.quantity ?? 0), 0),
        net: 0,
        costKnown: false,
        knownCost: 0,
      })),
    );

    const source: AggregateSource = {
      id,
      total,
      paid,
      debt: outstanding,
      units: orderedUnits,
      turnaroundHours: null,
      groupValues: {
        supplier: personGroup(sid || null, sName, 'supplierId'),
        status: { key: statusKey(order.status) || 'unknown', label: order.status || 'unknown', filters: { status: String(order.status ?? '') } },
        day: periodBucket(order.createdAt, 'day'),
        week: periodBucket(order.createdAt, 'week'),
        month: periodBucket(order.createdAt, 'month'),
      },
    };
    built.push({ ...row, _source: source });
  }

  const sortBy = String(query.sortBy ?? PROC_SORT_FALLBACK).trim();
  const sortDir = String(query.sortDir ?? 'desc').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';
  const rows = built.map(({ _source, ...row }) => row as ProcurementTableRow);
  sortRows(rows as unknown as Array<Record<string, unknown>>, sortBy, sortDir, PROC_SORT_FALLBACK);
  const sourceById = new Map(built.map((b) => [b.id, b._source]));
  const orderedSources = rows.map((r) => sourceById.get(r.id)!);
  const exploded = maybeExplode(
    orderedSources,
    effectiveGroupBy.filter((g) => g === 'product' || g === 'service' || true) as OrdersTableGroupBy[],
    linesById,
    false,
  );
  const groups = buildGroupedTree(exploded, effectiveGroupBy, false);
  const grandTotal = buildGrandTotal(exploded, false);
  const paged = paginate(rows, paging);

  return envelope(
    now,
    period,
    mode,
    effectiveGroupBy,
    paged,
    groups,
    grandTotal,
    coverageFromPurged(false, 'procurement'),
    {
      exportMode: options.exportMode === true,
      supplierOptions: suppliers
        .map((s) => ({ id: s._id.toString(), name: s.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    },
  );
};
