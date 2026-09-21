import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../shared/api/queryClient';
import {
  apiClient,
  getApiErrorMessage,
} from '../../../shared/api/http';
import type {
  Supplier,
  SupplierFormValues,
  SupplierImportReport,
} from '../model/types';

export const useSuppliersQuery = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.suppliers,
    queryFn: () => getSuppliers(),
    enabled,
    staleTime: 2 * 60_000,
  });

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
    const response = await apiClient.post<Supplier>(
      '/suppliers',
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const updateSupplier = async (
  supplierId: string,
  payload: SupplierFormValues,
) => {
  try {
    const response = await apiClient.put<Supplier>(
      `/suppliers/${supplierId}`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const mergeSuppliers = async (
  targetSupplierId: string,
  sourceSupplierId: string,
  draftNote?: string,
) => {
  try {
    const response = await apiClient.post<{
      supplier: Supplier;
      removedSupplierId: string;
      movedSupplierOrdersCount: number;
    }>('/suppliers/merge', {
      targetSupplierId,
      sourceSupplierId,
      draftNote,
    });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const importSuppliers = async (file: File) => {
  try {
    const response = await apiClient.post<SupplierImportReport>(
      '/suppliers/import',
      file,
      {
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        timeout: 120000,
      },
    );

    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const exportSuppliers = async () => {
  try {
    const response = await apiClient.get<Blob>('/suppliers/export', {
      responseType: 'blob',
      timeout: 120000,
    });

    const downloadUrl = window.URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'suppliers.xls';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
