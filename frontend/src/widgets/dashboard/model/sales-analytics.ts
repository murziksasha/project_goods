import type { Product } from '../../../entities/product/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import i18n from '../../../shared/i18n/config';
import {
  formatAnalyticsDateRangeLabel,
  isSaleInAnalyticsDateRange,
  type AnalyticsDateRange,
} from './analytics-date-range';
import type { StatsPeriod } from './stats-period';

export type { StatsPeriod } from './stats-period';
export { getStatsPeriodDateRange, statsPeriodOptions } from './stats-period';

type ChartSnapshot = {
  year: number;
  label: string;
  detailLabel: string;
  values: number[];
  total: number;
  color: string;
};

type PeriodConfig = {
  unit: 'hour' | 'day' | 'month';
  baseYear: number;
  month: number;
  day: number;
  detailLabel: string;
  axisLabels: string[];
};

const comparisonColors = ['#2d8ae3', '#f97316', '#14b8a6'] as const;
const finalStatuses = new Set(['issued', 'issuedWithoutRepair', 'paid', 'returned', 'clientRejected']);

const getDateLocale = () => (i18n.language?.startsWith('uk') ? 'uk-UA' : 'en-US');

const metricFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const compactMetricFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const currencyFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const getMonthFormatter = () =>
  new Intl.DateTimeFormat(getDateLocale(), { month: 'short' });

const getLineItemsTotal = (sale: Sale) =>
  Array.isArray(sale.lineItems) && sale.lineItems.length > 0
    ? sale.lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    : sale.salePrice * sale.quantity;

export const getSaleTotal = (sale: Sale) => {
  const baseTotal = getLineItemsTotal(sale);
  const discount = sale.discount;

  if (!discount || discount.value <= 0) return baseTotal;

  if (discount.mode === 'percent') {
    return Math.max(baseTotal - (baseTotal * Math.min(discount.value, 100)) / 100, 0);
  }

  return Math.max(baseTotal - discount.value, 0);
};

const getPaidAmount = (sale: Sale) => Math.max(Number(sale.paidAmount ?? 0), 0);

const isFinalRecord = (sale: Sale) => finalStatuses.has(String(sale.status ?? ''));

const getDateKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

const getWholePeriodYears = (records: Sale[], currentDate: Date) => {
  const years = new Set<number>([currentDate.getFullYear()]);
  records.forEach((record) => {
    const year = new Date(record.saleDate).getFullYear();
    if (!Number.isNaN(year)) {
      years.add(year);
    }
  });
  return [...years].sort((first, second) => first - second);
};

const buildYearlySnapshot = (
  records: Sale[],
  years: number[],
  color: string,
  label: string,
  getValue: (sale: Sale) => number,
): ChartSnapshot => {
  const values = Array.from({ length: years.length }, () => 0);

  records.forEach((record) => {
    const year = new Date(record.saleDate).getFullYear();
    const index = years.indexOf(year);
    if (index < 0) return;
    values[index] += getValue(record);
  });

  return {
    year: years[years.length - 1] ?? currentDateFallback().getFullYear(),
    label,
    detailLabel: i18n.t('analytics.periods.whole'),
    values,
    total: values.reduce((sum, value) => sum + value, 0),
    color,
  };
};

const currentDateFallback = () => new Date();

const buildWholePeriodAnalytics = (
  productSales: Sale[],
  repairOrders: Sale[],
  products: Product[],
  currentDate: Date,
): DashboardAnalytics => {
  const years = getWholePeriodYears([...productSales, ...repairOrders], currentDate);
  const axisLabels = years.map(String);
  const revenueSnapshots = [
    buildYearlySnapshot(
      productSales,
      years,
      comparisonColors[0],
      i18n.t('analytics.customRange.current'),
      getSaleTotal,
    ),
  ];
  const orderSnapshots = [
    buildYearlySnapshot(
      repairOrders,
      years,
      comparisonColors[0],
      i18n.t('analytics.customRange.current'),
      () => 1,
    ),
  ];
  const salesCountSnapshots = [
    buildYearlySnapshot(
      productSales,
      years,
      comparisonColors[0],
      i18n.t('analytics.customRange.current'),
      () => 1,
    ),
  ];

  return buildAnalyticsResult({
    productSales,
    repairOrders,
    selectedSales: productSales,
    selectedOrders: repairOrders,
    revenueSnapshots,
    orderSnapshots,
    salesCountSnapshots,
    products,
    currentDate,
    detailLabel: i18n.t('analytics.periods.whole'),
    axisLabels,
  });
};

