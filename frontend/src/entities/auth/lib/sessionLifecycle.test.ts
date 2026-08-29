// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  authTokenStorageKey,
  employeeSnapshotStorageKey,
} from '../api/authApi';
import {
  clearLocalAuthSession,
  persistAuthToken,
  subscribeAuthSession,
} from './sessionLifecycle';
import { apiClient } from '../../../shared/api/http';

afterEach(() => {
  window.localStorage.clear();
  delete apiClient.defaults.headers.common.Authorization;
});

describe('sessionLifecycle', () => {
  it('persistAuthToken writes localStorage and the axios header', () => {
    persistAuthToken('abc');
    expect(window.localStorage.getItem(authTokenStorageKey)).toBe('abc');
    expect(apiClient.defaults.headers.common.Authorization).toBe('Bearer abc');
  });

  it('clearLocalAuthSession drops token, snapshot, header, and notifies listeners', () => {
    persistAuthToken('abc');
    window.localStorage.setItem(employeeSnapshotStorageKey, '{"id":"1"}');
    const listener = vi.fn();
    const unsubscribe = subscribeAuthSession(listener);

    clearLocalAuthSession();

    expect(window.localStorage.getItem(authTokenStorageKey)).toBeNull();
    expect(window.localStorage.getItem(employeeSnapshotStorageKey)).toBeNull();
    expect(apiClient.defaults.headers.common.Authorization).toBeUndefined();
    expect(listener).toHaveBeenCalledWith({ type: 'cleared' });
    unsubscribe();
  });
});
