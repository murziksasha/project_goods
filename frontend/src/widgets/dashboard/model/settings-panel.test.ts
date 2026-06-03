import { describe, expect, it, vi } from 'vitest';
import { createDefaultSettingsForm } from '../../../entities/settings/model/printForms';
import {
  demoPrintValues,
  getCompanyValidation,
  getSettingsPreviewValues,
  getStoredSettingsTab,
  settingsTabStorageKey,
} from './settings-panel';

describe('settings panel model', () => {
  it('validates required and optional company fields', () => {
    expect(
      getCompanyValidation({
        company: 'Service',
        companyAddress: '',
        companyId: '',
        companyIban: '',
      }),
    ).toMatchObject({
      isCompanyNameValid: true,
      isCompanyAddressValid: true,
      isCompanyIdValid: true,
      isCompanyIbanValid: true,
      hasInvalidCompanyFields: false,
    });

    expect(
      getCompanyValidation({
        company: 'S',
        companyAddress: 'Kyiv',
        companyId: 'bad',
        companyIban: 'bad-iban',
      }),
    ).toMatchObject({
      isCompanyNameValid: false,
      isCompanyAddressValid: false,
      isCompanyIdValid: false,
      isCompanyIbanValid: false,
      hasInvalidCompanyFields: true,
    });
  });

  it('uses company fields in preview values and falls back to demo data', () => {
    const form = {
      ...createDefaultSettingsForm(),
      serviceName: 'Desk Service',
      companyAddress: 'Kyiv, Main street 1',
      companyId: '12345678',
      companyIban: 'UA123456789123456789123456789',
      companyEmail: 'billing@example.com',
      companySite: 'https://example.com',
    };

    expect(getSettingsPreviewValues(form)).toMatchObject({
      company: 'Desk Service',
      company_address: 'Kyiv, Main street 1',
      company_id: '12345678',
      company_iban: 'UA123456789123456789123456789',
      company_email: 'billing@example.com',
      company_site: 'https://example.com',
      orderNumber: demoPrintValues.orderNumber,
    });
  });

  it('reads a stored tab and falls back for invalid values', () => {
    window.localStorage.setItem(settingsTabStorageKey, 'finance');
    expect(getStoredSettingsTab()).toBe('finance');

    window.localStorage.setItem(settingsTabStorageKey, 'unknown');
    expect(getStoredSettingsTab()).toBe('company');
  });

  it('falls back when localStorage is unavailable', () => {
    const spy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });

    expect(getStoredSettingsTab()).toBe('company');

    spy.mockRestore();
  });
});
