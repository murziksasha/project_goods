import axios from 'axios';

export const isAxiosRequestError = (error: unknown) => axios.isAxiosError(error);

export const getRequestErrorStatus = (error: unknown): number | null => {
  if (!isAxiosRequestError(error)) {
    return null;
  }

  return error.response?.status ?? null;
};

export const isUnauthorizedRequestError = (error: unknown) => {
  const status = getRequestErrorStatus(error);
  return status === 401 || status === 403;
};

export const isConflictRequestError = (error: unknown) => getRequestErrorStatus(error) === 409;

export const isNetworkRequestError = (error: unknown) => {
  if (!isAxiosRequestError(error)) {
    return false;
  }

  return !error.response || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED';
};

export const getRequestErrorMessage = (
  error: unknown,
  fallback: string,
) => {
  if (isNetworkRequestError(error)) {
    return 'No internet connection. Read-only mode is active until connection is restored.';
  }

  return error instanceof Error ? error.message : fallback;
};
