import { useQuery } from '@tanstack/react-query';
import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import { queryKeys } from '../../../shared/api/queryClient';
import type { StatsPeriod } from '../../../widgets/dashboard/model/stats-period';
import type { AnalyticsDateRange } from '../../../widgets/dashboard/model/analytics-date-range';

export type AnalyticsChartSnapshot = {
  year: number;
  label: string;
  detailLabel: string;
  values: number[];
  total: number;
  color: string;
};

export type DashboardAnalyticsResponse = {
  detailLabel: string;
  axisLabels: string[];
  revenueSnapshots: AnalyticsChartSnapshot[];
  orderSnapshots: AnalyticsChartSnapshot[];
  salesCountSnapshots: AnalyticsChartSnapshot[];
  revenueChartMax: number;
  ordersChartMax: number;
  hasRevenueData: boolean;
  hasOrdersData: boolean;
  metrics: {
    salesCount: number;
    ordersCount: number;
    revenue: number;
    averageTicket: number;
    paidAmount: number;
    remainingAmount: number;
    paymentCoverage: number;
    openOrders: number;
    closedOrders: number;
    unpaidOrders: number;
    todaySales: number;
    todayOrders: number;
    todayRevenue: number;
  };
  stock: {
    productCount: number;
    totalStock: number;
    freeStock: number;
    reservedStock: number;
    stockValue: number;
    outOfStockProducts: number;
    lowStockProducts: number;
  };
  generatedAt: string;
};

export type DashboardAnalyticsParams = {
  period?: StatsPeriod;
  dateFrom?: string;
  dateTo?: string;
};

export const buildAnalyticsQuery = (params: DashboardAnalyticsParams = {}) => {
  const query: Record<string, string> = {};
  if (params.period) query.period = params.period;
  if (params.dateFrom) query.dateFrom = params.dateFrom;
  if (params.dateTo) query.dateTo = params.dateTo;
  return query;
};

export const getDashboardAnalytics = async (params: DashboardAnalyticsParams = {}) => {
  try {
    const response = await apiClient.get<DashboardAnalyticsResponse>('/analytics/dashboard', {
      params: buildAnalyticsQuery(params),
    });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const useDashboardAnalyticsQuery = (
  enabled: boolean,
  statsPeriod: StatsPeriod,
  analyticsDateRange: AnalyticsDateRange | null,
) => {
  const params: DashboardAnalyticsParams = {
    period: statsPeriod,
    ...(analyticsDateRange?.dateFrom ? { dateFrom: analyticsDateRange.dateFrom } : {}),
    ...(analyticsDateRange?.dateTo ? { dateTo: analyticsDateRange.dateTo } : {}),
  };

  return useQuery({
    queryKey: queryKeys.dashboardAnalytics(params),
    queryFn: () => getDashboardAnalytics(params),
    enabled,
    staleTime: 30_000,
    refetchInterval: enabled ? 60_000 : false,
  });
};
