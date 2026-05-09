import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import axios from 'axios';
import type { CatalogProduct, CatalogProductFormValues } from '../model/types';

let hasLoggedCatalogProducts404Warning = false;

export const getCatalogProducts = async (query = '') => {
  try {
    const response = await apiClient.get<CatalogProduct[]>('/catalog-products', {
      params: query ? { query } : undefined,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      if (import.meta.env.DEV && !hasLoggedCatalogProducts404Warning) {
        hasLoggedCatalogProducts404Warning = true;
        console.warn(
          '[catalog-products] GET /catalog-products returned 404. Falling back to empty list.',
        );
      }
      return [];
    }
    throw new Error(getApiErrorMessage(error));
  }
};

export const updateCatalogProduct = async (
  catalogProductId: string,
  payload: CatalogProductFormValues,
) => {
  try {
    const response = await apiClient.put<CatalogProduct>(
      `/catalog-products/${catalogProductId}`,
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const deleteCatalogProduct = async (catalogProductId: string) => {
  try {
    const response = await apiClient.delete<{ id: string }>(`/catalog-products/${catalogProductId}`);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
