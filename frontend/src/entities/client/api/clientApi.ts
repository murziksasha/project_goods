import { apiClient, getApiErrorMessage } from '../../../shared/api/http';
import type {
  Client,
  ClientFormValues,
  ClientHistory,
  ClientImportReport,
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

export const mergeClients = async (
  targetClientId: string,
  sourceClientId: string,
) => {
  try {
    const response = await apiClient.post<{
      client: Client;
      removedClientId: string;
      movedSalesCount: number;
    }>('/clients/merge', {
      targetClientId,
      sourceClientId,
    });
    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const importClients = async (file: File) => {
  try {
    const response = await apiClient.post<ClientImportReport>(
      '/clients/import',
      file,
      {
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        timeout: 120000,
      },
    );

    return response.data;
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};

export const exportClients = async () => {
  try {
    const response = await apiClient.get<Blob>('/clients/export', {
      responseType: 'blob',
      timeout: 120000,
    });

    const downloadUrl = window.URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'clients.xls';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    throw new Error(getApiErrorMessage(error));
  }
};
