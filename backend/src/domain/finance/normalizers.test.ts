import { describe, expect, it } from 'vitest';
import {
  normalizeAmount,
  normalizeCurrency,
  normalizeDate,
  normalizeEnabledCurrencies,
  normalizeName,
  normalizeType,
} from './normalizers';

describe('finance normalizers', () => {
  it('normalizes scalar finance transaction values', () => {
    expect(normalizeName(' Cash ')).toBe('Cash');
    expect(normalizeAmount('10.239')).toBe(10.24);
    expect(normalizeAmount('0,01')).toBe(0.01);
    expect(normalizeCurrency('usd')).toBe('USD');
    expect(normalizeEnabledCurrencies({ UAH: true, USD: true })).toEqual({
      UAH: true,
      USD: true,
    });
    expect(normalizeEnabledCurrencies({ USD: false })).toEqual({
      UAH: true,
      USD: false,
    });
    expect(normalizeType('transfer')).toBe('transfer');
    expect(normalizeDate('2026-01-02').toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });

  it('rejects unsupported transaction values', () => {
    expect(() => normalizeAmount(0)).toThrow('Transaction amount must be greater than 0.');
    expect(() => normalizeAmount('1,2,3')).toThrow('Transaction amount must be greater than 0.');
    expect(() => normalizeCurrency('EU')).toThrow('Currency code must be 3-6 latin letters.');
    expect(() => normalizeEnabledCurrencies(null)).toThrow('Enabled currencies must be an object.');
    expect(() => normalizeEnabledCurrencies({ UAH: false })).toThrow('UAH currency cannot be disabled.');
    expect(() => normalizeType('refund')).toThrow('Unsupported transaction type.');
    expect(() => normalizeDate('bad')).toThrow('Invalid transaction date.');
  });
});
