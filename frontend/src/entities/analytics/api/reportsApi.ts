import { useQuery } from '@tanstack/react-query';
import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import { queryKeys } from '../../../shared/api/queryClient';
import type {
  OrdersProcurementDetailRow,
  OrdersProcurementReportResponse,
  OrdersRepairDetailRow,
  OrdersRepairsReportResponse,
  OrdersReportDetailsParams,
  OrdersReportParams,
  OrdersSaleDetailRow,
  OrdersSalesReportResponse,
  PaginatedDetailsResponse,
  WarehouseReportDetailsParams,
  WarehouseReportDetailsResponse,
  WarehouseReportParams,
  WarehouseReportResponse,
} from '../model/report-types';

const cleanParams = (params: Record<string, unknown>) => {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    }
  }
  return out;
};

export const getWarehouseReport = async (
  params: WarehouseReportParams = {},
): Promise<WarehouseReportResponse> => {
  try {
    const response = await apiClient.get<WarehouseReportResponse>(
      '/reports/warehouse',
      { params: cleanParams(params) },
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const getWarehouseReportDetails = async (
  params: WarehouseReportDetailsParams = {},
): Promise<WarehouseReportDetailsResponse> => {
  try {
    const response = await apiClient.get<WarehouseReportDetailsResponse>(
      '/reports/warehouse/details',
      { params: cleanParams(params) },
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const getOrdersRepairsReport = async (
  params: OrdersReportParams = {},
): Promise<OrdersRepairsReportResponse> => {
  try {
    const response = await apiClient.get<OrdersRepairsReportResponse>(
      '/reports/orders/repairs',
      { params: cleanParams(params) },
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const getOrdersRepairsDetails = async (
  params: OrdersReportDetailsParams = {},
): Promise<PaginatedDetailsResponse<OrdersRepairDetailRow>> => {
  try {
    const response = await apiClient.get<
      PaginatedDetailsResponse<OrdersRepairDetailRow>
    >('/reports/orders/repairs/details', { params: cleanParams(params) });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const getOrdersSalesReport = async (
  params: OrdersReportParams = {},
): Promise<OrdersSalesReportResponse> => {
  try {
    const response = await apiClient.get<OrdersSalesReportResponse>(
      '/reports/orders/sales',
      { params: cleanParams(params) },
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const getOrdersSalesDetails = async (
  params: OrdersReportDetailsParams = {},
): Promise<PaginatedDetailsResponse<OrdersSaleDetailRow>> => {
  try {
    const response = await apiClient.get<
      PaginatedDetailsResponse<OrdersSaleDetailRow>
    >('/reports/orders/sales/details', { params: cleanParams(params) });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const getOrdersProcurementReport = async (
  params: OrdersReportParams = {},
): Promise<OrdersProcurementReportResponse> => {
  try {
    const response = await apiClient.get<OrdersProcurementReportResponse>(
      '/reports/orders/procurement',
      { params: cleanParams(params) },
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const getOrdersProcurementDetails = async (
  params: OrdersReportDetailsParams = {},
): Promise<PaginatedDetailsResponse<OrdersProcurementDetailRow>> => {
  try {
    const response = await apiClient.get<
      PaginatedDetailsResponse<OrdersProcurementDetailRow>
    >('/reports/orders/procurement/details', { params: cleanParams(params) });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const useWarehouseReportQuery = (
  params: WarehouseReportParams,
  options: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: queryKeys.warehouseReport(cleanParams(params)),
    queryFn: () => getWarehouseReport(params),
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });

export const useWarehouseReportDetailsQuery = (
  params: WarehouseReportDetailsParams,
  options: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: queryKeys.warehouseReportDetails(cleanParams(params)),
    queryFn: () => getWarehouseReportDetails(params),
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });

export const useOrdersRepairsReportQuery = (
  params: OrdersReportParams,
  options: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: queryKeys.ordersRepairsReport(cleanParams(params)),
    queryFn: () => getOrdersRepairsReport(params),
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });

export const useOrdersRepairsDetailsQuery = (
  params: OrdersReportDetailsParams,
  options: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: queryKeys.ordersRepairsDetails(cleanParams(params)),
    queryFn: () => getOrdersRepairsDetails(params),
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });

export const useOrdersSalesReportQuery = (
  params: OrdersReportParams,
  options: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: queryKeys.ordersSalesReport(cleanParams(params)),
    queryFn: () => getOrdersSalesReport(params),
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });

export const useOrdersSalesDetailsQuery = (
  params: OrdersReportDetailsParams,
  options: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: queryKeys.ordersSalesDetails(cleanParams(params)),
    queryFn: () => getOrdersSalesDetails(params),
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });

export const useOrdersProcurementReportQuery = (
  params: OrdersReportParams,
  options: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: queryKeys.ordersProcurementReport(cleanParams(params)),
    queryFn: () => getOrdersProcurementReport(params),
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });

export const useOrdersProcurementDetailsQuery = (
  params: OrdersReportDetailsParams,
  options: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: queryKeys.ordersProcurementDetails(cleanParams(params)),
    queryFn: () => getOrdersProcurementDetails(params),
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });
