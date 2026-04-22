import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import type { AppSettings, AppSettingsFormValues } from '../model/types';

export const getSettings = async () => {
  try {
    const response = await apiClient.get<AppSettings>('/settings');
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const updateSettings = async (payload: AppSettingsFormValues) => {
  try {
    const response = await apiClient.put<AppSettings>('/settings', payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
