import { describe, expect, it } from 'vitest';
import {
  getStatsPeriodDateRange,
  isCustomStatsDateRange,
  isStatsPeriodDateRange,
} from './stats-period';

describe('stats period', () => {
  const currentDate = new Date(2026, 6, 7, 12, 0, 0);

  it('resolves whole as an unrestricted range', () => {
    expect(getStatsPeriodDateRange('whole', currentDate)).toBeNull();
  });

  it('resolves today as a single-day range', () => {
    expect(getStatsPeriodDateRange('today', currentDate)).toEqual({
      dateFrom: '2026-07-07',
      dateTo: '2026-07-07',
    });
  });

  it('detects custom ranges that do not match the selected preset', () => {
    expect(
      isCustomStatsDateRange(
        { dateFrom: '2026-06-01', dateTo: '2026-06-30' },
        'today',
        currentDate,
      ),
    ).toBe(true);
    expect(
      isStatsPeriodDateRange(
        'today',
        { dateFrom: '2026-07-07', dateTo: '2026-07-07' },
        currentDate,
      ),
    ).toBe(true);
  });
});