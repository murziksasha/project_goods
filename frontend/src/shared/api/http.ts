import axios from 'axios';

const authHeaderName = 'Authorization';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toUpperCase();
  const isReadRequest = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';

  if (typeof navigator !== 'undefined' && !navigator.onLine && !isReadRequest) {
    return Promise.reject(
      new Error('No internet connection. Read-only mode is active until connection is restored.'),
    );
  }

  return config;
});

export const setApiAuthToken = (token: string | null) => {
  if (token) {
    apiClient.defaults.headers.common[authHeaderName] = `Bearer ${token}`;
    return;
  }

  delete apiClient.defaults.headers.common[authHeaderName];
};

export const getApiErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.message ??
      error.message ??
      'Unexpected request error.'
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected request error.';
};
