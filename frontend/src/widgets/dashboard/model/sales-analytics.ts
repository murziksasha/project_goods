import type { Sale } from '../../../entities/sale/model/types';

export type StatsPeriod = 'today' | 'currentMonth' | 'lastMonth';

type SalesSnapshot = {
  year: number;
  label: string;
  detailLabel: string;
  revenue: number;
  salesCount: number;
  itemsSold: number;
  values: number[];
  color: string;
};

const statsPeriodOptions: Array<{ value: StatsPeriod; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'currentMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
];

const comparisonColors = ['#0f172a', '#f97316', '#0ea5e9'] as const;

const metricFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const compactMetricFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
  signDisplay: 'always',
});

const buildMonthlyValues = (allSales: Sale[], year: number, month: number) => {
  const dayCount = new Date(year, month + 1, 0).getDate();
  const values = Array.from({ length: dayCount }, () => 0);

  allSales.forEach((sale) => {
    const saleDate = new Date(sale.saleDate);
    if (saleDate.getFullYear() !== year || saleDate.getMonth() !== month) {
      return;
    }

    values[saleDate.getDate() - 1] += sale.salePrice * sale.quantity;
  });

  return values;
};

const buildSalesSnapshot = (
  allSales: Sale[],
  period: StatsPeriod,
  baseDate: Date,
  yearsBack: number,
  color: string,
): SalesSnapshot => {
  const year = baseDate.getFullYear() - yearsBack;

  if (period === 'today') {
    const month = baseDate.getMonth();
    const day = baseDate.getDate();
    const matchedSales = allSales.filter((sale) => {
      const saleDate = new Date(sale.saleDate);
      return (
        saleDate.getFullYear() === year &&
        saleDate.getMonth() === month &&
        saleDate.getDate() === day
      );
    });

    const revenue = matchedSales.reduce(
      (sum, sale) => sum + sale.salePrice * sale.quantity,
      0,
    );

    return {
      year,
      label: String(year),
      detailLabel: new Date(year, month, day).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      revenue,
      salesCount: matchedSales.length,
      itemsSold: matchedSales.reduce((sum, sale) => sum + sale.quantity, 0),
      values: [revenue],
      color,
    };
  }

  const monthDate =
    period === 'currentMonth'
      ? new Date(year, baseDate.getMonth(), 1)
      : new Date(year, baseDate.getMonth() - 1, 1);
  const month = monthDate.getMonth();
  const matchedSales = allSales.filter((sale) => {
    const saleDate = new Date(sale.saleDate);
    return (
      saleDate.getFullYear() === monthDate.getFullYear() &&
      saleDate.getMonth() === month
    );
  });

  const values = buildMonthlyValues(allSales, monthDate.getFullYear(), month);

  return {
    year: monthDate.getFullYear(),
    label: String(monthDate.getFullYear()),
    detailLabel: monthDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    }),
    revenue: values.reduce((sum, value) => sum + value, 0),
    salesCount: matchedSales.length,
    itemsSold: matchedSales.reduce((sum, sale) => sum + sale.quantity, 0),
    values,
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

export const buildSalesAnalytics = (sales: Sale[], statsPeriod: StatsPeriod) => {
  const currentDate = new Date();
  const snapshots = comparisonColors.map((color, index) =>
    buildSalesSnapshot(sales, statsPeriod, currentDate, index, color),
  );
  const [currentSnapshot, lastYearSnapshot, twoYearsAgoSnapshot] = snapshots;

  const periodLabels =
    statsPeriod === 'today'
      ? [currentSnapshot.detailLabel]
      : Array.from(
          {
            length: Math.max(
              currentSnapshot.values.length,
              lastYearSnapshot.values.length,
              twoYearsAgoSnapshot.values.length,
            ),
          },
          (_, index) => String(index + 1),
        );

  const revenueDelta =
    lastYearSnapshot.revenue === 0
      ? currentSnapshot.revenue > 0
        ? 100
        : 0
      : ((currentSnapshot.revenue - lastYearSnapshot.revenue) /
          lastYearSnapshot.revenue) *
        100;

  return {
    statsPeriodOptions,
    snapshots,
    currentSnapshot,
    lastYearSnapshot,
    twoYearsAgoSnapshot,
    periodLabels,
    hasPeriodSales: snapshots.some((snapshot) => snapshot.salesCount > 0),
    chartMaxValue: Math.max(1, ...snapshots.flatMap((snapshot) => snapshot.values)),
    averageTicket:
      currentSnapshot.salesCount > 0
        ? currentSnapshot.revenue / currentSnapshot.salesCount
        : 0,
    heroStatCards: [
      {
        label: 'Revenue',
        value: formatCompactMetric(currentSnapshot.revenue),
        hint: `${percentFormatter.format(revenueDelta)} vs ${lastYearSnapshot.label}`,
      },
      {
        label: 'Sales',
        value: formatMetric(currentSnapshot.salesCount),
        hint: `${formatMetric(lastYearSnapshot.salesCount)} last year`,
      },
      {
        label: 'Items sold',
        value: formatMetric(currentSnapshot.itemsSold),
        hint: `${formatMetric(twoYearsAgoSnapshot.itemsSold)} in ${twoYearsAgoSnapshot.label}`,
      },
      {
        label: 'Avg. ticket',
        value: formatCompactMetric(
          currentSnapshot.salesCount > 0
            ? currentSnapshot.revenue / currentSnapshot.salesCount
            : 0,
        ),
        hint: currentSnapshot.detailLabel,
      },
    ],
  };
};
