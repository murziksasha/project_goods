import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import type { Supplier, SupplierFormValues } from '../model/types';

export const getSuppliers = async (query = '') => {
  try {
    const response = await apiClient.get<Supplier[]>('/suppliers', {
      params: query ? { query } : undefined,
    });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const createSupplier = async (payload: SupplierFormValues) => {
  try {
    const response = await apiClient.post<Supplier>('/suppliers', payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const updateSupplier = async (supplierId: string, payload: SupplierFormValues) => {
  try {
    const response = await apiClient.put<Supplier>(`/suppliers/${supplierId}`, payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
