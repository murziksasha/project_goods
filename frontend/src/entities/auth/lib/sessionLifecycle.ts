import axios from 'axios';
import { apiClient, setApiAuthToken } from '../../../shared/api/http';
import { queryClient } from '../../../shared/api/queryClient';
import {
  authTokenStorageKey,
  employeeSnapshotStorageKey,
} from '../api/authApi';

export type AuthSessionEvent =
  | { type: 'cleared' }
  | { type: 'token-changed'; token: string };

type AuthSessionListener = (event: AuthSessionEvent) => void;

const listeners = new Set<AuthSessionListener>();
let interceptorInstalled = false;

const isPublicAuthRequest = (url: string) =>
  /\/auth\/login(?:\?|$)/.test(url) || /\/auth\/invitations\//.test(url);

const emit = (event: AuthSessionEvent) => {
  listeners.forEach((listener) => listener(event));
};

export const subscribeAuthSession = (listener: AuthSessionListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const persistAuthToken = (token: string) => {
  window.localStorage.setItem(authTokenStorageKey, token);
  setApiAuthToken(token);
};

export const clearLocalAuthSession = () => {
  window.localStorage.removeItem(authTokenStorageKey);
  window.localStorage.removeItem(employeeSnapshotStorageKey);
  setApiAuthToken(null);
  queryClient.clear();
  emit({ type: 'cleared' });
};

export const installAuthSessionInterceptor = () => {
  if (interceptorInstalled) return;
  interceptorInstalled = true;

  apiClient.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        const url = `${error.config?.baseURL ?? ''}${error.config?.url ?? ''}`;
        if (!isPublicAuthRequest(url)) {
          clearLocalAuthSession();
        }
      }
      return Promise.reject(error);
    },
  );
};

installAuthSessionInterceptor();
