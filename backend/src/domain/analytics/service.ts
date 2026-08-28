import { coldSalesPurgedExist } from '../archive/yearly-dump';
import { Product } from '../product/model';
import { Sale, type SaleDocument } from '../sale/model';
import { getSaleDocumentTotal } from '../../shared/lib/saleTotals';
import {
  getCashSplit,
  getConsecutivePreviousBounds,
  getDeltaPct,
  getRepairFunnel,
  getTopLineItems,
  isDateInBounds,
} from './aggregates';

export const analyticsPeriods = [
  'whole',
  'today',
  'currentMonth',
  'lastMonth',
  'currentYear',
  'lastYear',
] as const;
export type AnalyticsPeriod = (typeof analyticsPeriods)[number];

export type AnalyticsQuery = {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
};

type ChartSnapshot = {
  year: number;
  label: string;
  detailLabel: string;
  values: number[];
  total: number;
  color: string;
};

type LeanSale = Pick<
  SaleDocument,
  | 'saleDate'
  | 'kind'
  | 'status'
  | 'paidAmount'
  | 'salePrice'
  | 'quantity'
  | 'lineItems'
  | 'discount'
  | 'isRapidSale'
  | 'paymentHistory'
>;

const comparisonColors = ['#2d8ae3', '#f97316', '#14b8a6'] as const;
const finalRepairStatuses = new Set([
  'issued',
  'issuedWithoutRepair',
  'clientRejected',
  'notPickedUp',
]);
const finalSaleStatuses = new Set(['issued', 'paid', 'returned']);

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const parsePeriod = (value: unknown): AnalyticsPeriod => {
  const normalized = String(value ?? 'today').trim();
  return analyticsPeriods.includes(normalized as AnalyticsPeriod)
    ? (normalized as AnalyticsPeriod)
    : 'today';
};

const parseDateKey = (value: unknown) => {
  const text = String(value ?? '').trim();
  return DATE_KEY.test(text) ? text : undefined;
};

const getPaidAmount = (sale: LeanSale) => Math.max(Number(sale.paidAmount ?? 0), 0);
const isFinalRecord = (sale: { kind?: string; status?: string }) => {
  const status = String(sale.status ?? '');
  return sale.kind === 'sale'
    ? finalSaleStatuses.has(status)
    : finalRepairStatuses.has(status);
};
const getDateKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

const toIsoDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

type PeriodConfig = {
  unit: 'hour' | 'day' | 'month';
  baseYear: number;
  month: number;
  day: number;
  detailLabel: string;
  axisLabels: string[];
};

const monthShort = (year: number, monthIndex: number) =>
  new Date(year, monthIndex, 1).toLocaleDateString('en-US', { month: 'short' });

