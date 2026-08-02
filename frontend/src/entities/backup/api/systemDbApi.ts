import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import type {
  DatabaseHealth,
  DatabaseStorageStats,
} from '../model/dbReportTypes';

export const getDbStats = async () => {
  try {
    const response = await apiClient.get<DatabaseStorageStats>(
      '/system/db-stats',
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const getDbHealth = async () => {
  try {
    const response = await apiClient.get<DatabaseHealth>('/system/db-health');
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
