import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient, queryKeys } from '../../../shared/api/queryClient';
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

export const useWarehouseSettingsQuery = () =>
  useQuery({
    queryKey: queryKeys.warehouseSettings,
    queryFn: getWarehouseSettings,
  });

export const useUpdateWarehouseSettingsMutation = () =>
  useMutation({
    mutationFn: updateWarehouseSettings,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.warehouseSettings });
    },
  });

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
