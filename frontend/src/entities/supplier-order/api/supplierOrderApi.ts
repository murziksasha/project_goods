import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient, queryKeys } from '../../../shared/api/queryClient';
import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import type {
  SupplierOrder,
  SupplierOrderFormValues,
  TakeOnChargeResult,
} from '../model/types';

export const invalidateSupplierOrderQueries = async (options?: {
  includeProducts?: boolean;
}) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.supplierOrders }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.financeSupplierOrdersQueue,
    }),
    ...(options?.includeProducts
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.products })]
      : []),
  ]);
};

export const getSupplierOrders = async (query = '') => {
  try {
    const response = await apiClient.get<SupplierOrder[]>('/supplier-orders', {
      params: query ? { query } : undefined,
    });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const createSupplierOrder = async (payload: SupplierOrderFormValues) => {
  try {
    const response = await apiClient.post<SupplierOrder>('/supplier-orders', payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const updateSupplierOrder = async (supplierOrderId: string, payload: SupplierOrderFormValues) => {
  try {
    const response = await apiClient.put<SupplierOrder>(`/supplier-orders/${supplierOrderId}`, payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const updateSupplierOrderFavorite = async (
  supplierOrderId: string,
  payload: { isFavorite: boolean },
) => {
  try {
    const response = await apiClient.patch<SupplierOrder>(
      `/supplier-orders/${supplierOrderId}/favorite`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const cancelSupplierOrder = async (supplierOrderId: string) => {
  try {
    const response = await apiClient.post<SupplierOrder>(`/supplier-orders/${supplierOrderId}/cancel`);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export type TakeOnChargePayload = {
  autoGenerateSerialNumbers?: boolean;
  serialNumbers?: string[];
  autoGenerateArticles?: boolean;
  articleBase?: string;
  itemIndex?: number;
  warehouseId?: string;
  locationId?: string;
};

export const takeOnChargeSupplierOrder = async (
  supplierOrderId: string,
  payload?: TakeOnChargePayload,
) => {
  try {
    const response = await apiClient.post<TakeOnChargeResult>(
      `/supplier-orders/${supplierOrderId}/take-on-charge`,
      payload ?? {},
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const useSupplierOrdersQuery = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.supplierOrders,
    queryFn: () => getSupplierOrders(),
    enabled,
  });

export const useCreateSupplierOrderMutation = () =>
  useMutation({
    mutationFn: createSupplierOrder,
    onSuccess: async () => {
      await invalidateSupplierOrderQueries();
    },
  });

export const useUpdateSupplierOrderMutation = () =>
  useMutation({
    mutationFn: ({
      supplierOrderId,
      payload,
    }: {
      supplierOrderId: string;
      payload: SupplierOrderFormValues;
    }) => updateSupplierOrder(supplierOrderId, payload),
    onSuccess: async () => {
      await invalidateSupplierOrderQueries();
    },
  });

export const useUpdateSupplierOrderFavoriteMutation = () =>
  useMutation({
    mutationFn: ({
      supplierOrderId,
      payload,
    }: {
      supplierOrderId: string;
      payload: { isFavorite: boolean };
    }) => updateSupplierOrderFavorite(supplierOrderId, payload),
    onSuccess: async () => {
      await invalidateSupplierOrderQueries();
    },
  });

export const useCancelSupplierOrderMutation = () =>
  useMutation({
    mutationFn: cancelSupplierOrder,
    onSuccess: async () => {
      await invalidateSupplierOrderQueries();
    },
  });

export const useTakeOnChargeSupplierOrderMutation = () =>
  useMutation({
    mutationFn: ({
      supplierOrderId,
      payload,
    }: {
      supplierOrderId: string;
      payload?: TakeOnChargePayload;
    }) => takeOnChargeSupplierOrder(supplierOrderId, payload),
    onSuccess: async () => {
      await invalidateSupplierOrderQueries({ includeProducts: true });
    },
  });
