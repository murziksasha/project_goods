import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import type { Product, ProductFormValues } from '../model/types';

export const getProducts = async (query = '') => {
  try {
    const response = await apiClient.get<Product[]>('/products', {
      params: query ? { query } : undefined,
    });

    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const createProduct = async (payload: ProductFormValues) => {
  try {
    const response = await apiClient.post<Product>('/products', payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const updateProduct = async (
  productId: string,
  payload: ProductFormValues,
) => {
  try {
    const response = await apiClient.put<Product>(
      `/products/${productId}`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const deleteProduct = async (productId: string) => {
  try {
    await apiClient.delete(`/products/${productId}`);
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const archiveProduct = async (productId: string) => {
  try {
    const response = await apiClient.post<
      { id: string; action: 'deleted' } | { action: 'deactivated'; product: Product }
    >(`/products/${productId}/archive`);

    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const exportProducts = async () => {
  try {
    const response = await apiClient.get<Blob>('/products/export', {
      responseType: 'blob',
    });

    const downloadUrl = window.URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'products.xlsx';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
