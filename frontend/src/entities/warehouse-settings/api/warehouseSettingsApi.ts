import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import type {
  WarehouseSettings,
  WarehouseSettingsPayload,
} from '../model/types';

export const getWarehouseSettings = async () => {
  try {
    const response = await apiClient.get<WarehouseSettings>(
      '/warehouse-settings',
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const updateWarehouseSettings = async (
  payload: WarehouseSettingsPayload,
) => {
  try {
    const response = await apiClient.put<WarehouseSettings>(
      '/warehouse-settings',
      payload,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
