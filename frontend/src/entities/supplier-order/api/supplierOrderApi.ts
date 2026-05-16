import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import type { SupplierOrder, SupplierOrderFormValues } from '../model/types';

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

export const cancelSupplierOrder = async (supplierOrderId: string) => {
  try {
    const response = await apiClient.post<SupplierOrder>(`/supplier-orders/${supplierOrderId}/cancel`);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const takeOnChargeSupplierOrder = async (supplierOrderId: string) => {
  try {
    const response = await apiClient.post<SupplierOrder>(`/supplier-orders/${supplierOrderId}/take-on-charge`);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
