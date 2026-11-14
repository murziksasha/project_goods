import type { TFunction } from 'i18next';

export type AccountingWarningItem = {
  code: string;
  count?: number;
  date?: string;
  units?: number;
};

export const translateTxType = (t: TFunction, type: string): string =>
  t(`accounting.reports.types.${type}`, { defaultValue: type });

export const translatePeriodLabel = (t: TFunction, period: string): string =>
  t(`accounting.reports.periods.${period}`, { defaultValue: period });

export const translateProfitKind = (
  t: TFunction,
  kind: 'sale' | 'repair' | string,
): string => t(`accounting.profit.kinds.${kind}`, { defaultValue: kind });

const CASHBOX_WARNING_PATTERNS: Array<{
  regex: RegExp;
  code: string;
  dateFrom?: number;
  countFrom?: number;
}> = [
  {
    regex:
      /^Transactions on or before (\S+) \((\d+) purged\) are sealed; opening balance and full period reconciliation are unavailable inside the sealed purge window\.$/,
    code: 'sealedPurge',
    dateFrom: 1,
    countFrom: 2,
  },
  {
    regex:
      /^Trailing 90-day forecast history partially overlaps purged seal date \((\S+)\)\.$/,
    code: 'forecastTruncatedBySeal',
    dateFrom: 1,
  },
  {
    regex:
      /^Only (\d+) day\(s\) of finance history available inside the 90-day observation window\.$/,
    code: 'shortFinanceHistory',
    countFrom: 1,
  },
];

const PROFIT_WARNING_PATTERNS: Array<{
  regex: RegExp;
  code: string;
  countFrom?: number;
}> = [
  {
    regex:
      /^Cold yearly archive purges exist; profitability metrics cover live persisted sales only\.$/,
    code: 'coldArchiveProfit',
  },
  {
    regex:
      /^Service profit mode is set to revenue only: service costs are omitted and overall profit\/margin are marked incomplete when services are present\.$/,
    code: 'serviceModeRevenueOnly',
  },
  {
    regex:
      /^Service profit mode is set to exclude: service lines are omitted from profitability while products and actual cash flow remain included\.$/,
    code: 'serviceModeExclude',
  },
  {
    regex:
      /^(\d+) SKU group\(s\) have incomplete cost records; overall gross profit\/margin is incomplete\.$/,
    code: 'incompleteCostRecords',
    countFrom: 1,
  },
];

const translateByCode = (
  t: TFunction,
  ns: 'accounting.reports.warnings' | 'accounting.profit.warnings',
  code: string,
  extras?: { count?: number; date?: string },
): string => t(`${ns}.${code}`, { count: extras?.count, date: extras?.date });

const fallback = (
  t: TFunction,
  ns: 'accounting.reports.warnings' | 'accounting.profit.warnings',
  warning: string,
  patterns: Array<{
    regex: RegExp;
    code: string;
    dateFrom?: number;
    countFrom?: number;
  }>,
): string => {
  for (const pattern of patterns) {
    const match = warning.match(pattern.regex);
    if (match) {
      const count =
        pattern.countFrom !== undefined
          ? Number(match[pattern.countFrom])
          : undefined;
      const date =
        pattern.dateFrom !== undefined ? match[pattern.dateFrom] : undefined;
      return translateByCode(t, ns, pattern.code, { count, date });
    }
  }
  return warning;
};

export const translateCashboxCoverageWarnings = (
  t: TFunction,
  warnings: string[],
  warningItems?: AccountingWarningItem[],
): string[] => {
  if (warningItems && warningItems.length > 0) {
    return warningItems.map((item) =>
      translateByCode(t, 'accounting.reports.warnings', item.code, {
        count: item.count,
        date: item.date,
      }),
    );
  }
  return warnings.map((warning) =>
    fallback(t, 'accounting.reports.warnings', warning, CASHBOX_WARNING_PATTERNS),
  );
};

export const translateProfitCoverageWarnings = (
  t: TFunction,
  warnings: string[],
  warningItems?: AccountingWarningItem[],
): string[] => {
  if (warningItems && warningItems.length > 0) {
    return warningItems.map((item) =>
      translateByCode(t, 'accounting.profit.warnings', item.code, {
        count: item.count,
        date: item.date,
      }),
    );
  }
  return warnings.map((warning) =>
    fallback(t, 'accounting.profit.warnings', warning, PROFIT_WARNING_PATTERNS),
  );
};
