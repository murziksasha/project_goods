import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import type {
  Client,
  ClientFormValues,
  ClientHistory,
  ClientStatus,
} from '../model/types';

export const getClients = async (
  query = '',
  status: ClientStatus | 'all' = 'all',
) => {
  try {
    const response = await apiClient.get<Client[]>('/clients', {
      params:
        query || status !== 'all'
          ? {
              ...(query ? { query } : {}),
              ...(status !== 'all' ? { status } : {}),
            }
          : undefined,
    });

    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const createClient = async (payload: ClientFormValues) => {
  try {
    const response = await apiClient.post<Client>('/clients', payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const updateClient = async (
  clientId: string,
  payload: ClientFormValues,
) => {
  try {
    const response = await apiClient.put<Client>(`/clients/${clientId}`, payload);
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const deleteClient = async (clientId: string) => {
  try {
    await apiClient.delete(`/clients/${clientId}`);
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const getClientHistory = async (clientId: string) => {
  try {
    const response = await apiClient.get<ClientHistory>(
      `/clients/${clientId}/history`,
    );
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
