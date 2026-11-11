export const BUSINESS_TIME_ZONE = 'Europe/Kiev';

export type BoundedPeriodKey =
  | 'whole'
  | 'day'
  | 'week'
  | 'month'
  | 'year'
  | 'last7'
  | 'last30'
  | 'custom';

export type ResolvedBoundedPeriod = {
  key: BoundedPeriodKey;
  dateFrom: string | null;
  dateTo: string | null;
  startUtc: Date | null;
  endUtc: Date | null;
  dayCount: number | null;
};

export type ResolvedPeriodWithComparison = {
  current: ResolvedBoundedPeriod;
  previous: ResolvedBoundedPeriod | null;
};

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const kievDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const kievWallClockFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export const formatKievDateKey = (value: Date | string | null | undefined): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = kievDateFormatter.formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
};

export const normalizeDateKey = (value: unknown): string | null => {
  const raw = String(value ?? '').trim();
  if (!DATE_KEY_RE.test(raw)) return null;
  const [y, m, d] = raw.split('-').map(Number);
  if (!y || !m || !d) return null;
  const check = new Date(Date.UTC(y, m - 1, d));
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() + 1 !== m ||
    check.getUTCDate() !== d
  ) {
    return null;
  }
  return raw;
};

export const addCalendarDays = (dateKey: string, deltaDays: number): string => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const next = new Date(Date.UTC(y!, m! - 1, d! + deltaDays));
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(next.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

export const diffCalendarDaysInclusive = (fromKey: string, toKey: string): number => {
  const [y1, m1, d1] = fromKey.split('-').map(Number);
  const [y2, m2, d2] = toKey.split('-').map(Number);
  const t1 = Date.UTC(y1!, m1! - 1, d1!);
  const t2 = Date.UTC(y2!, m2! - 1, d2!);
  return Math.round((t2 - t1) / 86_400_000) + 1;
};

const getKievOffsetMs = (utcDate: Date): number => {
  const parts = kievWallClockFormatter.formatToParts(utcDate);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hr = byType.hour === '24' ? 0 : Number(byType.hour);
  const wallAsUtc = Date.UTC(
    Number(byType.year),
    Number(byType.month) - 1,
    Number(byType.day),
    hr,
    Number(byType.minute),
    Number(byType.second),
  );
  return wallAsUtc - Math.floor(utcDate.getTime() / 1000) * 1000;
};

export const getKievDayStartUtc = (dateKey: string): Date => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const targetMidnightUtc = Date.UTC(y!, m! - 1, d!, 0, 0, 0, 0);
  const offset1 = getKievOffsetMs(new Date(targetMidnightUtc));
  const guess1 = targetMidnightUtc - offset1;
  const offset2 = getKievOffsetMs(new Date(guess1));
  return new Date(targetMidnightUtc - offset2);
};

export const getKievDayEndUtc = (dateKey: string): Date => {
  const nextKey = addCalendarDays(dateKey, 1);
  return new Date(getKievDayStartUtc(nextKey).getTime() - 1);
};

