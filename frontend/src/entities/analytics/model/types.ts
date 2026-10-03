export type AnalyticsDateRange = {
  dateFrom: string;
  dateTo: string;
};

export type StatsPeriod =
  | 'whole'
  | 'today'
  | 'currentMonth'
  | 'lastMonth'
  | 'currentYear'
  | 'lastYear';

