import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import type { ClientDevice, ClientDeviceFormValues } from '../model/types';

export const getClientDevices = async (query = '') => {
  try {
    const response = await apiClient.get<ClientDevice[]>('/client-devices', {
      params: query ? { query } : undefined,
    });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const createClientDevice = async (payload: ClientDeviceFormValues) => {
  try {
    const response = await apiClient.post<ClientDevice>('/client-devices', payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const updateClientDevice = async (deviceId: string, payload: ClientDeviceFormValues) => {
  try {
    const response = await apiClient.put<ClientDevice>(`/client-devices/${deviceId}`, payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const deleteClientDevice = async (deviceId: string) => {
  try {
    const response = await apiClient.delete<{ id: string }>(`/client-devices/${deviceId}`);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