export const getMonthLastDayKey = (year: number, monthIndex0: number): string => {
  const lastDay = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
  return `${year}-${String(monthIndex0 + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};

export const getKievWeekBoundsKeys = (todayKey: string) => {
  const [y, m, d] = todayKey.split('-').map(Number);
  const weekday = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const mondayKey = addCalendarDays(todayKey, mondayOffset);
  return {
    dateFrom: mondayKey,
    dateTo: addCalendarDays(mondayKey, 6),
  };
};

export const resolveBoundedPeriodWithPrevious = (
  query: { period?: unknown; dateFrom?: unknown; dateTo?: unknown },
  options: { defaultPeriod?: BoundedPeriodKey; now?: Date } = {},
): ResolvedPeriodWithComparison => {
  const now = options.now ?? new Date();
  const defaultPeriod = options.defaultPeriod ?? 'last30';
  const todayKey = formatKievDateKey(now);

  const customFrom = normalizeDateKey(query.dateFrom);
  const customTo = normalizeDateKey(query.dateTo);

  let key: BoundedPeriodKey = defaultPeriod;
  let dateFrom: string | null = null;
  let dateTo: string | null = null;

  if (customFrom || customTo) {
    const start = customFrom ?? customTo!;
    const end = customTo ?? customFrom!;
    key = 'custom';
    dateFrom = start <= end ? start : end;
    dateTo = start <= end ? end : start;
  } else {
    const rawPeriod = String(query.period ?? '').trim();
    if (
      rawPeriod === 'whole' ||
      rawPeriod === 'all' ||
      rawPeriod === 'allTime'
    ) {
      key = 'whole';
    } else if (rawPeriod === 'day' || rawPeriod === 'today') {
      key = 'day';
    } else if (rawPeriod === 'week') {
      key = 'week';
    } else if (rawPeriod === 'last7') {
      key = 'last7';
    } else if (rawPeriod === 'last30') {
      key = 'last30';
    } else if (rawPeriod === 'month' || rawPeriod === 'currentMonth') {
      key = 'month';
    } else if (rawPeriod === 'year' || rawPeriod === 'currentYear') {
      key = 'year';
    }

    if (key === 'whole') {
      dateFrom = null;
      dateTo = null;
    } else if (key === 'day') {
      dateFrom = todayKey;
      dateTo = todayKey;
    } else if (key === 'week') {
      const wb = getKievWeekBoundsKeys(todayKey);
      dateFrom = wb.dateFrom;
      dateTo = wb.dateTo;
    } else if (key === 'last7') {
      dateFrom = addCalendarDays(todayKey, -6);
      dateTo = todayKey;
    } else if (key === 'last30') {
      dateFrom = addCalendarDays(todayKey, -29);
      dateTo = todayKey;
    } else if (key === 'month') {
      const [y, m] = todayKey.split('-').map(Number);
      dateFrom = `${todayKey.slice(0, 7)}-01`;
      dateTo = getMonthLastDayKey(y!, m! - 1);
    } else if (key === 'year') {
      const year = todayKey.slice(0, 4);
      dateFrom = `${year}-01-01`;
      dateTo = `${year}-12-31`;
    }
  }

  if (!dateFrom || !dateTo) {
    return {
      current: {
        key: 'whole',
        dateFrom: null,
        dateTo: null,
        startUtc: null,
        endUtc: null,
        dayCount: null,
      },
      previous: null,
    };
  }

  const dayCount = diffCalendarDaysInclusive(dateFrom, dateTo);
  const prevTo = addCalendarDays(dateFrom, -1);
  const prevFrom = addCalendarDays(dateFrom, -dayCount);

  return {
    current: {
      key,
      dateFrom,
      dateTo,
      startUtc: getKievDayStartUtc(dateFrom),
      endUtc: getKievDayEndUtc(dateTo),
      dayCount,
    },
    previous: {
      key: 'custom',
      dateFrom: prevFrom,
      dateTo: prevTo,
      startUtc: getKievDayStartUtc(prevFrom),
      endUtc: getKievDayEndUtc(prevTo),
      dayCount,
    },
  };
};

export const isDateKeyInsideRange = (
  dateKey: string,
  fromKey: string | null,
  toKey: string | null,
) => {
  if (!dateKey) return false;
  if (fromKey && dateKey < fromKey) return false;
  if (toKey && dateKey > toKey) return false;
  return true;
};

export const listCalendarDateKeys = (fromKey: string, toKey: string): string[] => {
  const keys: string[] = [];
  const totalDays = diffCalendarDaysInclusive(fromKey, toKey);
  if (totalDays <= 0 || totalDays > 4000) return keys;
  for (let i = 0; i < totalDays; i += 1) {
    keys.push(addCalendarDays(fromKey, i));
  }
  return keys;
};
