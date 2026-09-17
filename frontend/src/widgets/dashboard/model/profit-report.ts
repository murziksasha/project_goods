import * as XLSX from 'xlsx';
import type {
  FinanceProfitReport,
  ProfitMarginRow,
  ProfitReportPeriod,
  ProfitReportSource,
} from '../../../entities/finance/model/types';
import type { ServiceCatalogItem } from '../../../entities/service-catalog/model/types';
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
  {
    value: 'services',
    labelKey: 'accounting.profit.sources.services',
  },
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

export const defaultProfitReportFilters =
  (): StoredProfitReportFilters => ({
    period: 'whole',
    source: 'all',
    dateFrom: '',
    dateTo: '',
  });

export const getStoredProfitReportFilters =
  (): StoredProfitReportFilters => {
    const fallback = defaultProfitReportFilters();
    try {
      const raw = window.localStorage.getItem(
        profitReportFiltersStorageKey,
      );
      if (!raw) return fallback;
      const parsed = JSON.parse(
        raw,
      ) as Partial<StoredProfitReportFilters>;
      return {
        period: isPeriod(parsed.period)
          ? parsed.period
          : fallback.period,
        source: isSource(parsed.source)
          ? parsed.source
          : fallback.source,
        dateFrom: String(parsed.dateFrom ?? ''),
        dateTo: String(parsed.dateTo ?? ''),
      };
    } catch {
      return fallback;
    }
  };

