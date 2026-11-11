import { coldSalesPurgedExist } from '../archive/yearly-dump';
import { Product } from '../product/model';
import { Sale } from '../sale/model';
import { getAccountingBusinessDateKey } from './internal';
import { inferFinanceTransactionCategory } from './categories';
import {
  resolveLineItemEffectiveCost,
  type CostableSaleLineItem,
} from '../sale/costing';
import {
  addCalendarDays,
  diffCalendarDaysInclusive,
  listCalendarDateKeys,
} from '../analytics/period-utils';
import {
  FinanceCategory,
  FinanceTransaction,
  OTHER_CATEGORY_SLUG,
  financeTransactionCategories,
  type TransactionType,
} from './model';

export const profitReportPeriods = [
  'whole',
  'day',
  'week',
  'month',
  'year',
  'last30',
] as const;
export type ProfitReportPeriod = (typeof profitReportPeriods)[number];

export const profitReportSources = ['all', 'sales', 'services'] as const;
export type ProfitReportSource = (typeof profitReportSources)[number];

export type ProfitReportQuery = {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  source?: string;
  lossOnly?: string | boolean;
  missingCostOnly?: string | boolean;
  q?: string;
  page?: number | string;
  pageSize?: number | string;
  sortBy?: string;
  sortDir?: string;
};

export type ProfitReportBounds = {
  key: ProfitReportPeriod | 'custom';
  dateFrom: string | null;
  dateTo: string | null;
};

type LineItemLike = {
  id?: string;
  kind?: string;
  name?: string;
  price?: number;
  quantity?: number;
  productId?: unknown;
  catalogProductId?: unknown;
  serviceId?: unknown;
  costMethod?: 'fixed' | 'time_rate' | null;
  recordedMinutes?: number | null;
  fixedCost?: number | null;
  hourlyCost?: number | null;
  directExpenses?: number | null;
  unitCostOverride?: number | null;
  costSnapshot?: unknown;
  auditedCost?: unknown;
  costAuditLog?: unknown[];
};

type SaleLike = {
  saleDate?: Date | string;
  kind?: string;
  status?: string;
  salePrice?: number;
  quantity?: number;
  discount?: { mode?: string; value?: number } | null;
  lineItems?: LineItemLike[];
};

type TransactionLike = {
  type?: string;
  amount?: number;
  currency?: string;
  note?: string;
  category?: string;
  status?: string;
  isCancellation?: boolean;
  transactionDate?: Date | string;
};

export type ProfitMarginRow = {
  key: string;
  name: string;
  type: 'product' | 'service';
  quantity: number;
  cost: number;
  revenue: number;
  knownCostRevenue: number;
  profit: number;
  marginPct: number | null;
  costKnown: boolean;
  knownCount: number;
  unknownCount: number;
  catalogProductId: string | null;
  serviceId: string | null;
};

export type ProfitCashCategoryRow = {
  category: string;
  amount: number;
  count: number;
};

export type ProfitCashOperation = {
  type: TransactionType;
  category: string;
  amount: number;
  currency: string;
  note: string;
  transactionDate: string;
};

type CashBucket = {
  collected: number;
  inventoryPurchases: number;
  opex: number;
  refunds: number;
  net: number;
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const PRIMARY_CURRENCY = 'UAH';
const committedSaleStatuses = new Set(['paid', 'issued']);
const committedRepairStatuses = new Set(['issued', 'issuedWithoutRepair']);

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const toId = (value: unknown) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    return String(value.toString());
  }
  return String(value);
};

const parseDateKey = (value: unknown) => {
  const text = String(value ?? '').trim();
  return DATE_KEY.test(text) ? text : undefined;
};

const parsePeriod = (value: unknown): ProfitReportPeriod => {
  const normalized = String(value ?? 'whole').trim();
  return profitReportPeriods.includes(normalized as ProfitReportPeriod)
    ? (normalized as ProfitReportPeriod)
    : 'whole';
};

const parseSource = (value: unknown): ProfitReportSource => {
  const normalized = String(value ?? 'all').trim();
  return profitReportSources.includes(normalized as ProfitReportSource)
    ? (normalized as ProfitReportSource)
    : 'all';
};

