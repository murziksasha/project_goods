import axios from 'axios';
import { ApiRequestError } from '../api/http';

export const isAxiosRequestError = (error: unknown) =>
  axios.isAxiosError(error) || error instanceof ApiRequestError;

export const getRequestErrorStatus = (error: unknown): number | null => {
  if (error instanceof ApiRequestError) {
    return error.status;
  }

  if (!axios.isAxiosError(error)) {
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
  if (error instanceof ApiRequestError) {
    return !error.hasResponse || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED';
  }

  if (!axios.isAxiosError(error)) {
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

  if (
    error instanceof Error &&
    error.message.trim().toLowerCase() === 'session not found.'
  ) {
    return 'Session check failed. The app kept your workspace open; please retry the action.';
  }

  return error instanceof Error ? error.message : fallback;
};
