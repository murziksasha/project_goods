import type { TFunction } from 'i18next';

export const ORDERS_INFO_PERIOD_KEYS = [
  'last30',
  'last7',
  'day',
  'week',
  'month',
  'year',
  'whole',
  'custom',
] as const;

export type ReportWarningItem = {
  code: string;
  count?: number;
};

export const translateRepairStatus = (t: TFunction, status: string): string =>
  t(`orders.status.repair.${status}`, { defaultValue: status });

export const translateSaleStatus = (t: TFunction, status: string): string =>
  t(`orders.status.sale.${status}`, { defaultValue: status });

export const translateSupplierOrderStatus = (t: TFunction, status: string): string =>
  t(`orders.supplier.orderStatuses.${status}`, { defaultValue: status });

export const translatePaymentStatus = (t: TFunction, status: string): string =>
  t(`orders.supplier.paymentStatuses.${status}`, { defaultValue: status });

export const translateReceiptStatus = (t: TFunction, status: string): string =>
  t(`warehouse.tables.receipts.status.${status}`, { defaultValue: status });

export const translateTechnicianName = (
  t: TFunction,
  name: string,
  technicianId: string | null,
): string => {
  if (!technicianId || name === 'Unassigned') {
    return t('orders.information.unassigned');
  }
  if (name === 'Assigned') {
    return t('orders.information.assigned');
  }
  return name;
};

export const translateLineKind = (t: TFunction, kind: string): string =>
  t(`orders.information.kinds.${kind}`, { defaultValue: kind });

const KNOWN_WARNING_PATTERNS: Array<{
  regex: RegExp;
  code: string;
  countFrom?: number;
}> = [
  {
    regex:
      /^Cold yearly archive purges exist; period analytics cover live persisted repairs only\.$/,
    code: 'coldArchiveRepairs',
  },
  {
    regex:
      /^(\d+) closed repair\(s\) lack structured completion timestamps and are excluded from turnaround averages\.$/,
    code: 'untrackedCompletions',
    countFrom: 1,
  },
  {
    regex:
      /^No closed repairs with structured completion timestamps in this period\.$/,
    code: 'noStructuredCompletions',
  },
  {
    regex:
      /^Legacy closed orders without structured completion timestamps are excluded from turnaround metrics\.$/,
    code: 'legacyCompletionsExcluded',
  },
  {
    regex:
      /^Cold yearly archive purges exist; sales figures reflect live persisted records only\.$/,
    code: 'coldArchiveSales',
  },
  {
    regex:
      /^(\d+) legacy received item\(s\) lack structured receipt timestamps and are excluded from lead-time & on-time performance\.$/,
    code: 'untrackedReceipts',
    countFrom: 1,
  },
];

const translateWarningByCode = (
  t: TFunction,
  code: string,
  count?: number,
): string => t(`orders.information.warnings.${code}`, { count });

const translateWarningFallback = (t: TFunction, warning: string): string => {
  for (const pattern of KNOWN_WARNING_PATTERNS) {
    const match = warning.match(pattern.regex);
    if (match) {
      const count =
        pattern.countFrom !== undefined
          ? Number(match[pattern.countFrom])
          : undefined;
      return translateWarningByCode(t, pattern.code, count);
    }
  }
  return warning;
};

export const translateCoverageWarnings = (
  t: TFunction,
  warnings: string[],
  warningItems?: ReportWarningItem[],
): string[] => {
  if (warningItems && warningItems.length > 0) {
    return warningItems.map((item) =>
      translateWarningByCode(t, item.code, item.count),
    );
  }
  return warnings.map((warning) => translateWarningFallback(t, warning));
};

export const translateTurnaroundWarning = (
  t: TFunction,
  warning: string | null | undefined,
  warningCode?: string | null,
): string | null => {
  if (warningCode) {
    return translateWarningByCode(t, warningCode);
  }
  if (!warning) {
    return null;
  }
  return translateWarningFallback(t, warning);
};
