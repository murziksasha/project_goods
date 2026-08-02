import { afterEach, describe, expect, it } from 'vitest';
import {
  companySettingsStorageKey,
  readCachedCompanySettings,
  readCachedServiceName,
  serviceNameStorageKey,
  writeCachedCompanySettings,
  writeCachedServiceName,
} from './companySettingsCache';

afterEach(() => {
  window.localStorage.clear();
});

describe('companySettingsCache', () => {
  it('returns null when empty', () => {
    expect(readCachedCompanySettings()).toBeNull();
    expect(readCachedServiceName()).toBeNull();
  });

  it('writes and reads company settings', () => {
    writeCachedCompanySettings({
      serviceName: '  Desk Service  ',
      company: ' Desk Co ',
      companyAddress: ' Addr ',
      companyId: ' 123 ',
      companyIban: ' UA00 ',
      companyEmail: ' a@b.c ',
      companySite: ' example.com ',
    });

    expect(readCachedCompanySettings()).toEqual({
      serviceName: 'Desk Service',
      company: 'Desk Co',
      companyAddress: 'Addr',
      companyId: '123',
      companyIban: 'UA00',
      companyEmail: 'a@b.c',
      companySite: 'example.com',
    });
    expect(readCachedServiceName()).toBe('Desk Service');
    expect(window.localStorage.getItem(serviceNameStorageKey)).toBe('Desk Service');
  });

  it('migrates legacy service-name key', () => {
    window.localStorage.setItem(serviceNameStorageKey, 'Legacy Name');
    expect(readCachedCompanySettings()).toEqual({
      serviceName: 'Legacy Name',
      company: '',
      companyAddress: '',
      companyId: '',
      companyIban: '',
      companyEmail: '',
      companySite: '',
    });
  });

  it('writeCachedServiceName preserves other company fields', () => {
    writeCachedCompanySettings({
      serviceName: 'Old',
      company: 'Co',
      companyAddress: 'A',
      companyId: '1',
      companyIban: 'I',
      companyEmail: 'e@x.com',
      companySite: 's.com',
    });
    writeCachedServiceName('New Header');
    expect(readCachedCompanySettings()?.company).toBe('Co');
    expect(readCachedServiceName()).toBe('New Header');
  });

  it('removes cache when clearing essential names', () => {
    writeCachedCompanySettings({
      serviceName: 'Desk',
      company: 'Co',
      companyAddress: '',
      companyId: '',
      companyIban: '',
      companyEmail: '',
      companySite: '',
    });
    writeCachedCompanySettings({
      serviceName: '  ',
      company: '',
      companyAddress: '',
      companyId: '',
      companyIban: '',
      companyEmail: '',
      companySite: '',
    });
    expect(window.localStorage.getItem(companySettingsStorageKey)).toBeNull();
    expect(readCachedCompanySettings()).toBeNull();
  });
});