const getPeriodConfig = (period: AnalyticsPeriod, currentDate: Date): PeriodConfig => {
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const currentDay = currentDate.getDate();

  if (period === 'today') {
    return {
      unit: 'hour',
      baseYear: currentYear,
      month: currentMonth,
      day: currentDay,
      detailLabel: currentDate.toISOString().slice(0, 10),
      axisLabels: Array.from({ length: 24 }, (_, index) =>
        index % 3 === 0 ? `${String(index).padStart(2, '0')}:00` : '',
      ),
    };
  }

  if (period === 'currentMonth' || period === 'lastMonth') {
    const monthDate =
      period === 'currentMonth'
        ? new Date(currentYear, currentMonth, 1)
        : new Date(currentYear, currentMonth - 1, 1);
    const daysInMonth = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + 1,
      0,
    ).getDate();
    return {
      unit: 'day',
      baseYear: monthDate.getFullYear(),
      month: monthDate.getMonth(),
      day: currentDay,
      detailLabel: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`,
      axisLabels: Array.from({ length: daysInMonth }, (_, index) =>
        index % 2 === 0 ? String(index + 1) : '',
      ),
    };
  }

  const baseYear = period === 'currentYear' ? currentYear : currentYear - 1;
  return {
    unit: 'month',
    baseYear,
    month: currentMonth,
    day: currentDay,
    detailLabel: String(baseYear),
    axisLabels: Array.from({ length: 12 }, (_, index) => monthShort(baseYear, index)),
  };
};

const matchesPeriod = (date: Date, config: PeriodConfig, year: number) => {
  if (config.unit === 'hour') {
    return (
      date.getFullYear() === year &&
      date.getMonth() === config.month &&
      date.getDate() === config.day
    );
  }
  if (config.unit === 'day') {
    return date.getFullYear() === year && date.getMonth() === config.month;
  }
  return date.getFullYear() === year;
};

const getBucketIndex = (date: Date, config: PeriodConfig) => {
  if (config.unit === 'hour') return date.getHours();
  if (config.unit === 'day') return date.getDate() - 1;
  return date.getMonth();
};

const getBucketCount = (config: PeriodConfig, year: number) => {
  if (config.unit === 'hour') return 24;
  if (config.unit === 'day') return new Date(year, config.month + 1, 0).getDate();
  return 12;
};

const buildSnapshot = (
  records: LeanSale[],
  config: PeriodConfig,
  yearsBack: number,
  color: string,
  getValue: (sale: LeanSale) => number,
): ChartSnapshot => {
  const year = config.baseYear - yearsBack;
  const values = Array.from({ length: getBucketCount(config, year) }, () => 0);
  records.forEach((record) => {
    const recordDate = new Date(record.saleDate);
    if (!matchesPeriod(recordDate, config, year)) return;
    const bucket = getBucketIndex(recordDate, config);
    values[bucket] = (values[bucket] ?? 0) + getValue(record);
  });
  return {
    year,
    label: String(year),
    detailLabel: config.unit === 'month' ? String(year) : config.detailLabel,
    values,
    total: values.reduce((sum, value) => sum + value, 0),
    color,
  };
};

const buildYearlySnapshot = (
  records: LeanSale[],
  years: number[],
  color: string,
  label: string,
  getValue: (sale: LeanSale) => number,
  detailLabel: string,
): ChartSnapshot => {
  const values = Array.from({ length: years.length }, () => 0);
  records.forEach((record) => {
    const year = new Date(record.saleDate).getFullYear();
    const index = years.indexOf(year);
    if (index < 0) return;
    values[index] = (values[index] ?? 0) + getValue(record);
  });
  return {
    year: years[years.length - 1] ?? new Date().getFullYear(),
    label,
    detailLabel,
    values,
    total: values.reduce((sum, value) => sum + value, 0),
    color,
  };
};

const isSaleInRange = (saleDate: Date, dateFrom?: string, dateTo?: string) => {
  if (dateFrom) {
    const start = new Date(`${dateFrom}T00:00:00.000`);
    if (saleDate < start) return false;
  }
  if (dateTo) {
    const end = new Date(`${dateTo}T23:59:59.999`);
    if (saleDate > end) return false;
  }
  return true;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const buildCustomRangeConfig = (dateFrom: string | undefined, dateTo: string | undefined, now: Date) => {
  const fromKey = dateFrom ?? toIsoDateKey(now);
  const toKey = dateTo ?? toIsoDateKey(now);
  const from = new Date(`${fromKey}T12:00:00`);
  const to = new Date(`${toKey}T12:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const daySpan = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  const detailLabel =
    fromKey === toKey ? fromKey : `${toIsoDateKey(start)} – ${toIsoDateKey(end)}`;

  if (daySpan <= 1) {
    const dayKey = toIsoDateKey(start);
    return {
      unit: 'hour' as const,
      detailLabel,
      bucketKeys: Array.from(
        { length: 24 },
        (_, hour) => `${dayKey}T${String(hour).padStart(2, '0')}`,
      ),
      axisLabels: Array.from({ length: 24 }, (_, index) =>
        index % 3 === 0 ? `${String(index).padStart(2, '0')}:00` : '',
      ),
    };
  }

  if (daySpan <= 62) {
    const bucketKeys: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      bucketKeys.push(toIsoDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return {
      unit: 'day' as const,
      detailLabel,
      bucketKeys,
      axisLabels: bucketKeys.map((key, index) => (index % 2 === 0 ? key.slice(5) : '')),
    };
  }

  const monthKeys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= endMonth) {
    monthKeys.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return {
    unit: 'month' as const,
    detailLabel,
    bucketKeys: monthKeys,
    axisLabels: monthKeys.map((key) => {
      const [yearText, monthText] = key.split('-');
      const year = Number(yearText);
      const month = Number(monthText);
      return monthShort(year, month - 1);
    }),
  };
};

const getCustomBucketIndex = (
  saleDate: Date,
  config: NonNullable<ReturnType<typeof buildCustomRangeConfig>>,
) => {
  if (config.unit === 'hour') {
    const dayKey = toIsoDateKey(saleDate);
    const hour = saleDate.getHours();
    return config.bucketKeys.findIndex(
      (key) => key === `${dayKey}T${String(hour).padStart(2, '0')}`,
    );
  }
  if (config.unit === 'day') {
    return config.bucketKeys.findIndex((key) => key === toIsoDateKey(saleDate));
  }
  const monthKey = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
  return config.bucketKeys.findIndex((key) => key === monthKey);
};

const buildCustomSnapshot = (
  records: LeanSale[],
  config: NonNullable<ReturnType<typeof buildCustomRangeConfig>>,
  color: string,
  label: string,
  getValue: (sale: LeanSale) => number,
): ChartSnapshot => {
  const values = Array.from({ length: config.bucketKeys.length }, () => 0);
  records.forEach((record) => {
    const index = getCustomBucketIndex(new Date(record.saleDate), config);
    if (index < 0) return;
    values[index] = (values[index] ?? 0) + getValue(record);
  });
  return {
    year: new Date().getFullYear(),
    label,
    detailLabel: config.detailLabel,
    values,
    total: values.reduce((sum, value) => sum + value, 0),
    color,
  };
};

const addSnapshots = (left: ChartSnapshot[], right: ChartSnapshot[]): ChartSnapshot[] =>
  left.map((snapshot, index) => {
    const other = right[index];
    const values = snapshot.values.map(
      (value, bucket) => value + (other?.values[bucket] ?? 0),
    );
    return {
      ...snapshot,
      values,
      total: values.reduce((sum, value) => sum + value, 0),
    };
  });

const loadLeanSales = async () =>
  Sale.find()
    .select({
      saleDate: 1,
      kind: 1,
      status: 1,
      paidAmount: 1,
      salePrice: 1,
      quantity: 1,
      isRapidSale: 1,
      'lineItems.price': 1,
      'lineItems.quantity': 1,
      'lineItems.kind': 1,
      'lineItems.name': 1,
      'lineItems.productId': 1,
      'lineItems.serviceId': 1,
      discount: 1,
      'paymentHistory.type': 1,
      'paymentHistory.paymentMethod': 1,
      'paymentHistory.amount': 1,
    })
    .lean<LeanSale[]>();

const loadStockMetrics = async () => {
  const products = await Product.find({ isActive: true })
    .select({ quantity: 1, reservedQuantity: 1, price: 1 })
    .lean<Array<{ quantity: number; reservedQuantity: number; price: number }>>();

  let totalStock = 0;
  let freeStock = 0;
  let reservedStock = 0;
  let stockValue = 0;
  let outOfStockProducts = 0;
  let lowStockProducts = 0;

  products.forEach((product) => {
    const quantity = Math.max(product.quantity ?? 0, 0);
    const reserved = Math.max(product.reservedQuantity ?? 0, 0);
    const free = Math.max(quantity - reserved, 0);
    totalStock += quantity;
    freeStock += free;
    reservedStock += reserved;
    stockValue += Math.max(product.price ?? 0, 0) * quantity;
    if (free <= 0) outOfStockProducts += 1;
    else if (free <= 2) lowStockProducts += 1;
  });

  return {
    productCount: products.length,
    totalStock,
    freeStock,
    reservedStock,
    stockValue,
    outOfStockProducts,
    lowStockProducts,
  };
};

const sumTotals = (records: LeanSale[]) =>
  records.reduce((sum, sale) => sum + getSaleDocumentTotal(sale as SaleDocument), 0);

const sumPaid = (records: LeanSale[]) =>
  records.reduce((sum, sale) => sum + getPaidAmount(sale), 0);

const buildResult = (
  productSales: LeanSale[],
  repairOrders: LeanSale[],
  selectedSales: LeanSale[],
  selectedOrders: LeanSale[],
  previousSales: LeanSale[],
  previousOrders: LeanSale[],
  revenueSnapshots: ChartSnapshot[],
  productRevenueSnapshots: ChartSnapshot[],
  repairRevenueSnapshots: ChartSnapshot[],
  orderSnapshots: ChartSnapshot[],
  salesCountSnapshots: ChartSnapshot[],
  detailLabel: string,
  axisLabels: string[],
  stock: Awaited<ReturnType<typeof loadStockMetrics>>,
  currentDate: Date,
) => {
  const currentOrders = orderSnapshots[0]!;
  const currentSalesCount = salesCountSnapshots[0]!;
  const selectedRecords = [...selectedSales, ...selectedOrders];
  const productRevenue = productRevenueSnapshots[0]?.total ?? sumTotals(selectedSales);
  const repairRevenue = repairRevenueSnapshots[0]?.total ?? sumTotals(selectedOrders);
  const billed = productRevenue + repairRevenue;
  const salesCount = currentSalesCount.total;
  const ordersCount = currentOrders.total;
  const productAverageTicket = salesCount > 0 ? productRevenue / salesCount : 0;
  const repairAverageTicket = ordersCount > 0 ? repairRevenue / ordersCount : 0;
  const documentCount = salesCount + ordersCount;
  const averageTicket = documentCount > 0 ? billed / documentCount : 0;
  const paidAmount = sumPaid(selectedRecords);
  const remainingAmount = Math.max(billed - paidAmount, 0);
  const paymentCoverage = billed > 0 ? (paidAmount / billed) * 100 : 0;
  const openRepairs = repairOrders.filter((sale) => !isFinalRecord(sale));
  const openOrders = openRepairs.length;
  const closedOrders = selectedOrders.filter((sale) => isFinalRecord(sale)).length;
  const readyCount = openRepairs.filter((sale) => sale.status === 'ready').length;
  const waitingPartsCount = openRepairs.filter((sale) => sale.status === 'waitingParts').length;
  const inProgressCount = Math.max(openOrders - readyCount - waitingPartsCount, 0);
  const unpaidOrders = selectedRecords.filter(
    (sale) => getSaleDocumentTotal(sale as SaleDocument) > getPaidAmount(sale),
  ).length;
  const unpaidAmount = selectedRecords.reduce((sum, sale) => {
    const total = getSaleDocumentTotal(sale as SaleDocument);
    return sum + Math.max(total - getPaidAmount(sale), 0);
  }, 0);
  const todayKey = getDateKey(currentDate);
  const todaySales = productSales.filter(
    (sale) => getDateKey(new Date(sale.saleDate)) === todayKey,
  );
  const todayOrders = repairOrders.filter(
    (sale) => getDateKey(new Date(sale.saleDate)) === todayKey,
  );
  const todayRevenue =
    sumTotals(todaySales) + sumTotals(todayOrders);
  const previousBilled = sumTotals(previousSales) + sumTotals(previousOrders);
  const previousCollected = sumPaid([...previousSales, ...previousOrders]);
  const hasPrevious = previousSales.length + previousOrders.length > 0 || previousBilled > 0;
  const cashSplit = getCashSplit(selectedRecords);
  const mixProductPct = billed > 0 ? (productRevenue / billed) * 100 : 0;
  const mixRepairPct = billed > 0 ? (repairRevenue / billed) * 100 : 0;

  return {
    detailLabel,
    axisLabels,
    revenueSnapshots,
    productRevenueSnapshots,
    repairRevenueSnapshots,
    orderSnapshots,
    salesCountSnapshots,
    revenueChartMax: Math.max(
      1,
      ...revenueSnapshots.flatMap((snapshot) => snapshot.values),
      ...productRevenueSnapshots.flatMap((snapshot) => snapshot.values),
      ...repairRevenueSnapshots.flatMap((snapshot) => snapshot.values),
    ),
    ordersChartMax: Math.max(
      1,
      ...orderSnapshots.flatMap((snapshot) => snapshot.values),
      ...salesCountSnapshots.flatMap((snapshot) => snapshot.values),
    ),
    hasRevenueData: billed > 0 || revenueSnapshots.some((snapshot) => snapshot.total > 0),
    hasOrdersData: orderSnapshots.some((snapshot) => snapshot.total > 0),
    metrics: {
      salesCount,
      ordersCount,
      revenue: billed,
      billed,
      productRevenue,
      repairRevenue,
      averageTicket,
      productAverageTicket,
      repairAverageTicket,
      paidAmount,
      remainingAmount,
      paymentCoverage,
      openOrders,
      closedOrders,
      unpaidOrders,
      unpaidAmount,
      readyCount,
      waitingPartsCount,
      inProgressCount,
      rapidSaleCount: selectedSales.filter((sale) => Boolean(sale.isRapidSale)).length,
      returnedCount: selectedRecords.filter((sale) => sale.status === 'returned').length,
      mixProductPct,
      mixRepairPct,
      cashCollected: cashSplit.cashCollected,
      nonCashCollected: cashSplit.nonCashCollected,
      unspecifiedCollected: cashSplit.unspecifiedCollected,
      previous: hasPrevious
        ? {
            billed: previousBilled,
            collected: previousCollected,
            salesCount: previousSales.length,
            ordersCount: previousOrders.length,
          }
        : null,
      deltas: hasPrevious
        ? {
            billedPct: getDeltaPct(billed, previousBilled),
            collectedPct: getDeltaPct(paidAmount, previousCollected),
            salesPct: getDeltaPct(salesCount, previousSales.length),
            ordersPct: getDeltaPct(ordersCount, previousOrders.length),
          }
        : null,
      todaySales: todaySales.length,
      todayOrders: todayOrders.length,
      todayRevenue,
    },
    funnel: getRepairFunnel(repairOrders, isFinalRecord),
    topLineItems: getTopLineItems(selectedRecords),
    stock,
    generatedAt: currentDate.toISOString(),
  };
};

const withAnalyticsMeta = async <T extends Record<string, unknown>>(result: T) => {
  const coldPurged = await coldSalesPurgedExist();
  return {
    ...result,
    dataScope: 'live_sales_only' as const,
    coldSalesPurgedExist: coldPurged,
  };
};

const previousRecords = (
  records: LeanSale[],
  bounds: ReturnType<typeof getConsecutivePreviousBounds>,
) => (bounds ? records.filter((sale) => isDateInBounds(new Date(sale.saleDate), bounds)) : []);

export const getDashboardAnalytics = async (query: AnalyticsQuery = {}) => {
  const currentDate = new Date();
  const period = parsePeriod(query.period);
  const dateFrom = parseDateKey(query.dateFrom);
  const dateTo = parseDateKey(query.dateTo);
  const [rows, stock] = await Promise.all([loadLeanSales(), loadStockMetrics()]);
  const productSales = rows.filter((row) => row.kind === 'sale');
  const repairOrders = rows.filter((row) => row.kind !== 'sale');
  const previousBounds = getConsecutivePreviousBounds(period, currentDate, dateFrom, dateTo);
  const previousSales = previousRecords(productSales, previousBounds);
  const previousOrders = previousRecords(repairOrders, previousBounds);
  const saleTotal = (sale: LeanSale) => getSaleDocumentTotal(sale as SaleDocument);

  if (dateFrom || dateTo) {
    const config = buildCustomRangeConfig(dateFrom, dateTo, currentDate);
    const filteredSales = productSales.filter((sale) =>
      isSaleInRange(new Date(sale.saleDate), dateFrom, dateTo),
    );
    const filteredOrders = repairOrders.filter((sale) =>
      isSaleInRange(new Date(sale.saleDate), dateFrom, dateTo),
    );
    if (!config) {
      const todayConfig = getPeriodConfig('today', currentDate);
      const productRevenueSnapshots = [
        buildSnapshot(filteredSales, todayConfig, 0, comparisonColors[0], saleTotal),
      ];
      const repairRevenueSnapshots = [
        buildSnapshot(filteredOrders, todayConfig, 0, comparisonColors[1], saleTotal),
      ];
      return withAnalyticsMeta(
        buildResult(
          productSales,
          repairOrders,
          filteredSales,
          filteredOrders,
          previousSales,
          previousOrders,
          addSnapshots(productRevenueSnapshots, repairRevenueSnapshots),
          productRevenueSnapshots,
          repairRevenueSnapshots,
          [buildSnapshot(filteredOrders, todayConfig, 0, comparisonColors[0], () => 1)],
          [buildSnapshot(filteredSales, todayConfig, 0, comparisonColors[0], () => 1)],
          todayConfig.detailLabel,
          todayConfig.axisLabels,
          stock,
          currentDate,
        ),
      );
    }
    const productRevenueSnapshots = [
      buildCustomSnapshot(filteredSales, config, comparisonColors[0], 'current', saleTotal),
    ];
    const repairRevenueSnapshots = [
      buildCustomSnapshot(filteredOrders, config, comparisonColors[1], 'current', saleTotal),
    ];
    return withAnalyticsMeta(
      buildResult(
        productSales,
        repairOrders,
        filteredSales,
        filteredOrders,
        previousSales,
        previousOrders,
        addSnapshots(productRevenueSnapshots, repairRevenueSnapshots),
        productRevenueSnapshots,
        repairRevenueSnapshots,
        [buildCustomSnapshot(filteredOrders, config, comparisonColors[0], 'current', () => 1)],
        [buildCustomSnapshot(filteredSales, config, comparisonColors[0], 'current', () => 1)],
        config.detailLabel,
        config.axisLabels,
        stock,
        currentDate,
      ),
    );
  }

  if (period === 'whole') {
    const years = new Set<number>([currentDate.getFullYear()]);
    rows.forEach((record) => {
      const year = new Date(record.saleDate).getFullYear();
      if (!Number.isNaN(year)) years.add(year);
    });
    const sortedYears = [...years].sort((a, b) => a - b);
    const detailLabel = 'whole';
    const axisLabels = sortedYears.map(String);
    const productRevenueSnapshots = [
      buildYearlySnapshot(productSales, sortedYears, comparisonColors[0], 'current', saleTotal, detailLabel),
    ];
    const repairRevenueSnapshots = [
      buildYearlySnapshot(repairOrders, sortedYears, comparisonColors[1], 'current', saleTotal, detailLabel),
    ];
    return withAnalyticsMeta(
      buildResult(
        productSales,
        repairOrders,
        productSales,
        repairOrders,
        previousSales,
        previousOrders,
        addSnapshots(productRevenueSnapshots, repairRevenueSnapshots),
        productRevenueSnapshots,
        repairRevenueSnapshots,
        [
          buildYearlySnapshot(
            repairOrders,
            sortedYears,
            comparisonColors[0],
            'current',
            () => 1,
            detailLabel,
          ),
        ],
        [
          buildYearlySnapshot(
            productSales,
            sortedYears,
            comparisonColors[0],
            'current',
            () => 1,
            detailLabel,
          ),
        ],
        detailLabel,
        axisLabels,
        stock,
        currentDate,
      ),
    );
  }

  const config = getPeriodConfig(period, currentDate);
  const productRevenueSnapshots = comparisonColors.map((color, index) =>
    buildSnapshot(productSales, config, index, color, saleTotal),
  );
  const repairRevenueSnapshots = comparisonColors.map((color, index) =>
    buildSnapshot(repairOrders, config, index, color, saleTotal),
  );
  const revenueSnapshots = addSnapshots(productRevenueSnapshots, repairRevenueSnapshots);
  const orderSnapshots = comparisonColors.map((color, index) =>
    buildSnapshot(repairOrders, config, index, color, () => 1),
  );
  const salesCountSnapshots = comparisonColors.map((color, index) =>
    buildSnapshot(productSales, config, index, color, () => 1),
  );
  const currentRevenue = revenueSnapshots[0]!;
  const selectedSales = productSales.filter((sale) =>
    matchesPeriod(new Date(sale.saleDate), config, currentRevenue.year),
  );
  const selectedOrders = repairOrders.filter((sale) =>
    matchesPeriod(new Date(sale.saleDate), config, currentRevenue.year),
  );

  return withAnalyticsMeta(
    buildResult(
      productSales,
      repairOrders,
      selectedSales,
      selectedOrders,
      previousSales,
      previousOrders,
      revenueSnapshots,
      productRevenueSnapshots,
      repairRevenueSnapshots,
      orderSnapshots,
      salesCountSnapshots,
      config.detailLabel,
      config.axisLabels,
      stock,
      currentDate,
    ),
  );
};
