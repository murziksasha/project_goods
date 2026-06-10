import axios from 'axios';

const authHeaderName = 'Authorization';

export class ApiRequestError extends Error {
  status: number | null;
  code?: string;
  hasResponse: boolean;

  constructor(
    message: string,
    options: { status?: number | null; code?: string; hasResponse?: boolean } = {},
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = options.status ?? null;
    this.code = options.code;
    this.hasResponse = options.hasResponse ?? false;
  }
}

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

export const createApiRequestError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    return new ApiRequestError(
      error.response?.data?.message ??
      error.message ??
      'Unexpected request error.',
      {
        code: error.code,
        hasResponse: Boolean(error.response),
        status: error.response?.status ?? null,
      },
    );
  }

  if (error instanceof Error) {
    return new ApiRequestError(error.message);
  }

  return new ApiRequestError('Unexpected request error.');
};

export const getApiErrorMessage = (error: unknown) => {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  return createApiRequestError(error).message;
};
