import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import type { SeedResponse } from '../../../entities/sale/model/types';

export type DemoSeedKind = 'all' | 'sales' | 'repairs';

const getDemoSeedUrl = (kind: DemoSeedKind) => {
  if (kind === 'sales') {
    return '/demo/seed/sales';
  }

  if (kind === 'repairs') {
    return '/demo/seed/repairs';
  }

  return '/demo/seed';
};

export const seedDemoData = async (kind: DemoSeedKind = 'all') => {
  try {
    const response = await apiClient.post<SeedResponse>(getDemoSeedUrl(kind));
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const eraseAllData = async () => {
  try {
    const response = await apiClient.post<SeedResponse>('/demo/erase');
    return response.data;
  } catch (error) {
    const message = getApiErrorMessage(error);

    if (message.toLowerCase().includes('route not found')) {
      try {
        const fallbackResponse = await apiClient.post<SeedResponse>(
          '/demo/seed?kind=erase',
        );
        return fallbackResponse.data;
      } catch (fallbackError) {
        throw new Error(getApiErrorMessage(fallbackError));
      }
    }

    throw new Error(message);
  }
};
