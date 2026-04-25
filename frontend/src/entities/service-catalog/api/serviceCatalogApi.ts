import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import type {
  ServiceCatalogFormValues,
  ServiceCatalogItem,
} from '../model/types';

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

export const createServiceCatalogItem = async (
  payload: ServiceCatalogFormValues,
) => {
  try {
    const response = await apiClient.post<ServiceCatalogItem>(
      '/services',
      payload,
    );

    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const updateServiceCatalogItem = async (
  serviceId: string,
  payload: ServiceCatalogFormValues,
) => {
  try {
    const response = await apiClient.put<ServiceCatalogItem>(
      `/services/${serviceId}`,
      payload,
    );

    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const deleteServiceCatalogItem = async (serviceId: string) => {
  try {
    const response = await apiClient.delete<{ id: string }>(
      `/services/${serviceId}`,
    );

    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const archiveServiceCatalogItem = async (serviceId: string) => {
  try {
    const response = await apiClient.post<
      | { id: string; action: 'deleted' }
      | { action: 'deactivated'; service: ServiceCatalogItem }
    >(`/services/${serviceId}/archive`);

    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