const shiftDateKey = (key: string, days: number) => {
  const date = new Date(`${key}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const mondayOffsetFromDateKey = (key: string) => {
  const date = new Date(`${key}T12:00:00.000Z`);
  return (date.getUTCDay() + 6) % 7;
};

const lastDayOfMonthKey = (year: number, monthNumber: number) => {
  const last = new Date(Date.UTC(year, monthNumber, 0));
  return last.toISOString().slice(0, 10);
};

export const resolveProfitReportBounds = (
  query: ProfitReportQuery,
  now = new Date(),
): ProfitReportBounds => {
  const customFrom = parseDateKey(query.dateFrom);
  const customTo = parseDateKey(query.dateTo);
  if (customFrom || customTo) {
    const dateFrom = customFrom ?? customTo ?? null;
    const dateTo = customTo ?? customFrom ?? null;
    if (dateFrom && dateTo && dateFrom > dateTo) {
      return { key: 'custom', dateFrom: dateTo, dateTo: dateFrom };
    }
    return { key: 'custom', dateFrom, dateTo };
  }

  const period = parsePeriod(query.period);
  if (period === 'whole') {
    return { key: 'whole', dateFrom: null, dateTo: null };
  }

  const today = getAccountingBusinessDateKey(now);
  if (!DATE_KEY.test(today)) {
    return { key: period, dateFrom: null, dateTo: null };
  }

  if (period === 'day') {
    return { key: 'day', dateFrom: today, dateTo: today };
  }

  if (period === 'last30') {
    return { key: 'last30', dateFrom: shiftDateKey(today, -29), dateTo: today };
  }

  if (period === 'week') {
    const start = shiftDateKey(today, -mondayOffsetFromDateKey(today));
    return { key: 'week', dateFrom: start, dateTo: shiftDateKey(start, 6) };
  }

  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  if (period === 'month') {
    return {
      key: 'month',
      dateFrom: `${year}-${String(month).padStart(2, '0')}-01`,
      dateTo: lastDayOfMonthKey(year, month),
    };
  }

  return {
    key: 'year',
    dateFrom: `${year}-01-01`,
    dateTo: `${year}-12-31`,
  };
};

export const isDateKeyInBounds = (dateKey: string, bounds: ProfitReportBounds) => {
  if (!dateKey) return false;
  if (bounds.dateFrom && dateKey < bounds.dateFrom) return false;
  if (bounds.dateTo && dateKey > bounds.dateTo) return false;
  return true;
};

const isSaleInBounds = (sale: SaleLike, bounds: ProfitReportBounds) => {
  if (!sale.saleDate) return bounds.key === 'whole';
  return isDateKeyInBounds(
    getAccountingBusinessDateKey(sale.saleDate),
    bounds,
  );
};

const isTransactionInBounds = (
  transaction: TransactionLike,
  bounds: ProfitReportBounds,
) => {
  if (!transaction.transactionDate) return bounds.key === 'whole';
  return isDateKeyInBounds(
    getAccountingBusinessDateKey(transaction.transactionDate),
    bounds,
  );
};

export const isStockCommittedSale = (sale: Pick<SaleLike, 'kind' | 'status'>) => {
  const status = String(sale.status ?? '');
  return sale.kind === 'sale'
    ? committedSaleStatuses.has(status)
    : committedRepairStatuses.has(status);
};

const normalizeDiscount = (
  discount?: { mode?: string; value?: number } | null,
) => {
  const value =
    Number.isFinite(discount?.value) && (discount?.value ?? 0) > 0
      ? (discount?.value as number)
      : 0;
  return {
    mode: discount?.mode === 'amount' ? 'amount' : 'percent',
    value,
  } as const;
};

const calculateDiscountAmount = (
  total: number,
  discount?: { mode?: string; value?: number } | null,
) => {
  const normalized = normalizeDiscount(discount);
  if (normalized.value <= 0 || total <= 0) return 0;
  if (normalized.mode === 'percent') {
    return Math.min(
      roundMoney((total * normalized.value) / 100),
      total,
    );
  }
  return Math.min(roundMoney(normalized.value), total);
};

export const allocateLineRevenues = (
  lineItems: Array<{ price: number; quantity: number }>,
  discount?: { mode?: string; value?: number } | null,
) => {
  const bases = lineItems.map((item) =>
    roundMoney(Math.max(item.price, 0) * Math.max(item.quantity, 0)),
  );
  const total = roundMoney(bases.reduce((sum, value) => sum + value, 0));
  const net = Math.max(roundMoney(total - calculateDiscountAmount(total, discount)), 0);
  if (total <= 0) return bases.map(() => 0);
  const allocated = bases.map((base) => roundMoney((base / total) * net));
  const drift =
    roundMoney(net - allocated.reduce((sum, value) => sum + value, 0));
  if (allocated.length > 0) {
    allocated[allocated.length - 1] = roundMoney(
      (allocated[allocated.length - 1] ?? 0) + drift,
    );
  }
  return allocated;
};

const getSaleLineItems = (sale: SaleLike): LineItemLike[] => {
  if (Array.isArray(sale.lineItems) && sale.lineItems.length > 0) {
    return sale.lineItems;
  }
  return [
    {
      kind: sale.kind === 'repair' ? 'service' : 'product',
      name: sale.kind === 'repair' ? 'Repair' : 'Sale',
      price: Number(sale.salePrice ?? 0),
      quantity: Number(sale.quantity ?? 1),
    },
  ];
};

const matchesSource = (kind: 'product' | 'service', source: ProfitReportSource) => {
  if (source === 'all') return true;
  if (source === 'sales') return kind === 'product';
  return kind === 'service';
};

const lineType = (item: LineItemLike): 'product' | 'service' =>
  item.kind === 'service' ? 'service' : 'product';

const lineGroupKey = (item: LineItemLike, type: 'product' | 'service') => {
  const nameKey = String(item.name ?? '').trim().toLowerCase() || 'unknown';
  if (type === 'service') {
    return `service:${toId(item.serviceId) || nameKey}`;
  }
  return `product:${toId(item.catalogProductId) || toId(item.productId) || nameKey}`;
};

const emptyCashBucket = (): CashBucket => ({
  collected: 0,
  inventoryPurchases: 0,
  opex: 0,
  refunds: 0,
  net: 0,
});

const addMoney = (bucket: CashBucket, field: keyof Omit<CashBucket, 'net'>, amount: number) => {
  bucket[field] = roundMoney(bucket[field] + amount);
  bucket.net = roundMoney(
    bucket.collected - bucket.inventoryPurchases - bucket.opex - bucket.refunds,
  );
};

export const resolveTransactionCategory = (
  transaction: Pick<TransactionLike, 'type' | 'note' | 'category'>,
): string | undefined => {
  const type = String(transaction.type ?? '') as TransactionType;
  if (type !== 'deposit' && type !== 'withdraw' && type !== 'transfer') {
    return undefined;
  }
  const stored = String(transaction.category ?? '').trim();
  if (stored) return stored;
  return inferFinanceTransactionCategory(type, String(transaction.note ?? ''));
};

export const resolveReportedFinanceCategory = (
  slug: string,
  knownSlugs?: Set<string>,
) => {
  if (!knownSlugs || knownSlugs.has(slug)) return slug;
  return OTHER_CATEGORY_SLUG;
};

const cashFieldForCategory = (
  type: string,
  category: string,
): keyof Omit<CashBucket, 'net'> | null => {
  if (type === 'deposit' && category === 'client_payment') return 'collected';
  if (type === 'withdraw' && category === 'client_refund') return 'refunds';
  if (type === 'withdraw' && category === 'supplier_payment') {
    return 'inventoryPurchases';
  }
  if (type === 'withdraw') return 'opex';
  return null;
};

export const buildProfitMarginRows = (
  sales: SaleLike[],
  productCostById: Record<string, number>,
  source: ProfitReportSource,
): { rows: ProfitMarginRow[]; unknownCostCount: number; knownCostRevenue: number } => {
  const productPriceMap = new Map<string, number | null>(
    Object.entries(productCostById).map(([id, price]) => [id, price]),
  );
  const groups = new Map<
    string,
    {
      name: string;
      type: 'product' | 'service';
      quantity: number;
      cost: number;
      revenue: number;
      knownCostRevenue: number;
      costKnown: boolean;
      knownCount: number;
      unknownCount: number;
      catalogProductId: string | null;
      serviceId: string | null;
    }
  >();

  sales.forEach((sale) => {
    const items = getSaleLineItems(sale);
    const revenues = allocateLineRevenues(
      items.map((item) => ({
        price: Number(item.price ?? 0),
        quantity: Number(item.quantity ?? 0),
      })),
      sale.discount,
    );

    items.forEach((item, index) => {
      const type = lineType(item);
      if (!matchesSource(type, source)) return;
      const quantity = Number(item.quantity ?? 0);
      const revenue = revenues[index] ?? 0;
      const resolvedCost = resolveLineItemEffectiveCost(
        {
          id: String(item.id ?? `${type}-${index}`),
          kind: type,
          productId: item.productId ? toId(item.productId) : null,
          catalogProductId: item.catalogProductId ? toId(item.catalogProductId) : null,
          serviceId: item.serviceId ? toId(item.serviceId) : null,
          name: String(item.name ?? ''),
          price: Number(item.price ?? 0),
          quantity,
          costMethod: item.costMethod ?? null,
          recordedMinutes: item.recordedMinutes ?? null,
          fixedCost: item.fixedCost ?? null,
          hourlyCost: item.hourlyCost ?? null,
          directExpenses: item.directExpenses ?? null,
          unitCostOverride: item.unitCostOverride ?? null,
          costSnapshot: item.costSnapshot as CostableSaleLineItem['costSnapshot'],
          auditedCost: item.auditedCost as CostableSaleLineItem['auditedCost'],
        },
        productPriceMap,
      );
      const costKnown = resolvedCost.status === 'known';
      const cost = costKnown ? roundMoney(Number(resolvedCost.totalCost ?? 0)) : 0;
      const key = lineGroupKey(item, type);
      const catalogProductId =
        type === 'product' ? toId(item.catalogProductId) || null : null;
      const serviceId = type === 'service' ? toId(item.serviceId) || null : null;
      const current = groups.get(key);
      if (current) {
        current.quantity += quantity;
        current.cost = roundMoney(current.cost + cost);
        current.revenue = roundMoney(current.revenue + revenue);
        if (costKnown) {
          current.knownCostRevenue = roundMoney(current.knownCostRevenue + revenue);
          current.knownCount += 1;
        } else {
          current.unknownCount += 1;
        }
        current.costKnown = current.costKnown && costKnown;
        if (current.catalogProductId !== catalogProductId) {
          current.catalogProductId = null;
        }
        if (current.serviceId !== serviceId) {
          current.serviceId = null;
        }
        return;
      }
      groups.set(key, {
        name: String(item.name ?? '').trim() || (type === 'service' ? 'Service' : 'Product'),
        type,
        quantity,
        cost,
        revenue,
        knownCostRevenue: costKnown ? revenue : 0,
        costKnown,
        knownCount: costKnown ? 1 : 0,
        unknownCount: costKnown ? 0 : 1,
        catalogProductId,
        serviceId,
      });
    });
  });

  const rows = Array.from(groups.entries())
    .map(([key, row]) => {
      const profit = roundMoney(row.knownCostRevenue - row.cost);
      const marginPct =
        row.costKnown && row.revenue > 0
          ? roundMoney(((row.revenue - row.cost) / row.revenue) * 100)
          : row.knownCostRevenue > 0 && row.unknownCount > 0
            ? roundMoney((profit / row.knownCostRevenue) * 100)
            : null;
      return {
        key,
        name: row.name,
        type: row.type,
        quantity: row.quantity,
        cost: row.cost,
        revenue: row.revenue,
        knownCostRevenue: row.knownCostRevenue,
        profit,
        marginPct,
        costKnown: row.costKnown,
        knownCount: row.knownCount,
        unknownCount: row.unknownCount,
        catalogProductId: row.catalogProductId,
        serviceId: row.serviceId,
      };
    })
    .sort((left, right) => {
      const leftMargin = left.marginPct ?? -Infinity;
      const rightMargin = right.marginPct ?? -Infinity;
      if (rightMargin !== leftMargin) return rightMargin - leftMargin;
      if (right.profit !== left.profit) return right.profit - left.profit;
      return left.name.localeCompare(right.name);
    });

  const unknownCostCount = rows.filter((row) => !row.costKnown).length;
  const knownCostRevenue = roundMoney(
    rows.reduce((sum, row) => sum + row.knownCostRevenue, 0),
  );
  return { rows, unknownCostCount, knownCostRevenue };
};

export const buildProfitCashSummary = (
  transactions: TransactionLike[],
  knownCategorySlugs?: Set<string>,
) => {
  const byCurrency: Record<string, CashBucket> = {};
  const opexByCategory = new Map<string, ProfitCashCategoryRow>();
  const operations: ProfitCashOperation[] = [];

  transactions.forEach((transaction) => {
    if ((transaction.status ?? 'active') === 'cancelled') return;
    if (transaction.isCancellation) return;
    const type = String(transaction.type ?? '') as TransactionType;
    if (type !== 'deposit' && type !== 'withdraw') return;
    const rawCategory = resolveTransactionCategory(transaction);
    if (!rawCategory) return;
    const category = resolveReportedFinanceCategory(
      rawCategory,
      knownCategorySlugs,
    );
    const field = cashFieldForCategory(type, category);
    if (!field) return;
    const amount = roundMoney(Math.max(Number(transaction.amount ?? 0), 0));
    const currency = String(transaction.currency ?? PRIMARY_CURRENCY).toUpperCase();
    byCurrency[currency] = byCurrency[currency] ?? emptyCashBucket();
    addMoney(byCurrency[currency], field, amount);
    if (field === 'opex') {
      const current = opexByCategory.get(category) ?? {
        category,
        amount: 0,
        count: 0,
      };
      current.amount = roundMoney(current.amount + amount);
      current.count += 1;
      opexByCategory.set(category, current);
    }
    operations.push({
      type,
      category,
      amount,
      currency,
      note: String(transaction.note ?? ''),
      transactionDate:
        transaction.transactionDate instanceof Date
          ? transaction.transactionDate.toISOString()
          : String(transaction.transactionDate ?? ''),
    });
  });

  const primary = byCurrency[PRIMARY_CURRENCY] ?? emptyCashBucket();
  const otherCurrencies = Object.keys(byCurrency)
    .filter((code) => code !== PRIMARY_CURRENCY)
    .sort();

  return {
    currency: PRIMARY_CURRENCY,
    collected: primary.collected,
    inventoryPurchases: primary.inventoryPurchases,
    opex: primary.opex,
    refunds: primary.refunds,
    net: primary.net,
    opexByCategory: Array.from(opexByCategory.values()).sort((left, right) =>
      left.category.localeCompare(right.category),
    ),
    otherCurrencies,
    byCurrency,
    operations,
  };
};

const utcRangeForBounds = (bounds: ProfitReportBounds) => {
  if (!bounds.dateFrom && !bounds.dateTo) return undefined;
  const range: { $gte?: Date; $lte?: Date } = {};
  if (bounds.dateFrom) {
    const start = new Date(`${bounds.dateFrom}T00:00:00.000Z`);
    start.setUTCDate(start.getUTCDate() - 1);
    range.$gte = start;
  }
  if (bounds.dateTo) {
    const end = new Date(`${bounds.dateTo}T23:59:59.999Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    range.$lte = end;
  }
  return range;
};