const getPeriodConfig = (period: StatsPeriod, currentDate: Date): PeriodConfig => {
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const currentDay = currentDate.getDate();
  const dateLocale = getDateLocale();

  if (period === 'today') {
    return {
      unit: 'hour',
      baseYear: currentYear,
      month: currentMonth,
      day: currentDay,
      detailLabel: currentDate.toLocaleDateString(dateLocale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
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
      detailLabel: monthDate.toLocaleDateString(dateLocale, {
        month: 'long',
        year: 'numeric',
      }),
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
    axisLabels: Array.from({ length: 12 }, (_, index) =>
      getMonthFormatter().format(new Date(baseYear, index, 1)),
    ),
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
  records: Sale[],
  config: PeriodConfig,
  yearsBack: number,
  color: string,
  getValue: (sale: Sale) => number,
): ChartSnapshot => {
  const year = config.baseYear - yearsBack;
  const values = Array.from({ length: getBucketCount(config, year) }, () => 0);

  records.forEach((record) => {
    const recordDate = new Date(record.saleDate);
    if (!matchesPeriod(recordDate, config, year)) return;

    values[getBucketIndex(recordDate, config)] += getValue(record);
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

export const buildLinePath = (
  values: number[],
  maxValue: number,
  width: number,
  height: number,
  padding: { top: number; right: number; bottom: number; left: number },
) => {
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  return values
    .map((value, index) => {
      const x =
        padding.left +
        (values.length === 1 ? innerWidth / 2 : (index / (values.length - 1)) * innerWidth);
      const y = padding.top + innerHeight - (value / Math.max(maxValue, 1)) * innerHeight;

      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
};

export const formatMetric = (value: number) => metricFormatter.format(Math.round(value));

export const formatCompactMetric = (value: number) => compactMetricFormatter.format(value);

export const formatCurrencyMetric = (value: number) =>
  i18n.t('analytics.currency', {
    value: currencyFormatter.format(Math.round(value)),
  });

type CustomRangeConfig = {
  unit: 'hour' | 'day' | 'month';
  detailLabel: string;
  axisLabels: string[];
  bucketKeys: string[];
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parseDateKey = (value: string) => {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toIsoDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCustomRangeBounds = (range: AnalyticsDateRange, currentDate: Date) => {
  const from = range.dateFrom
    ? parseDateKey(range.dateFrom)
    : parseDateKey(toIsoDateKey(currentDate));
  const to = range.dateTo
    ? parseDateKey(range.dateTo)
    : parseDateKey(toIsoDateKey(currentDate));
  if (!from || !to) return null;
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  return { start, end };
};

const getCustomRangeConfig = (
  range: AnalyticsDateRange,
  currentDate: Date,
): CustomRangeConfig | null => {
  const bounds = getCustomRangeBounds(range, currentDate);
  if (!bounds) return null;

  const dateLocale = getDateLocale();
  const detailLabel = formatAnalyticsDateRangeLabel(range, dateLocale);
  const daySpan =
    Math.floor((bounds.end.getTime() - bounds.start.getTime()) / MS_PER_DAY) + 1;

  if (daySpan <= 1) {
    const dayKey = toIsoDateKey(bounds.start);
    return {
      unit: 'hour',
      detailLabel,
      bucketKeys: Array.from({ length: 24 }, (_, hour) => `${dayKey}T${String(hour).padStart(2, '0')}`),
      axisLabels: Array.from({ length: 24 }, (_, index) =>
        index % 3 === 0 ? `${String(index).padStart(2, '0')}:00` : '',
      ),
    };
  }

  if (daySpan <= 62) {
    const bucketKeys: string[] = [];
    const cursor = new Date(bounds.start);
    while (cursor <= bounds.end) {
      bucketKeys.push(toIsoDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return {
      unit: 'day',
      detailLabel,
      bucketKeys,
      axisLabels: bucketKeys.map((key, index) => {
        const date = parseDateKey(key);
        if (!date) return '';
        return index % 2 === 0
          ? date.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })
          : '';
      }),
    };
  }

  const monthKeys: string[] = [];
  const cursor = new Date(bounds.start.getFullYear(), bounds.start.getMonth(), 1);
  const endMonth = new Date(bounds.end.getFullYear(), bounds.end.getMonth(), 1);
  while (cursor <= endMonth) {
    monthKeys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return {
    unit: 'month',
    detailLabel,
    bucketKeys: monthKeys,
    axisLabels: monthKeys.map((key) => {
      const [year, month] = key.split('-').map(Number);
      return getMonthFormatter().format(new Date(year, month - 1, 1));
    }),
  };
};

const getCustomBucketIndex = (saleDate: string, config: CustomRangeConfig) => {
  const date = new Date(saleDate);
  if (Number.isNaN(date.getTime())) return -1;

  if (config.unit === 'hour') {
    const dayKey = toIsoDateKey(date);
    const hour = date.getHours();
    return config.bucketKeys.findIndex((key) => key === `${dayKey}T${String(hour).padStart(2, '0')}`);
  }

  if (config.unit === 'day') {
    return config.bucketKeys.findIndex((key) => key === toIsoDateKey(date));
  }

  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  return config.bucketKeys.findIndex((key) => key === monthKey);
};

const buildCustomSnapshot = (
  records: Sale[],
  config: CustomRangeConfig,
  color: string,
  label: string,
  getValue: (sale: Sale) => number,
): ChartSnapshot => {
  const values = Array.from({ length: config.bucketKeys.length }, () => 0);

  records.forEach((record) => {
    const bucketIndex = getCustomBucketIndex(record.saleDate, config);
    if (bucketIndex < 0) return;
    values[bucketIndex] += getValue(record);
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

type DashboardAnalytics = ReturnType<typeof buildAnalyticsResult>;

const buildCustomRangeAnalytics = (
  productSales: Sale[],
  repairOrders: Sale[],
  customRange: AnalyticsDateRange,
  products: Product[],
  currentDate: Date,
): DashboardAnalytics => {
  const config = getCustomRangeConfig(customRange, currentDate);
  if (!config) {
    const todayConfig = getPeriodConfig('today', currentDate);
    const revenueSnapshots = comparisonColors.map((color, index) =>
      buildSnapshot(productSales, todayConfig, index, color, getSaleTotal),
    );
    const orderSnapshots = comparisonColors.map((color, index) =>
      buildSnapshot(repairOrders, todayConfig, index, color, () => 1),
    );
    const salesCountSnapshots = comparisonColors.map((color, index) =>
      buildSnapshot(productSales, todayConfig, index, color, () => 1),
    );
    const currentRevenue = revenueSnapshots[0];
    const selectedSales = productSales.filter((sale) =>
      matchesPeriod(new Date(sale.saleDate), todayConfig, currentRevenue.year),
    );
    const selectedOrders = repairOrders.filter((sale) =>
      matchesPeriod(new Date(sale.saleDate), todayConfig, currentRevenue.year),
    );
    return buildAnalyticsResult({
      productSales,
      repairOrders,
      selectedSales,
      selectedOrders,
      revenueSnapshots,
      orderSnapshots,
      salesCountSnapshots,
      products,
      currentDate,
      detailLabel: todayConfig.detailLabel,
      axisLabels: todayConfig.axisLabels,
    });
  }

  const filteredSales = productSales.filter((sale) =>
    isSaleInAnalyticsDateRange(sale.saleDate, customRange),
  );
  const filteredOrders = repairOrders.filter((sale) =>
    isSaleInAnalyticsDateRange(sale.saleDate, customRange),
  );
  const revenueSnapshots = [
    buildCustomSnapshot(filteredSales, config, comparisonColors[0], i18n.t('analytics.customRange.current'), getSaleTotal),
  ];
  const orderSnapshots = [
    buildCustomSnapshot(filteredOrders, config, comparisonColors[0], i18n.t('analytics.customRange.current'), () => 1),
  ];
  const salesCountSnapshots = [
    buildCustomSnapshot(filteredSales, config, comparisonColors[0], i18n.t('analytics.customRange.current'), () => 1),
  ];

  return buildAnalyticsResult({
    productSales,
    repairOrders,
    selectedSales: filteredSales,
    selectedOrders: filteredOrders,
    revenueSnapshots,
    orderSnapshots,
    salesCountSnapshots,
    products,
    currentDate,
    detailLabel: config.detailLabel,
    axisLabels: config.axisLabels,
  });
};

type AnalyticsResultInput = {
  productSales: Sale[];
  repairOrders: Sale[];
  selectedSales: Sale[];
  selectedOrders: Sale[];
  revenueSnapshots: ChartSnapshot[];
  orderSnapshots: ChartSnapshot[];
  salesCountSnapshots: ChartSnapshot[];
  products: Product[];
  currentDate: Date;
  detailLabel: string;
  axisLabels: string[];
};

const buildAnalyticsResult = ({
  productSales,
  repairOrders,
  selectedSales,
  selectedOrders,
  revenueSnapshots,
  orderSnapshots,
  salesCountSnapshots,
  products,
  currentDate,
  detailLabel,
  axisLabels,
}: AnalyticsResultInput) => {
  const currentRevenue = revenueSnapshots[0];
  const currentOrders = orderSnapshots[0];
  const currentSalesCount = salesCountSnapshots[0];
  const selectedRecords = [...selectedSales, ...selectedOrders];
  const revenue = currentRevenue.total;
  const salesCount = currentSalesCount.total;
  const ordersCount = currentOrders.total;
  const averageTicket = salesCount > 0 ? revenue / salesCount : 0;
  const paidAmount = selectedRecords.reduce((sum, sale) => sum + getPaidAmount(sale), 0);
  const totalAmount = selectedRecords.reduce((sum, sale) => sum + getSaleTotal(sale), 0);
  const remainingAmount = Math.max(totalAmount - paidAmount, 0);
  const paymentCoverage = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
  const openOrders = selectedRecords.filter((sale) => !isFinalRecord(sale)).length;
  const closedOrders = selectedRecords.length - openOrders;
  const unpaidOrders = selectedRecords.filter((sale) => getSaleTotal(sale) > getPaidAmount(sale)).length;
  const totalStock = products.reduce((sum, product) => sum + Math.max(product.quantity ?? 0, 0), 0);
  const freeStock = products.reduce((sum, product) => sum + Math.max(product.freeQuantity ?? 0, 0), 0);
  const reservedStock = products.reduce(
    (sum, product) => sum + Math.max(product.reservedQuantity ?? 0, 0),
    0,
  );
  const stockValue = products.reduce(
    (sum, product) => sum + Math.max(product.price ?? 0, 0) * Math.max(product.quantity ?? 0, 0),
    0,
  );
  const outOfStockProducts = products.filter((product) => product.freeQuantity <= 0).length;
  const lowStockProducts = products.filter(
    (product) => product.freeQuantity > 0 && product.freeQuantity <= 2,
  ).length;
  const todayKey = getDateKey(currentDate);
  const todaySales = productSales.filter((sale) => getDateKey(new Date(sale.saleDate)) === todayKey);
  const todayOrders = repairOrders.filter((sale) => getDateKey(new Date(sale.saleDate)) === todayKey);

  return {
    detailLabel,
    axisLabels,
    revenueSnapshots,
    orderSnapshots,
    salesCountSnapshots,
    revenueChartMax: Math.max(1, ...revenueSnapshots.flatMap((snapshot) => snapshot.values)),
    ordersChartMax: Math.max(1, ...orderSnapshots.flatMap((snapshot) => snapshot.values)),
    hasRevenueData: revenueSnapshots.some((snapshot) => snapshot.total > 0),
    hasOrdersData: orderSnapshots.some((snapshot) => snapshot.total > 0),
    currentYearLabel: currentRevenue.label,
    comparisonLabel: revenueSnapshots.map((snapshot) => snapshot.label).join(', '),
    summaryCards: [
      {
        labelKey: 'analytics.summary.sales',
        value: formatMetric(salesCount),
        accent: comparisonColors[0],
      },
      {
        labelKey: 'analytics.summary.repairOrders',
        value: formatMetric(ordersCount),
        accent: '#14b8a6',
      },
      {
        labelKey: 'analytics.summary.revenue',
        value: formatCurrencyMetric(revenue),
        accent: '#f97316',
      },
      {
        labelKey: 'analytics.summary.averageTicket',
        value: formatCurrencyMetric(averageTicket),
        accent: '#64748b',
      },
      {
        labelKey: 'analytics.summary.paid',
        value: formatCurrencyMetric(paidAmount),
        accent: '#0ea47d',
      },
      {
        labelKey: 'analytics.summary.receivables',
        value: formatCurrencyMetric(remainingAmount),
        accent: '#dc2626',
      },
    ],
    conversionCards: [
      {
        label: i18n.t('analytics.conversion.repairOrdersPerSales'),
        value: salesCount > 0 ? `${formatMetric((ordersCount / salesCount) * 100)}%` : '0%',
      },
      {
        label: i18n.t('analytics.conversion.salesPerRepairOrders'),
        value: ordersCount > 0 ? `${formatMetric((salesCount / ordersCount) * 100)}%` : '0%',
      },
      {
        label: i18n.t('analytics.conversion.paymentCoverage'),
        value: `${formatMetric(paymentCoverage)}%`,
      },
    ],
    operations: {
      openOrders,
      closedOrders,
      unpaidOrders,
      paidAmount,
      remainingAmount,
      paymentCoverage,
      todaySales: todaySales.length,
      todayOrders: todayOrders.length,
      todayRevenue: todaySales.reduce((sum, sale) => sum + getSaleTotal(sale), 0),
    },
    stock: {
      productCount: products.length,
      totalStock,
      freeStock,
      reservedStock,
      stockValue,
      outOfStockProducts,
      lowStockProducts,
    },
    signals: [
      {
        labelKey: 'analytics.signalsLabels.unpaidOrders',
        value: formatMetric(unpaidOrders),
        tone: unpaidOrders > 0 ? 'risk' : ('good' as const),
      },
      {
        labelKey: 'analytics.signalsLabels.openWorkflow',
        value: formatMetric(openOrders),
        tone: openOrders > 0 ? 'watch' : ('good' as const),
      },
      {
        labelKey: 'analytics.signalsLabels.lowStockItems',
        value: formatMetric(lowStockProducts + outOfStockProducts),
        tone: lowStockProducts + outOfStockProducts > 0 ? 'risk' : ('good' as const),
      },
      {
        labelKey: 'analytics.signalsLabels.todayActivity',
        value: formatMetric(todaySales.length + todayOrders.length),
        tone: todaySales.length + todayOrders.length > 0 ? 'good' : ('muted' as const),
      },
    ],
  };
};

export const buildDashboardAnalytics = (
  productSales: Sale[],
  repairOrders: Sale[],
  statsPeriod: StatsPeriod,
  products: Product[] = [],
  currentDate = new Date(),
  customRange: AnalyticsDateRange | null = null,
): DashboardAnalytics => {
  if (customRange?.dateFrom || customRange?.dateTo) {
    return buildCustomRangeAnalytics(
      productSales,
      repairOrders,
      customRange,
      products,
      currentDate,
    );
  }

  if (statsPeriod === 'whole') {
    return buildWholePeriodAnalytics(
      productSales,
      repairOrders,
      products,
      currentDate,
    );
  }

  const config = getPeriodConfig(statsPeriod, currentDate);
  const revenueSnapshots = comparisonColors.map((color, index) =>
    buildSnapshot(productSales, config, index, color, getSaleTotal),
  );
  const orderSnapshots = comparisonColors.map((color, index) =>
    buildSnapshot(repairOrders, config, index, color, () => 1),
  );
  const salesCountSnapshots = comparisonColors.map((color, index) =>
    buildSnapshot(productSales, config, index, color, () => 1),
  );
  const currentRevenue = revenueSnapshots[0];
  const selectedSales = productSales.filter((sale) =>
    matchesPeriod(new Date(sale.saleDate), config, currentRevenue.year),
  );
  const selectedOrders = repairOrders.filter((sale) =>
    matchesPeriod(new Date(sale.saleDate), config, currentRevenue.year),
  );
  return buildAnalyticsResult({
    productSales,
    repairOrders,
    selectedSales,
    selectedOrders,
    revenueSnapshots,
    orderSnapshots,
    salesCountSnapshots,
    products,
    currentDate,
    detailLabel: config.detailLabel,
    axisLabels: config.axisLabels,
  });
};