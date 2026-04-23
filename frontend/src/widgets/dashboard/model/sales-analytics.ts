import type { Sale } from '../../../entities/sale/model/types';

export type StatsPeriod = 'today' | 'currentMonth' | 'lastMonth' | 'currentYear' | 'lastYear';

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

export const statsPeriodOptions: Array<{ value: StatsPeriod; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'currentMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'currentYear', label: 'This year' },
  { value: 'lastYear', label: 'Last year' },
];

const comparisonColors = ['#2d8ae3', '#f97316', '#14b8a6'] as const;

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

const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });

const getPeriodConfig = (period: StatsPeriod, currentDate: Date): PeriodConfig => {
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const currentDay = currentDate.getDate();

  if (period === 'today') {
    return {
      unit: 'hour',
      baseYear: currentYear,
      month: currentMonth,
      day: currentDay,
      detailLabel: currentDate.toLocaleDateString('en-US', {
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
      detailLabel: monthDate.toLocaleDateString('en-US', {
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
      monthFormatter.format(new Date(baseYear, index, 1)),
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
      const y =
        padding.top + innerHeight - (value / Math.max(maxValue, 1)) * innerHeight;

      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
};

export const formatMetric = (value: number) =>
  metricFormatter.format(Math.round(value));

export const formatCompactMetric = (value: number) =>
  compactMetricFormatter.format(value);

export const formatCurrencyMetric = (value: number) =>
  `₴ ${currencyFormatter.format(Math.round(value))}`;

export const buildDashboardAnalytics = (
  productSales: Sale[],
  repairOrders: Sale[],
  statsPeriod: StatsPeriod,
) => {
  const config = getPeriodConfig(statsPeriod, new Date());
  const revenueSnapshots = comparisonColors.map((color, index) =>
    buildSnapshot(
      productSales,
      config,
      index,
      color,
      (sale) => sale.salePrice * sale.quantity,
    ),
  );
  const orderSnapshots = comparisonColors.map((color, index) =>
    buildSnapshot(repairOrders, config, index, color, () => 1),
  );
  const salesCountSnapshots = comparisonColors.map((color, index) =>
    buildSnapshot(productSales, config, index, color, () => 1),
  );
  const currentRevenue = revenueSnapshots[0];
  const currentOrders = orderSnapshots[0];
  const currentSalesCount = salesCountSnapshots[0];
  const selectedSales = productSales.filter((sale) =>
    matchesPeriod(new Date(sale.saleDate), config, currentRevenue.year),
  );
  const revenue = currentRevenue.total;
  const salesCount = currentSalesCount.total;
  const ordersCount = currentOrders.total;
  const averageTicket = salesCount > 0 ? revenue / salesCount : 0;

  return {
    statsPeriodOptions,
    detailLabel: config.detailLabel,
    axisLabels: config.axisLabels,
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
      { label: 'Продажи', value: formatMetric(salesCount), accent: comparisonColors[0] },
      { label: 'Заказы', value: formatMetric(ordersCount), accent: '#14b8a6' },
      { label: 'Выручка', value: formatCurrencyMetric(revenue), accent: '#f97316' },
      { label: 'Средний чек', value: formatCurrencyMetric(averageTicket), accent: '#64748b' },
    ],
    conversionCards: [
      {
        label: 'Заказы / продажи',
        value: salesCount > 0 ? `${formatMetric((ordersCount / salesCount) * 100)}%` : '0%',
      },
      {
        label: 'Продажи / заказы',
        value: ordersCount > 0 ? `${formatMetric((salesCount / ordersCount) * 100)}%` : '0%',
      },
      {
        label: 'Оплаченные продажи',
        value: selectedSales.length > 0 ? '100%' : '0%',
      },
    ],
  };
};