const parseBoolFlag = (value: unknown) =>
  value === true || String(value ?? '').trim().toLowerCase() === 'true' || String(value ?? '').trim() === '1';

const resolvePreviousBounds = (bounds: ProfitReportBounds): ProfitReportBounds | null => {
  if (!bounds.dateFrom || !bounds.dateTo) return null;
  const spanDays = diffCalendarDaysInclusive(bounds.dateFrom, bounds.dateTo);
  return {
    key: 'custom',
    dateFrom: addCalendarDays(bounds.dateFrom, -spanDays),
    dateTo: addCalendarDays(bounds.dateFrom, -1),
  };
};

const summarizeOrderForReport = (
  sale: SaleLike,
  productPriceMap: Map<string, number | null>,
  source: ProfitReportSource,
) => {
  const saleAny = sale as unknown as Record<string, unknown>;
  const items = getSaleLineItems(sale);
  const revenues = allocateLineRevenues(
    items.map((item) => ({
      price: Number(item.price ?? 0),
      quantity: Number(item.quantity ?? 0),
    })),
    sale.discount,
  );

  let revenue = 0;
  let knownCostRevenue = 0;
  let knownCost = 0;
  let knownLines = 0;
  let unknownLines = 0;

  items.forEach((item, idx) => {
    const type = lineType(item);
    if (!matchesSource(type, source)) return;
    const rev = revenues[idx] ?? 0;
    revenue = roundMoney(revenue + rev);
    const eff = resolveLineItemEffectiveCost(
      {
        id: String(item.id ?? `${type}-${idx}`),
        kind: type,
        productId: item.productId ? toId(item.productId) : null,
        catalogProductId: item.catalogProductId ? toId(item.catalogProductId) : null,
        serviceId: item.serviceId ? toId(item.serviceId) : null,
        name: String(item.name ?? ''),
        price: Number(item.price ?? 0),
        quantity: Number(item.quantity ?? 0),
        costMethod: item.costMethod ?? null,
        recordedMinutes: item.recordedMinutes ?? null,
        fixedCost: item.fixedCost ?? null,
        hourlyCost: item.hourlyCost ?? null,
        directExpenses: item.directExpenses ?? null,
        unitCostOverride: item.unitCostOverride ?? null,
        costSnapshot: item.costSnapshot as CostableSaleLineItem['costSnapshot'],
        auditedCost: item.auditedCost as CostableSaleLineItem['auditedCost'],
      },
      productPriceMap,
    );
    if (eff.status === 'known') {
      knownLines += 1;
      knownCostRevenue = roundMoney(knownCostRevenue + rev);
      knownCost = roundMoney(knownCost + Number(eff.totalCost ?? 0));
    } else {
      unknownLines += 1;
    }
  });

  const isIncomplete = unknownLines > 0;
  const knownProfit = roundMoney(knownCostRevenue - knownCost);
  const profit = isIncomplete ? null : roundMoney(revenue - knownCost);
  const marginPct =
    !isIncomplete && revenue > 0 && profit !== null
      ? roundMoney((profit / revenue) * 100)
      : null;
  const isLoss = isIncomplete ? knownProfit < 0 : (profit ?? 0) < 0;

  return {
    id: saleAny._id ? toId(saleAny._id) : '',
    recordNumber: saleAny.recordNumber ? String(saleAny.recordNumber) : null,
    kind: sale.kind === 'sale' ? 'sale' : 'repair',
    status: String(sale.status ?? ''),
    saleDate:
      sale.saleDate instanceof Date
        ? sale.saleDate.toISOString()
        : String(sale.saleDate ?? ''),
    clientName:
      (saleAny.clientSnapshot as { name?: string } | undefined)?.name ?? '',
    revenue,
    knownCostRevenue,
    knownCost,
    knownProfit,
    profit,
    marginPct,
    isIncomplete,
    missingCostCount: unknownLines,
    knownCostCount: knownLines,
    isLoss,
    matchingLineCount: knownLines + unknownLines,
  };
};

