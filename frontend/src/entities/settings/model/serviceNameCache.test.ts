import { afterEach, describe, expect, it } from 'vitest';
import {
  readCachedServiceName,
  serviceNameStorageKey,
  writeCachedServiceName,
} from './serviceNameCache';

afterEach(() => {
  window.localStorage.clear();
});

describe('serviceNameCache (compat)', () => {
  it('returns null when empty', () => {
    expect(readCachedServiceName()).toBeNull();
  });

  it('writes and reads trimmed service name', () => {
    writeCachedServiceName('  Desk Service  ');
    expect(window.localStorage.getItem(serviceNameStorageKey)).toBe('Desk Service');
    expect(readCachedServiceName()).toBe('Desk Service');
  });

  it('removes cache when writing empty value', () => {
    writeCachedServiceName('Desk Service');
    writeCachedServiceName('   ');
    expect(window.localStorage.getItem(serviceNameStorageKey)).toBeNull();
    expect(readCachedServiceName()).toBeNull();
  });
});
