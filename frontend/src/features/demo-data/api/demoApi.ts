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