const loadProfitReportRawData = async (
  wideBounds: ProfitReportBounds,
) => {
  const dateRange = utcRangeForBounds(wideBounds);
  const saleFilter = dateRange ? { saleDate: dateRange } : {};
  const transactionFilter = dateRange ? { transactionDate: dateRange } : {};

  const [sales, transactions, coldPurged, categoryDocs] = await Promise.all([
    Sale.find(saleFilter)
      .select({
        _id: 1,
        recordNumber: 1,
        saleDate: 1,
        firstStockCommittedAt: 1,
        kind: 1,
        status: 1,
        salePrice: 1,
        quantity: 1,
        discount: 1,
        clientSnapshot: 1,
        'lineItems.id': 1,
        'lineItems.kind': 1,
        'lineItems.name': 1,
        'lineItems.price': 1,
        'lineItems.quantity': 1,
        'lineItems.productId': 1,
        'lineItems.catalogProductId': 1,
        'lineItems.serviceId': 1,
        'lineItems.costMethod': 1,
        'lineItems.recordedMinutes': 1,
        'lineItems.fixedCost': 1,
        'lineItems.hourlyCost': 1,
        'lineItems.directExpenses': 1,
        'lineItems.unitCostOverride': 1,
        'lineItems.costSnapshot': 1,
        'lineItems.auditedCost': 1,
      })
      .lean<SaleLike[]>(),
    FinanceTransaction.find(transactionFilter)
      .select({
        type: 1,
        amount: 1,
        currency: 1,
        note: 1,
        category: 1,
        status: 1,
        isCancellation: 1,
        transactionDate: 1,
      })
      .lean<TransactionLike[]>(),
    coldSalesPurgedExist(),
    FinanceCategory.find().select({ slug: 1 }).lean<Array<{ slug: string }>>(),
  ]);

  const committedAll = sales.filter((sale) => isStockCommittedSale(sale));
  const productIds = Array.from(
    new Set(
      committedAll.flatMap((sale) =>
        getSaleLineItems(sale)
          .filter((item) => lineType(item) === 'product')
          .map((item) => toId(item.productId))
          .filter(Boolean),
      ),
    ),
  );

  const products =
    productIds.length === 0
      ? []
      : await Product.find({ _id: { $in: productIds } })
          .select({ price: 1 })
          .lean<Array<{ _id: { toString(): string }; price?: number }>>();

  const productCostById = products.reduce<Record<string, number>>((acc, product) => {
    acc[product._id.toString()] = Math.max(Number(product.price ?? 0), 0);
    return acc;
  }, {});
  const productPriceMap = new Map<string, number | null>(
    Object.entries(productCostById).map(([id, price]) => [id, price]),
  );

  const knownCategorySlugs = new Set<string>([
    ...financeTransactionCategories,
    ...categoryDocs.map((category) => category.slug),
  ]);

  return {
    committedAll,
    transactions,
    coldPurged,
    knownCategorySlugs,
    productCostById,
    productPriceMap,
  };
};

