export type AnalyticsDateRange = {
  dateFrom: string;
  dateTo: string;
};

export const analyticsDateRangeStorageKey = 'project-goods.analytics-date-range';

export const isAnalyticsDateRangeValid = (range: AnalyticsDateRange | null | undefined) => {
  if (!range?.dateFrom && !range?.dateTo) return false;
  if (range.dateFrom && range.dateTo && range.dateFrom > range.dateTo) return false;
  return Boolean(range.dateFrom || range.dateTo);
};

export const normalizeAnalyticsDateRange = (
  range: AnalyticsDateRange | null | undefined,
): AnalyticsDateRange | null => {
  if (!range) return null;
  const dateFrom = range.dateFrom?.trim() ?? '';
  const dateTo = range.dateTo?.trim() ?? '';
  if (!dateFrom && !dateTo) return null;
  if (dateFrom && dateTo && dateFrom > dateTo) return null;
  return { dateFrom, dateTo };
};

export const getAnalyticsDateRangeFilterCount = (range: AnalyticsDateRange | null) => {
  if (!range) return 0;
  return (range.dateFrom ? 1 : 0) + (range.dateTo ? 1 : 0);
};

export const getStoredAnalyticsDateRange = (): AnalyticsDateRange | null => {
  try {
    const raw = window.localStorage.getItem(analyticsDateRangeStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnalyticsDateRange;
    return normalizeAnalyticsDateRange(parsed);
  } catch {
    return null;
  }
};

export const storeAnalyticsDateRange = (range: AnalyticsDateRange | null) => {
  try {
    if (!range) {
      window.localStorage.removeItem(analyticsDateRangeStorageKey);
      return;
    }
    window.localStorage.setItem(analyticsDateRangeStorageKey, JSON.stringify(range));
  } catch {
    // Ignore localStorage write errors.
  }
};

export const formatAnalyticsDateRangeLabel = (
  range: AnalyticsDateRange,
  locale = 'en-US',
) => {
  const formatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const formatPart = (value: string) => {
    if (!value) return '';
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? value : formatter.format(date);
  };
  const fromLabel = formatPart(range.dateFrom);
  const toLabel = formatPart(range.dateTo);
  if (fromLabel && toLabel) return `${fromLabel} – ${toLabel}`;
  if (fromLabel) return `from ${fromLabel}`;
  if (toLabel) return `until ${toLabel}`;
  return '';
};

export const isSaleInAnalyticsDateRange = (
  saleDate: string,
  range: AnalyticsDateRange,
) => {
  const txDate = saleDate.slice(0, 10);
  if (range.dateFrom && txDate < range.dateFrom) return false;
  if (range.dateTo && txDate > range.dateTo) return false;
  return true;
};