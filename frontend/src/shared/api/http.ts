import axios from 'axios';

const authHeaderName = 'Authorization';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 10000,
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