export const storeProfitReportFilters = (
  filters: StoredProfitReportFilters,
) => {
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

export const profitReportVisualStorageKey =
  'project-goods.accounting-profit-visual';

export type ProfitReportChartMetric =
  | 'profit'
  | 'revenue'
  | 'quantity';
export type ProfitReportTypeFilter = 'all' | 'product' | 'service';
export type ProfitReportMarginFilter = 'all' | 'loss' | 'unknown';
export type ProfitReportRowSort =
  | 'default'
  | 'name'
  | 'profit'
  | 'quantity'
  | 'margin';

export type ProfitReportVisualSettings = {
  showCharts: boolean;
  chartMetric: ProfitReportChartMetric;
  highlightLosses: boolean;
  compactTable: boolean;
};

export type ProfitReportRowFilters = {
  search: string;
  type: ProfitReportTypeFilter;
  margin: ProfitReportMarginFilter;
  sort: ProfitReportRowSort;
};

export type ProfitMarginSummary = {
  count: number;
  quantity: number;
  cost: number;
  revenue: number;
  profit: number;
  marginPct: number | null;
  costKnown: boolean;
};

export type ProfitChartRow = {
  key: string;
  name: string;
  type: 'product' | 'service';
  value: number;
  sharePercent: number;
};

export type ProfitReportLeadersMetric = Extract<
  ProfitReportChartMetric,
  'profit' | 'quantity'
>;

export type ProfitMarginNameGroup = {
  id: string;
  name: string;
  type: 'product' | 'service' | 'mixed';
  rows: ProfitMarginRow[];
  summary: ProfitMarginSummary;
};

export const profitReportLeadersLimit = 10;

export type ProfitMixShare = {
  product: number;
  service: number;
  productPct: number;
  servicePct: number;
};

export type ProfitReportCatalogTarget =
  | { kind: 'product'; name: string }
  | { kind: 'service'; service: ServiceCatalogItem };

export const profitReportProductColor = '#2d8ae3';
export const profitReportServiceColor = '#14b8a6';
export const profitReportCogsColor = '#f97316';
export const profitReportChartBarColors = [
  profitReportProductColor,
  profitReportCogsColor,
  profitReportServiceColor,
] as const;

export const profitReportChartMetricOptions: Array<{
  value: ProfitReportChartMetric;
  labelKey: string;
}> = [
  {
    value: 'profit',
    labelKey: 'accounting.profit.visual.metrics.profit',
  },
  {
    value: 'revenue',
    labelKey: 'accounting.profit.visual.metrics.revenue',
  },
  {
    value: 'quantity',
    labelKey: 'accounting.profit.visual.metrics.quantity',
  },
];

export const profitReportLeadersMetricOptions: Array<{
  value: ProfitReportLeadersMetric;
  labelKey: string;
}> = [
  { value: 'profit', labelKey: 'accounting.profit.charts.metricUah' },
  {
    value: 'quantity',
    labelKey: 'accounting.profit.charts.metricQty',
  },
];

export const profitReportTypeFilterOptions: Array<{
  value: ProfitReportTypeFilter;
  labelKey: string;
}> = [
  { value: 'all', labelKey: 'accounting.profit.analysis.typeAll' },
  { value: 'product', labelKey: 'accounting.profit.types.product' },
  { value: 'service', labelKey: 'accounting.profit.types.service' },
];

export const profitReportMarginFilterOptions: Array<{
  value: ProfitReportMarginFilter;
  labelKey: string;
}> = [
  { value: 'all', labelKey: 'accounting.profit.analysis.marginAll' },
  {
    value: 'loss',
    labelKey: 'accounting.profit.analysis.marginLoss',
  },
  {
    value: 'unknown',
    labelKey: 'accounting.profit.analysis.marginUnknown',
  },
];

export const profitReportRowSortOptions: Array<{
  value: ProfitReportRowSort;
  labelKey: string;
}> = [
  {
    value: 'default',
    labelKey: 'accounting.profit.analysis.sortDefault',
  },
  { value: 'name', labelKey: 'accounting.profit.analysis.sortName' },
  {
    value: 'profit',
    labelKey: 'accounting.profit.analysis.sortProfit',
  },
  {
    value: 'quantity',
    labelKey: 'accounting.profit.analysis.sortQuantity',
  },
  {
    value: 'margin',
    labelKey: 'accounting.profit.analysis.sortMargin',
  },
];

export const defaultProfitReportVisualSettings =
  (): ProfitReportVisualSettings => ({
    showCharts: true,
    chartMetric: 'profit',
    highlightLosses: true,
    compactTable: false,
  });

export const defaultProfitReportRowFilters =
  (): ProfitReportRowFilters => ({
    search: '',
    type: 'all',
    margin: 'all',
    sort: 'default',
  });

const isChartMetric = (
  value: unknown,
): value is ProfitReportChartMetric =>
  value === 'profit' || value === 'revenue' || value === 'quantity';

export const getStoredProfitReportVisualSettings =
  (): ProfitReportVisualSettings => {
    const fallback = defaultProfitReportVisualSettings();
    try {
      const raw = window.localStorage.getItem(
        profitReportVisualStorageKey,
      );
      if (!raw) return fallback;
      const parsed = JSON.parse(
        raw,
      ) as Partial<ProfitReportVisualSettings>;
      return {
        showCharts:
          typeof parsed.showCharts === 'boolean'
            ? parsed.showCharts
            : fallback.showCharts,
        chartMetric: isChartMetric(parsed.chartMetric)
          ? parsed.chartMetric
          : fallback.chartMetric,
        highlightLosses:
          typeof parsed.highlightLosses === 'boolean'
            ? parsed.highlightLosses
            : fallback.highlightLosses,
        compactTable:
          typeof parsed.compactTable === 'boolean'
            ? parsed.compactTable
            : fallback.compactTable,
      };
    } catch {
      return fallback;
    }
  };

export const storeProfitReportVisualSettings = (
  settings: ProfitReportVisualSettings,
) => {
  try {
    window.localStorage.setItem(
      profitReportVisualStorageKey,
      JSON.stringify(settings),
    );
  } catch {
    // Ignore localStorage write errors.
  }
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const formatProfitMarginPct = (value: number | null) =>
  value == null ? '—' : `${value.toFixed(1)}%`;

export const isProfitLossRow = (row: ProfitMarginRow) =>
  row.profit < 0 || (row.marginPct != null && row.marginPct < 0);

export const isProfitLossSummary = (summary: ProfitMarginSummary) =>
  summary.profit < 0 ||
  (summary.marginPct != null && summary.marginPct < 0);

export const chartValueForRow = (
  row: ProfitMarginRow,
  metric: ProfitReportChartMetric,
) => {
  if (metric === 'quantity') return row.quantity;
  if (metric === 'revenue') return row.revenue;
  return row.profit;
};

export const filterProfitMarginRows = (
  rows: ProfitMarginRow[],
  filters: ProfitReportRowFilters,
) => {
  const search = filters.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (search && !row.name.toLowerCase().includes(search))
      return false;
    if (filters.type !== 'all' && row.type !== filters.type)
      return false;
    if (filters.margin === 'loss' && !isProfitLossRow(row))
      return false;
    if (filters.margin === 'unknown' && row.costKnown) return false;
    return true;
  });
};

