import { coldSalesPurgedExist } from '../archive/yearly-dump';
import { Product } from '../product/model';
import { Sale } from '../sale/model';
import { getAccountingBusinessDateKey } from './internal';
import {
  inferFinanceTransactionCategory,
  isFinanceTransactionCategory,
  type FinanceTransactionCategory,
} from './categories';
import { FinanceTransaction, type TransactionType } from './model';

export const profitReportPeriods = [
  'whole',
  'day',
  'week',
  'month',
  'year',
] as const;
export type ProfitReportPeriod = (typeof profitReportPeriods)[number];

export const profitReportSources = ['all', 'sales', 'services'] as const;
export type ProfitReportSource = (typeof profitReportSources)[number];

export type ProfitReportQuery = {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  source?: string;
};

export type ProfitReportBounds = {
  key: ProfitReportPeriod | 'custom';
  dateFrom: string | null;
  dateTo: string | null;
};

type LineItemLike = {
  kind?: string;
  name?: string;
  price?: number;
  quantity?: number;
  productId?: unknown;
  catalogProductId?: unknown;
  serviceId?: unknown;
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
  profit: number;
  marginPct: number | null;
  costKnown: boolean;
  catalogProductId: string | null;
  serviceId: string | null;
};

export type ProfitCashCategoryRow = {
  category: FinanceTransactionCategory;
  amount: number;
  count: number;
};

export type ProfitCashOperation = {
  type: TransactionType;
  category: FinanceTransactionCategory;
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
): FinanceTransactionCategory | undefined => {
  const type = String(transaction.type ?? '') as TransactionType;
  if (type !== 'deposit' && type !== 'withdraw' && type !== 'transfer') {
    return undefined;
  }
  if (isFinanceTransactionCategory(transaction.category)) {
    return transaction.category;
  }
  return inferFinanceTransactionCategory(type, String(transaction.note ?? ''));
};

const cashFieldForCategory = (
  type: string,
  category: FinanceTransactionCategory,
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
): { rows: ProfitMarginRow[]; unknownCostCount: number } => {
  const groups = new Map<
    string,
    {
      name: string;
      type: 'product' | 'service';
      quantity: number;
      cost: number;
      revenue: number;
      costKnown: boolean;
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
      const productId = toId(item.productId);
      const hasProduct = Boolean(productId);
      const costKnown =
        type === 'service' || !hasProduct || productId in productCostById;
      const unitCost =
        type === 'service'
          ? 0
          : hasProduct
            ? (productCostById[productId] ?? 0)
            : 0;
      const cost = roundMoney(unitCost * Math.max(quantity, 0));
      const key = lineGroupKey(item, type);
      const catalogProductId =
        type === 'product' ? toId(item.catalogProductId) || null : null;
      const serviceId = type === 'service' ? toId(item.serviceId) || null : null;
      const current = groups.get(key);
      if (current) {
        current.quantity += quantity;
        current.cost = roundMoney(current.cost + cost);
        current.revenue = roundMoney(current.revenue + revenue);
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
        costKnown,
        catalogProductId,
        serviceId,
      });
    });
  });

  const rows = Array.from(groups.entries())
    .map(([key, row]) => {
      const profit = roundMoney(row.revenue - row.cost);
      const marginPct =
        row.costKnown && row.revenue > 0
          ? roundMoney((profit / row.revenue) * 100)
          : null;
      return {
        key,
        name: row.name,
        type: row.type,
        quantity: row.quantity,
        cost: row.cost,
        revenue: row.revenue,
        profit,
        marginPct,
        costKnown: row.costKnown,
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
  return { rows, unknownCostCount };
};

export const buildProfitCashSummary = (transactions: TransactionLike[]) => {
  const byCurrency: Record<string, CashBucket> = {};
  const opexByCategory = new Map<string, ProfitCashCategoryRow>();
  const operations: ProfitCashOperation[] = [];

  transactions.forEach((transaction) => {
    if ((transaction.status ?? 'active') === 'cancelled') return;
    if (transaction.isCancellation) return;
    const type = String(transaction.type ?? '') as TransactionType;
    if (type !== 'deposit' && type !== 'withdraw') return;
    const category = resolveTransactionCategory(transaction);
    if (!category) return;
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

export const getFinanceProfitReport = async (query: ProfitReportQuery = {}) => {
  const bounds = resolveProfitReportBounds(query);
  const source = parseSource(query.source);
  const dateRange = utcRangeForBounds(bounds);

  const saleFilter = dateRange ? { saleDate: dateRange } : {};
  const transactionFilter = dateRange ? { transactionDate: dateRange } : {};

  const [sales, transactions, coldPurged] = await Promise.all([
    Sale.find(saleFilter)
      .select({
        saleDate: 1,
        kind: 1,
        status: 1,
        salePrice: 1,
        quantity: 1,
        discount: 1,
        'lineItems.kind': 1,
        'lineItems.name': 1,
        'lineItems.price': 1,
        'lineItems.quantity': 1,
        'lineItems.productId': 1,
        'lineItems.catalogProductId': 1,
        'lineItems.serviceId': 1,
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
  ]);

  const scopedSales = sales.filter(
    (sale) => isStockCommittedSale(sale) && isSaleInBounds(sale, bounds),
  );
  const scopedTransactions = transactions.filter((transaction) =>
    isTransactionInBounds(transaction, bounds),
  );

  const productIds = Array.from(
    new Set(
      scopedSales.flatMap((sale) =>
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

  const { rows, unknownCostCount } = buildProfitMarginRows(
    scopedSales,
    productCostById,
    source,
  );
  const cash = buildProfitCashSummary(scopedTransactions);
  const revenue = roundMoney(rows.reduce((sum, row) => sum + row.revenue, 0));
  const cogs = roundMoney(rows.reduce((sum, row) => sum + row.cost, 0));
  const grossProfit = roundMoney(revenue - cogs);
  const grossMarginPct = revenue > 0 ? roundMoney((grossProfit / revenue) * 100) : null;

  return {
    period: {
      key: bounds.key,
      dateFrom: bounds.dateFrom,
      dateTo: bounds.dateTo,
      timeZone: 'Europe/Kiev',
    },
    source,
    currency: PRIMARY_CURRENCY,
    otherCurrencies: cash.otherCurrencies,
    margin: {
      revenue,
      cogs,
      grossProfit,
      grossMarginPct,
      unknownCostCount,
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
    },
    rows,
    dataScope: 'live_sales_only' as const,
    coldSalesPurgedExist: coldPurged,
    saleCount: scopedSales.length,
  };
};

export type FinanceProfitReport = Awaited<ReturnType<typeof getFinanceProfitReport>>;
