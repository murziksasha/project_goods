import { QueryClient } from '@tanstack/react-query';

export const queryKeys = {
  products: ['products'] as const,
  sales: ['sales'] as const,
  salesList: (params: Record<string, unknown> = {}) =>
    ['sales', params] as const,
  saleDetail: (saleId: string) => ['saleDetail', saleId] as const,
  clientDevices: ['clientDevices'] as const,
  services: ['services'] as const,
  clients: ['clients'] as const,
  clientHistory: (clientId: string) => ['clientHistory', clientId] as const,
  catalogProducts: ['catalogProducts'] as const,
  employees: ['employees'] as const,
  suppliers: ['suppliers'] as const,
  settings: ['settings'] as const,
  supplierOrders: ['supplierOrders'] as const,
  warehouseSettings: ['warehouseSettings'] as const,
  financeCashboxes: ['financeCashboxes'] as const,
  financeAllCashboxes: ['financeCashboxes', 'all'] as const,
  financeCurrencies: ['financeCurrencies'] as const,
  financeCategories: ['financeCategories'] as const,
  financeTransactions: ['financeTransactions'] as const,
  financeTransactionsList: (params: Record<string, unknown> = {}) =>
    ['financeTransactions', params] as const,
  financeReport: ['financeReport'] as const,
  financeProfitReport: (params: Record<string, unknown> = {}) =>
    ['financeProfitReport', params] as const,
  financeSupplierOrdersQueue: ['financeSupplierOrdersQueue'] as const,
  financeSettings: ['financeSettings'] as const,
  financePolicy: ['financePolicy'] as const,
  financePolicyHistoryRoot: ['financePolicyHistory'] as const,
  financePolicyHistory: (params: Record<string, unknown> = {}) =>
    ['financePolicyHistory', params] as const,
  marketRates: ['marketRates'] as const,
  weatherForecast: ['weatherForecast'] as const,
  dashboardAnalytics: (params: Record<string, unknown> = {}) =>
    ['dashboardAnalytics', params] as const,
  warehouseReportRoot: ['warehouseReport'] as const,
  warehouseReport: (params: Record<string, unknown> = {}) =>
    ['warehouseReport', params] as const,
  warehouseReportDetails: (params: Record<string, unknown> = {}) =>
    ['warehouseReport', 'details', params] as const,
  ordersRepairsReportRoot: ['ordersRepairsReport'] as const,
  ordersRepairsReport: (params: Record<string, unknown> = {}) =>
    ['ordersRepairsReport', params] as const,
  ordersRepairsDetails: (params: Record<string, unknown> = {}) =>
    ['ordersRepairsReport', 'details', params] as const,
  ordersSalesReportRoot: ['ordersSalesReport'] as const,
  ordersSalesReport: (params: Record<string, unknown> = {}) =>
    ['ordersSalesReport', params] as const,
  ordersSalesDetails: (params: Record<string, unknown> = {}) =>
    ['ordersSalesReport', 'details', params] as const,
  ordersProcurementReportRoot: ['ordersProcurementReport'] as const,
  ordersProcurementReport: (params: Record<string, unknown> = {}) =>
    ['ordersProcurementReport', params] as const,
  ordersProcurementDetails: (params: Record<string, unknown> = {}) =>
    ['ordersProcurementReport', 'details', params] as const,
  cashboxesReportRoot: ['cashboxesReport'] as const,
  cashboxesReport: (params: Record<string, unknown> = {}) =>
    ['cashboxesReport', params] as const,
  cashboxesReportDetails: (params: Record<string, unknown> = {}) =>
    ['cashboxesReport', 'details', params] as const,
  financeProfitReportDetails: (params: Record<string, unknown> = {}) =>
    ['financeProfitReport', 'details', params] as const,
  ordersReportsTableRoot: ['ordersReportsTable'] as const,
  ordersReportsTable: (kind: string, params: Record<string, unknown> = {}) =>
    ['ordersReportsTable', kind, params] as const,
  scenariosRoot: ['scenarios'] as const,
  scenarios: (domain?: string) =>
    (domain ? (['scenarios', domain] as const) : (['scenarios'] as const)),
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Base default; entity hooks override (settings/catalog longer, stock shorter).
      staleTime: 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});