export const sortProfitMarginRows = (
  rows: ProfitMarginRow[],
  sort: ProfitReportRowSort,
) => {
  if (sort === 'default') return rows;
  const copy = [...rows];
  copy.sort((left, right) => {
    if (sort === 'name') return left.name.localeCompare(right.name);
    if (sort === 'quantity') return right.quantity - left.quantity;
    if (sort === 'profit') return right.profit - left.profit;
    const leftMargin = left.marginPct ?? -Infinity;
    const rightMargin = right.marginPct ?? -Infinity;
    return rightMargin - leftMargin;
  });
  return copy;
};

export const summarizeProfitMarginRows = (
  rows: ProfitMarginRow[],
): ProfitMarginSummary => {
  const quantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const cost = roundMoney(
    rows.reduce((sum, row) => sum + row.cost, 0),
  );
  const revenue = roundMoney(
    rows.reduce((sum, row) => sum + row.revenue, 0),
  );
  const profit = roundMoney(
    rows.reduce((sum, row) => sum + row.profit, 0),
  );
  const costKnown = rows.every((row) => row.costKnown);
  const marginPct =
    costKnown && revenue > 0
      ? roundMoney((profit / revenue) * 100)
      : null;
  return {
    count: rows.length,
    quantity,
    cost,
    revenue,
    profit,
    marginPct,
    costKnown,
  };
};

export const getProfitMarginNameGroupId = (name: string) =>
  `name:${name.trim().toLowerCase()}`;

export const groupProfitMarginRowsByName = (
  rows: ProfitMarginRow[],
): ProfitMarginNameGroup[] => {
  const order: string[] = [];
  const groups = new Map<string, ProfitMarginRow[]>();

  rows.forEach((row) => {
    const id = getProfitMarginNameGroupId(row.name);
    const existing = groups.get(id);
    if (existing) {
      existing.push(row);
      return;
    }
    groups.set(id, [row]);
    order.push(id);
  });

  return order.map((id) => {
    const groupRows = groups.get(id) ?? [];
    const types = new Set(groupRows.map((row) => row.type));
    const type: ProfitMarginNameGroup['type'] =
      types.size === 1 ? (groupRows[0]?.type ?? 'product') : 'mixed';
    return {
      id,
      name: groupRows[0]?.name ?? '',
      type,
      rows: groupRows,
      summary: summarizeProfitMarginRows(groupRows),
    };
  });
};

export const sortProfitMarginGroups = (
  groups: ProfitMarginNameGroup[],
  sort: ProfitReportRowSort,
) => {
  const copy = [...groups];
  copy.sort((left, right) => {
    if (sort === 'name') return left.name.localeCompare(right.name);
    if (sort === 'quantity')
      return right.summary.quantity - left.summary.quantity;
    if (sort === 'profit')
      return right.summary.profit - left.summary.profit;
    const leftMargin = left.summary.marginPct ?? -Infinity;
    const rightMargin = right.summary.marginPct ?? -Infinity;
    if (rightMargin !== leftMargin) return rightMargin - leftMargin;
    if (right.summary.profit !== left.summary.profit) {
      return right.summary.profit - left.summary.profit;
    }
    return left.name.localeCompare(right.name);
  });
  return copy;
};