export const getFinanceProfitReport = async (query: ProfitReportQuery = {}) => {
  const bounds = resolveProfitReportBounds(query);
  const prevBounds = resolvePreviousBounds(bounds);
  const source = parseSource(query.source);
  const lossOnly = parseBoolFlag(query.lossOnly);
  const missingCostOnly = parseBoolFlag(query.missingCostOnly);
  const searchQuery = String(query.q ?? '').trim().toLowerCase();

  const wideBounds: ProfitReportBounds = prevBounds
    ? { key: 'custom', dateFrom: prevBounds.dateFrom, dateTo: bounds.dateTo }
    : bounds;

  const {
    committedAll,
    transactions,
    coldPurged,
    knownCategorySlugs,
    productCostById,
    productPriceMap,
  } = await loadProfitReportRawData(wideBounds);

  const filterSalesByFlags = (candidateSales: SaleLike[]) =>
    candidateSales.filter((sale) => {
      const orderSummary = summarizeOrderForReport(sale, productPriceMap, source);
      if (orderSummary.matchingLineCount === 0) return false;
      if (lossOnly && !orderSummary.isLoss) return false;
      if (missingCostOnly && !orderSummary.isIncomplete) return false;
      if (searchQuery) {
        const hay = `${orderSummary.recordNumber ?? ''} ${orderSummary.clientName} ${getSaleLineItems(sale).map((i) => i.name ?? '').join(' ')}`.toLowerCase();
        if (!hay.includes(searchQuery)) return false;
      }
      return true;
    });

  const scopedSales = filterSalesByFlags(
    committedAll.filter((sale) => isSaleInBounds(sale, bounds)),
  );
  const scopedTransactions = transactions.filter((transaction) =>
    isTransactionInBounds(transaction, bounds),
  );

  const summarizePeriod = (
    salesSubset: SaleLike[],
    txSubset: TransactionLike[],
  ) => {
    const { rows, unknownCostCount, knownCostRevenue } = buildProfitMarginRows(
      salesSubset,
      productCostById,
      source,
    );
    const cash = buildProfitCashSummary(txSubset, knownCategorySlugs);
    const revenue = roundMoney(rows.reduce((sum, row) => sum + row.revenue, 0));
    const cogs = roundMoney(rows.reduce((sum, row) => sum + row.cost, 0));
    const isIncomplete = unknownCostCount > 0;
    const knownCostGrossProfit = roundMoney(knownCostRevenue - cogs);
    const knownCostGrossMarginPct =
      knownCostRevenue > 0
        ? roundMoney((knownCostGrossProfit / knownCostRevenue) * 100)
        : null;
    const costCoveragePct =
      revenue > 0
        ? roundMoney((knownCostRevenue / revenue) * 100)
        : rows.length > 0
          ? roundMoney(((rows.length - unknownCostCount) / rows.length) * 100)
          : 100;
    const grossProfit = isIncomplete ? null : roundMoney(revenue - cogs);
    const grossMarginPct =
      !isIncomplete && revenue > 0 && grossProfit !== null
        ? roundMoney((grossProfit / revenue) * 100)
        : null;

    // Separate internal transfer totals without folding them into external cash flow.
    let transfersVolume = 0;
    let transfersCount = 0;
    txSubset.forEach((tx) => {
      if ((tx.status ?? 'active') === 'cancelled' || tx.isCancellation) return;
      if (String(tx.type ?? '') === 'transfer') {
        const cur = String(tx.currency ?? PRIMARY_CURRENCY).toUpperCase();
        if (cur === PRIMARY_CURRENCY) {
          transfersVolume = roundMoney(
            transfersVolume + Math.max(Number(tx.amount ?? 0), 0),
          );
          transfersCount += 1;
        }
      }
    });

    return {
      rows,
      margin: {
        revenue,
        cogs,
        grossProfit,
        grossMarginPct,
        unknownCostCount,
        isIncomplete,
        knownCostRevenue,
        knownCostCogs: cogs,
        knownCostGrossProfit,
        knownCostGrossMarginPct,
        costCoveragePct,
      },
      cash: {
        collected: cash.collected,
        inventoryPurchases: cash.inventoryPurchases,
        opex: cash.opex,
        refunds: cash.refunds,
        net: cash.net,
        opexByCategory: cash.opexByCategory,
        byCurrency: cash.byCurrency,
        operations: cash.operations,
        transfersVolume,
        transfersCount,
      },
      otherCurrencies: cash.otherCurrencies,
      saleCount: salesSubset.length,
    };
  };

  const currentSummary = summarizePeriod(scopedSales, scopedTransactions);

  let previousComparison: Record<string, unknown> | null = null;
  if (prevBounds) {
    const prevSales = filterSalesByFlags(
      committedAll.filter((sale) => isSaleInBounds(sale, prevBounds)),
    );
    const prevTxs = transactions.filter((transaction) =>
      isTransactionInBounds(transaction, prevBounds),
    );
    const prevSummary = summarizePeriod(prevSales, prevTxs);
    previousComparison = {
      period: prevBounds,
      margin: prevSummary.margin,
      cash: {
        collected: prevSummary.cash.collected,
        inventoryPurchases: prevSummary.cash.inventoryPurchases,
        opex: prevSummary.cash.opex,
        refunds: prevSummary.cash.refunds,
        net: prevSummary.cash.net,
        byCurrency: prevSummary.cash.byCurrency,
      },
      saleCount: prevSummary.saleCount,
    };
  }

  // Daily trend series in Europe/Kiev
  const dailyMap = new Map<
    string,
    {
      revenue: number;
      knownCost: number;
      knownProfit: number;
      cashCollected: number;
      cashOutflows: number;
      cashNet: number;
    }
  >();
  const ensureDay = (dateKey: string) => {
    let day = dailyMap.get(dateKey);
    if (!day) {
      day = {
        revenue: 0,
        knownCost: 0,
        knownProfit: 0,
        cashCollected: 0,
        cashOutflows: 0,
        cashNet: 0,
      };
      dailyMap.set(dateKey, day);
    }
    return day;
  };

  scopedSales.forEach((sale) => {
    const dateKey = getAccountingBusinessDateKey(sale.saleDate ?? '');
    if (!dateKey) return;
    const s = summarizeOrderForReport(sale, productPriceMap, source);
    const day = ensureDay(dateKey);
    day.revenue = roundMoney(day.revenue + s.revenue);
    day.knownCost = roundMoney(day.knownCost + s.knownCost);
    day.knownProfit = roundMoney(day.knownProfit + s.knownProfit);
  });

  scopedTransactions.forEach((tx) => {
    if ((tx.status ?? 'active') === 'cancelled' || tx.isCancellation) return;
    const type = String(tx.type ?? '') as TransactionType;
    if (type !== 'deposit' && type !== 'withdraw') return;
    const cur = String(tx.currency ?? PRIMARY_CURRENCY).toUpperCase();
    if (cur !== PRIMARY_CURRENCY) return;
    const dateKey = getAccountingBusinessDateKey(tx.transactionDate ?? '');
    if (!dateKey) return;
    const amt = Math.max(Number(tx.amount ?? 0), 0);
    const day = ensureDay(dateKey);
    if (type === 'deposit') {
      day.cashCollected = roundMoney(day.cashCollected + amt);
      day.cashNet = roundMoney(day.cashNet + amt);
    } else {
      day.cashOutflows = roundMoney(day.cashOutflows + amt);
      day.cashNet = roundMoney(day.cashNet - amt);
    }
  });

  const trendKeys =
    bounds.dateFrom && bounds.dateTo
      ? listCalendarDateKeys(bounds.dateFrom, bounds.dateTo)
      : Array.from(dailyMap.keys()).sort();
  const trendSeries = trendKeys.map((dateKey) => {
    const d = dailyMap.get(dateKey);
    return {
      dateKey,
      revenue: d?.revenue ?? 0,
      knownCost: d?.knownCost ?? 0,
      knownProfit: d?.knownProfit ?? 0,
      cashCollected: d?.cashCollected ?? 0,
      cashOutflows: d?.cashOutflows ?? 0,
      cashNet: d?.cashNet ?? 0,
    };
  });

  const warnings: string[] = [];
  if (coldPurged) {
    warnings.push(
      'Cold yearly archive purges exist; profitability metrics cover live persisted sales only.',
    );
  }
  if (currentSummary.margin.isIncomplete) {
    warnings.push(
      `${currentSummary.margin.unknownCostCount} SKU group(s) have incomplete cost records; overall gross profit/margin is incomplete.`,
    );
  }

  return {
    period: {
      key: bounds.key,
      dateFrom: bounds.dateFrom,
      dateTo: bounds.dateTo,
      timeZone: 'Europe/Kiev',
    },
    previousPeriod: prevBounds
      ? { dateFrom: prevBounds.dateFrom, dateTo: prevBounds.dateTo }
      : null,
    source,
    currency: PRIMARY_CURRENCY,
    otherCurrencies: currentSummary.otherCurrencies,
    margin: currentSummary.margin,
    cash: currentSummary.cash,
    rows: currentSummary.rows,
    trendSeries,
    previousComparison,
    dataScope: 'live_sales_only' as const,
    coldSalesPurgedExist: coldPurged,
    saleCount: currentSummary.saleCount,
    coverage: {
      coldSalesPurgedExist: coldPurged,
      isProfitIncomplete: currentSummary.margin.isIncomplete,
      warnings,
    },
  };
};

