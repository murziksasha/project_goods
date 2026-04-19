import axios from 'axios';
import type {
  Client,
  ClientHistory,
  ClientFormValues,
  Product,
  ProductFormValues,
  Sale,
  SaleFormValues,
  SeedResponse,
} from './types';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 10000,
});

const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.message ??
      error.message ??
      'Unexpected request error.'
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected request error.';
};

export const getProducts = async (query = '') => {
  try {
    const response = await apiClient.get<Product[]>('/products', {
      params: query ? { query } : undefined,
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const createProduct = async (payload: ProductFormValues) => {
  try {
    const response = await apiClient.post<Product>('/products', payload);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const updateProduct = async (productId: string, payload: ProductFormValues) => {
  try {
    const response = await apiClient.put<Product>(`/products/${productId}`, payload);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const deleteProduct = async (productId: string) => {
  try {
    await apiClient.delete(`/products/${productId}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const getClients = async (
  query = '',
  status: string | 'all' = 'all',
) => {
  try {
    const response = await apiClient.get<Client[]>('/clients', {
      params:
        query || status !== 'all'
          ? {
              ...(query ? { query } : {}),
              ...(status !== 'all' ? { status } : {}),
            }
          : undefined,
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const createClient = async (payload: ClientFormValues) => {
  try {
    const response = await apiClient.post<Client>('/clients', payload);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const updateClient = async (clientId: string, payload: ClientFormValues) => {
  try {
    const response = await apiClient.put<Client>(`/clients/${clientId}`, payload);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const deleteClient = async (clientId: string) => {
  try {
    await apiClient.delete(`/clients/${clientId}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const getClientHistory = async (clientId: string) => {
  try {
    const response = await apiClient.get<ClientHistory>(`/clients/${clientId}/history`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const getSales = async () => {
  try {
    const response = await apiClient.get<Sale[]>('/sales');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const createSale = async (payload: SaleFormValues) => {
  try {
    const response = await apiClient.post<{ sale: Sale; product: Product }>(
      '/sales',
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const updateSale = async (saleId: string, payload: SaleFormValues) => {
  try {
    const response = await apiClient.put<{ sale: Sale; product: Product }>(
      `/sales/${saleId}`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const deleteSale = async (saleId: string) => {
  try {
    const response = await apiClient.delete<{ id: string; restoredProductId: string }>(
      `/sales/${saleId}`,
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const seedDemoData = async () => {
  try {
    const response = await apiClient.post<SeedResponse>('/demo/seed');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
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
    throw new Error(getErrorMessage(error));
  }
};
