import axios from 'axios';
import { ApiRequestError } from '../api/http';
import i18n from '../i18n/config';

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
    return i18n.t('errors.noInternet');
  }

  if (
    error instanceof Error &&
    error.message.trim().toLowerCase() === 'session not found.'
  ) {
    return i18n.t('errors.sessionCheckFailed');
  }

  if (error instanceof Error && error.message.trim().toLowerCase().includes('session')) {
    // generic session messages
    return i18n.t('errors.sessionExpired');
  }

  return error instanceof Error ? error.message : fallback;
};
