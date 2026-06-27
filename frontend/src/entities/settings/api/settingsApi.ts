import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import type { AppSettings, AppSettingsFormValues, PrintForm } from '../model/types';

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

export const updatePrintForms = async (printForms: PrintForm[]) => {
  try {
    const response = await apiClient.put<AppSettings>('/settings/print-forms', {
      printForms,
    });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
