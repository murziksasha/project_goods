import type { AnalyticsDateRange } from './analytics-date-range';

export type StatsPeriod =
  | 'whole'
  | 'today'
  | 'currentMonth'
  | 'lastMonth'
  | 'currentYear'
  | 'lastYear';

export const statsPeriodOptions: Array<{ value: StatsPeriod; labelKey: string }> = [
  { value: 'whole', labelKey: 'analytics.periods.whole' },
  { value: 'today', labelKey: 'analytics.periods.today' },
  { value: 'currentMonth', labelKey: 'analytics.periods.currentMonth' },
  { value: 'lastMonth', labelKey: 'analytics.periods.lastMonth' },
  { value: 'currentYear', labelKey: 'analytics.periods.currentYear' },
  { value: 'lastYear', labelKey: 'analytics.periods.lastYear' },
];

export const getStatsPeriodLabelKey = (period: StatsPeriod) =>
  statsPeriodOptions.find((option) => option.value === period)?.labelKey ??
  'analytics.periods.today';

const toIsoDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getStatsPeriodDateRange = (
  period: StatsPeriod,
  currentDate = new Date(),
): AnalyticsDateRange | null => {
  if (period === 'whole') return null;

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  if (period === 'today') {
    const today = toIsoDateKey(currentDate);
    return { dateFrom: today, dateTo: today };
  }

  if (period === 'currentMonth') {
    const start = new Date(currentYear, currentMonth, 1);
    const end = new Date(currentYear, currentMonth + 1, 0);
    return { dateFrom: toIsoDateKey(start), dateTo: toIsoDateKey(end) };
  }

  if (period === 'lastMonth') {
    const start = new Date(currentYear, currentMonth - 1, 1);
    const end = new Date(currentYear, currentMonth, 0);
    return { dateFrom: toIsoDateKey(start), dateTo: toIsoDateKey(end) };
  }

  if (period === 'currentYear') {
    const start = new Date(currentYear, 0, 1);
    const end = new Date(currentYear, 11, 31);
    return { dateFrom: toIsoDateKey(start), dateTo: toIsoDateKey(end) };
  }

  const lastYear = currentYear - 1;
  const start = new Date(lastYear, 0, 1);
  const end = new Date(lastYear, 11, 31);
  return { dateFrom: toIsoDateKey(start), dateTo: toIsoDateKey(end) };
};

export const isStatsPeriodDateRange = (
  period: StatsPeriod,
  range: AnalyticsDateRange,
  currentDate = new Date(),
) => {
  const expected = getStatsPeriodDateRange(period, currentDate);
  if (!expected) {
    return !range.dateFrom && !range.dateTo;
  }
  return expected.dateFrom === range.dateFrom && expected.dateTo === range.dateTo;
};

export const isCustomStatsDateRange = (
  range: AnalyticsDateRange,
  statsPeriod: StatsPeriod,
  currentDate = new Date(),
) => !isStatsPeriodDateRange(statsPeriod, range, currentDate);