import type { BoundedReportPeriod } from './report-types';

export type OrdersReportKind = 'repairs' | 'sales' | 'procurement';
export type OrdersReportMode = 'register' | 'summary';
export type OrdersReportGroupBy =
  | 'master'
  | 'status'
  | 'manager'
  | 'client'
  | 'supplier'
  | 'day'
  | 'week'
  | 'month'
  | 'product'
  | 'service';

export type OrdersReportFinanceFields = {
  knownCost?: number;
  knownProfit?: number;
  marginPct?: number | null;
  isIncomplete?: boolean;
  missingCostCount?: number;
};

export type OrdersRepairTableRow = OrdersReportFinanceFields & {
  id: string;
  recordNumber: string | null;
  clientId: string;
  clientName: string;
  clientPhone: string;
  deviceName: string;
  serialNumber: string;
  masterId: string | null;
  masterName: string;
  managerId: string | null;
  managerName: string;
  status: string;
  intakeDate: string;
  completedAt: string | null;
  issuedAt: string | null;
  turnaroundHours: number | null;
  total: number;
  discount: number;
  paid: number;
  debt: number;
  servicesCount: number;
  productsCount: number;
};

export type OrdersSaleTableRow = OrdersReportFinanceFields & {
  id: string;
  recordNumber: string | null;
  clientId: string;
  clientName: string;
  managerId: string | null;
  managerName: string;
  status: string;
  saleDate: string;
  units: number;
  gross: number;
  discount: number;
  net: number;
  paid: number;
  paidCash: number;
  paidNonCash: number;
  returnCount: number;
  returnAmount: number;
};

export type OrdersProcurementTableRow = {
  id: string;
  displayNumber: string;
  orderBaseId: string;
  supplierId: string;
  supplierName: string;
  createdAt: string;
  deliveryDate: string;
  status: string;
  paymentStatus: string;
  receiptStatus: string;
  isOverdue: boolean;
  orderedUnits: number;
  receivedUnits: number;
  total: number;
  paid: number;
  outstanding: number;
  stockedAt: string | null;
  itemNames: string[];
};

export type OrdersReportRow =
  | OrdersRepairTableRow
  | OrdersSaleTableRow
  | OrdersProcurementTableRow;

export type OrdersReportGroup = OrdersReportFinanceFields & {
  key: string;
  label: string;
  field: OrdersReportGroupBy;
  level: 1 | 2;
  parentKey?: string | null;
  filters: Record<string, string>;
  count: number;
  total: number;
  paid: number;
  debt: number;
  units?: number;
  avgTurnaroundHours: number | null;
  children?: OrdersReportGroup[];
};

export type OrdersReportTableResponse<Row = OrdersReportRow> = {
  generatedAt: string;
  timeZone: string;
  period: { key: string; dateFrom: string | null; dateTo: string | null };
  mode: OrdersReportMode;
  groupBy: OrdersReportGroupBy[];
  items: Row[];
  groups: OrdersReportGroup[];
  grandTotal: OrdersReportGroup;
  total: number;
  page: number;
  pageSize: number;
  nextCursor: string | null;
  coverage: {
    coldSalesPurgedExist?: boolean;
    warnings: string[];
    warningItems?: Array<{ code: string; count?: number }>;
  };
  supplierOptions?: Array<{ id: string; name: string }>;
};

export type OrdersReportTableParams = {
  period?: BoundedReportPeriod | string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  masterId?: string;
  managerId?: string;
  clientId?: string;
  q?: string;
  supplierId?: string;
  lineKind?: string;
  lineName?: string;
  paymentMethod?: string;
  unpaidOnly?: boolean;
  overdueOnly?: boolean;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  mode?: OrdersReportMode;
  groupBy?: string;
  cursor?: string;
};
