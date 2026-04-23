import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import type { ServiceCatalogItem } from '../model/types';

export const getServiceCatalogItems = async (query = '') => {
  try {
    const response = await apiClient.get<ServiceCatalogItem[]>('/services', {
      params: query ? { query } : undefined,
    });

    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
