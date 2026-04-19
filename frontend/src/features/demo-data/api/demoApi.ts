import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import type { SeedResponse } from '../../../entities/sale/model/types';

export const seedDemoData = async () => {
  try {
    const response = await apiClient.post<SeedResponse>('/demo/seed');
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