export const buildProfitChartRows = (
  rows: ProfitMarginRow[],
  metric: ProfitReportChartMetric,
  limit = profitReportLeadersLimit,
): ProfitChartRow[] => {
  const groups = groupProfitMarginRowsByName(rows);
  const ranked = groups
    .map((group) => {
      let value = group.summary.profit;
      if (metric === 'quantity') value = group.summary.quantity;
      else if (metric === 'revenue') value = group.summary.revenue;
      return {
        key: group.id,
        name: group.name,
        type:
          group.type === 'service'
            ? ('service' as const)
            : ('product' as const),
        value,
      };
    })
    .sort((left, right) => {
      const diff = Math.abs(right.value) - Math.abs(left.value);
      if (diff !== 0) return diff;
      return left.name.localeCompare(right.name);
    })
    .slice(0, limit);
  const total = ranked.reduce(
    (sum, row) => sum + Math.abs(row.value),
    0,
  );
  return ranked.map((row) => ({
    ...row,
    sharePercent: total > 0 ? (Math.abs(row.value) / total) * 100 : 0,
  }));
};

export const buildProfitMixShare = (
  rows: ProfitMarginRow[],
  metric: ProfitReportChartMetric,
): ProfitMixShare => {
  let product = 0;
  let service = 0;
  rows.forEach((row) => {
    const value = chartValueForRow(row, metric);
    if (row.type === 'service') service += value;
    else product += value;
  });
  const productAbs = Math.abs(product);
  const serviceAbs = Math.abs(service);
  const total = productAbs + serviceAbs;
  return {
    product: roundMoney(product),
    service: roundMoney(service),
    productPct: total > 0 ? (productAbs / total) * 100 : 0,
    servicePct: total > 0 ? (serviceAbs / total) * 100 : 0,
  };
};

const exactNameMatches = <T extends { name: string }>(
  items: T[],
  name: string,
) => {
  const needle = name.trim().toLowerCase();
  if (!needle) return [];
  return items.filter(
    (item) => item.name.trim().toLowerCase() === needle,
  );
};

export const resolveProfitReportCatalogTarget = (
  row: Pick<ProfitMarginRow, 'name' | 'type' | 'serviceId'>,
  services: ServiceCatalogItem[],
): ProfitReportCatalogTarget | null => {
  if (row.type === 'service') {
    const byId = row.serviceId
      ? services.find((item) => item.id === row.serviceId)
      : undefined;
    if (byId) return { kind: 'service', service: byId };
    const matches = exactNameMatches(services, row.name);
    return matches.length === 1
      ? { kind: 'service', service: matches[0] }
      : null;
  }
  const name = row.name.trim();
  return name ? { kind: 'product', name: row.name } : null;
};

export const hasProfitReportRowFilters = (
  filters: ProfitReportRowFilters,
) =>
  Boolean(filters.search.trim()) ||
  filters.type !== 'all' ||
  filters.margin !== 'all' ||
  filters.sort !== 'default';

const toExcelSheetName = (value: string) =>
  value
    .replace(/[\\/?*[\]:]/g, ' ')
    .trim()
    .slice(0, 31) || 'Report';

const downloadWorkbook = (
  workbook: XLSX.WorkBook,
  filename: string,
) => {
  const buffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
  });
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

export const buildProfitReportFilename = (
  report: FinanceProfitReport,
) => {
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
    [
      labels.date,
      labels.category,
      labels.amount,
      labels.currency,
      labels.note,
    ],
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