export const getFinanceProfitReportDetails = async (
  query: ProfitReportQuery = {},
) => {
  const bounds = resolveProfitReportBounds(query);
  const source = parseSource(query.source);
  const lossOnly = parseBoolFlag(query.lossOnly);
  const missingCostOnly = parseBoolFlag(query.missingCostOnly);
  const searchQuery = String(query.q ?? '').trim().toLowerCase();

  const { committedAll, productPriceMap } = await loadProfitReportRawData(bounds);

  const records = committedAll
    .filter((sale) => isSaleInBounds(sale, bounds))
    .map((sale) => summarizeOrderForReport(sale, productPriceMap, source))
    .filter((row) => {
      if (row.matchingLineCount === 0) return false;
      if (lossOnly && !row.isLoss) return false;
      if (missingCostOnly && !row.isIncomplete) return false;
      if (searchQuery) {
        const hay = `${row.recordNumber ?? ''} ${row.clientName}`.toLowerCase();
        if (!hay.includes(searchQuery)) return false;
      }
      return true;
    });

  const sortBy = String(query.sortBy ?? 'saleDate').trim();
  const sortDir = String(query.sortDir ?? 'desc').trim().toLowerCase() === 'asc' ? 1 : -1;
  records.sort((a, b) => {
    if (sortBy === 'revenue') return (a.revenue - b.revenue) * sortDir;
    if (sortBy === 'knownCost') return (a.knownCost - b.knownCost) * sortDir;
    if (sortBy === 'profit') return (a.knownProfit - b.knownProfit) * sortDir;
    return a.saleDate.localeCompare(b.saleDate) * sortDir;
  });

  const page = Math.max(1, Math.min(Number(query.page) || 1, 10000));
  const pageSize = Math.max(1, Math.min(Number(query.pageSize) || 25, 200));
  const skip = (page - 1) * pageSize;

  return {
    items: records.slice(skip, skip + pageSize),
    total: records.length,
    page,
    pageSize,
    totals: {
      revenue: roundMoney(records.reduce((s, r) => s + r.revenue, 0)),
      knownCost: roundMoney(records.reduce((s, r) => s + r.knownCost, 0)),
      knownProfit: roundMoney(records.reduce((s, r) => s + r.knownProfit, 0)),
      missingCostRecordsCount: records.filter((r) => r.isIncomplete).length,
      lossRecordsCount: records.filter((r) => r.isLoss).length,
    },
  };
};

export type FinanceProfitReport = Awaited<ReturnType<typeof getFinanceProfitReport>>;
