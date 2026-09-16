import * as XLSX from 'xlsx';
import type {
  FinanceProfitReport,
  ProfitReportPeriod,
  ProfitReportSource,
} from '../../../entities/finance/model/types';
import type { AnalyticsDateRange } from './analytics-date-range';

export const profitReportFiltersStorageKey =
  'project-goods.accounting-profit-filters';

export const profitReportPeriodOptions: Array<{
  value: ProfitReportPeriod;
  labelKey: string;
}> = [
  { value: 'whole', labelKey: 'accounting.profit.periods.whole' },
  { value: 'day', labelKey: 'accounting.profit.periods.day' },
  { value: 'week', labelKey: 'accounting.profit.periods.week' },
  { value: 'month', labelKey: 'accounting.profit.periods.month' },
  { value: 'year', labelKey: 'accounting.profit.periods.year' },
];

export const profitReportSourceOptions: Array<{
  value: ProfitReportSource;
  labelKey: string;
}> = [
  { value: 'all', labelKey: 'accounting.profit.sources.all' },
  { value: 'services', labelKey: 'accounting.profit.sources.services' },
  { value: 'sales', labelKey: 'accounting.profit.sources.sales' },
];

export type StoredProfitReportFilters = {
  period: ProfitReportPeriod;
  source: ProfitReportSource;
  dateFrom: string;
  dateTo: string;
};

const isPeriod = (value: unknown): value is ProfitReportPeriod =>
  value === 'whole' ||
  value === 'day' ||
  value === 'week' ||
  value === 'month' ||
  value === 'year';

const isSource = (value: unknown): value is ProfitReportSource =>
  value === 'all' || value === 'sales' || value === 'services';

export const defaultProfitReportFilters = (): StoredProfitReportFilters => ({
  period: 'whole',
  source: 'all',
  dateFrom: '',
  dateTo: '',
});

export const getStoredProfitReportFilters = (): StoredProfitReportFilters => {
  const fallback = defaultProfitReportFilters();
  try {
    const raw = window.localStorage.getItem(profitReportFiltersStorageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredProfitReportFilters>;
    return {
      period: isPeriod(parsed.period) ? parsed.period : fallback.period,
      source: isSource(parsed.source) ? parsed.source : fallback.source,
      dateFrom: String(parsed.dateFrom ?? ''),
      dateTo: String(parsed.dateTo ?? ''),
    };
  } catch {
    return fallback;
  }
};

export const storeProfitReportFilters = (filters: StoredProfitReportFilters) => {
  try {
    window.localStorage.setItem(
      profitReportFiltersStorageKey,
      JSON.stringify(filters),
    );
  } catch {
    // Ignore localStorage write errors.
  }
};

export const hasCustomProfitDateRange = (range: AnalyticsDateRange) =>
  Boolean(range.dateFrom || range.dateTo);

const toExcelSheetName = (value: string) =>
  value.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Report';

const downloadWorkbook = (workbook: XLSX.WorkBook, filename: string) => {
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const buildProfitReportFilename = (report: FinanceProfitReport) => {
  const from = report.period.dateFrom ?? 'all-time';
  const to = report.period.dateTo ?? from;
  return `profit-report_${report.source}_${from}_${to}.xlsx`;
};

export const exportProfitReportWorkbook = ({
  report,
  filename,
  labels,
}: {
  report: FinanceProfitReport;
  filename: string;
  labels: {
    title: string;
    generated: string;
    source: string;
    period: string;
    filters: string;
    summarySheet: string;
    marginSheet: string;
    cashSheet: string;
    revenue: string;
    cogs: string;
    grossProfit: string;
    grossMargin: string;
    collected: string;
    purchases: string;
    opex: string;
    refunds: string;
    netCash: string;
    name: string;
    type: string;
    quantity: string;
    cost: string;
    profit: string;
    marginPct: string;
    category: string;
    amount: string;
    count: string;
    note: string;
    date: string;
    currency: string;
    product: string;
    service: string;
    unknownCost: string;
  };
}) => {
  const generatedAt = new Date().toLocaleString();
  const periodLabel =
    report.period.dateFrom && report.period.dateTo
      ? `${report.period.dateFrom} – ${report.period.dateTo}`
      : report.period.key;
  const summaryRows: Array<Array<string | number>> = [
    [labels.title],
    [labels.generated, generatedAt],
    [labels.source, report.source],
    [labels.period, periodLabel],
    [labels.filters, `${report.source}; ${periodLabel}`],
    [],
    [labels.revenue, report.margin.revenue],
    [labels.cogs, report.margin.cogs],
    [labels.grossProfit, report.margin.grossProfit],
    [labels.grossMargin, report.margin.grossMarginPct ?? ''],
    [labels.collected, report.cash.collected],
    [labels.purchases, report.cash.inventoryPurchases],
    [labels.opex, report.cash.opex],
    [labels.refunds, report.cash.refunds],
    [labels.netCash, report.cash.net],
    [labels.unknownCost, report.margin.unknownCostCount],
  ];

  const marginRows: Array<Array<string | number>> = [
    [
      labels.name,
      labels.type,
      labels.quantity,
      labels.cost,
      labels.revenue,
      labels.profit,
      labels.marginPct,
    ],
    ...report.rows.map((row) => [
      row.name,
      row.type === 'service' ? labels.service : labels.product,
      row.quantity,
      row.costKnown ? row.cost : '',
      row.revenue,
      row.profit,
      row.marginPct ?? '',
    ]),
    [
      labels.grossProfit,
      '',
      report.rows.reduce((sum, row) => sum + row.quantity, 0),
      report.margin.cogs,
      report.margin.revenue,
      report.margin.grossProfit,
      report.margin.grossMarginPct ?? '',
    ],
  ];

  const cashRows: Array<Array<string | number>> = [
    [labels.category, labels.amount, labels.count],
    ...report.cash.opexByCategory.map((row) => [
      row.category,
      row.amount,
      row.count,
    ]),
    [],
    [labels.date, labels.category, labels.amount, labels.currency, labels.note],
    ...report.cash.operations.map((row) => [
      row.transactionDate.slice(0, 10),
      row.category,
      row.amount,
      row.currency,
      row.note,
    ]),
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(summaryRows),
    toExcelSheetName(labels.summarySheet),
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(marginRows),
    toExcelSheetName(labels.marginSheet),
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(cashRows),
    toExcelSheetName(labels.cashSheet),
  );
  downloadWorkbook(workbook, filename);
};
