import { describe, expect, it } from 'vitest';
import {
  formatPhoneForPrint,
  formatPhoneForDial,
  formatUkrainianPhone,
  isValidUkrainianPhone,
  normalizePhone,
} from './phoneFormatter';

describe('phoneFormatter', () => {
  it.each([
    ['+380635567090', '0635567090'],
    ['380635567090', '0635567090'],
    ['+38 (063) 556-70-90', '0635567090'],
    ['063 556 70 90', '0635567090'],
    ['0635567090', '0635567090'],
    [' +48 (123) 456-789 ', '+48123456789'],
    ['+386 40 123 456', '+38640123456'],
    ['48 123 456 789', '48123456789'],
    ['+38063', '+38063'],
    ['', ''],
    ['   ', ''],
  ])('formats %j as %j for dialing', (phone, expected) => {
    expect(formatPhoneForDial(phone)).toBe(expected);
  });

  it('formats 12-digit UA numbers into grouped output', () => {
    expect(formatUkrainianPhone('+380501234567')).toBe('50 123 45 67');
  });

  it('returns original value when number is too short', () => {
    expect(formatUkrainianPhone('12345')).toBe('12345');
  });

  it('validates known UA number formats', () => {
    expect(isValidUkrainianPhone('0635567090')).toBe(true);
    expect(isValidUkrainianPhone('+380635567090')).toBe(true);
    expect(isValidUkrainianPhone('80635567090')).toBe(true);
    expect(isValidUkrainianPhone('123')).toBe(false);
  });

  it('normalizes by stripping non-digit characters', () => {
    expect(normalizePhone('+38 (063) 556-70-90')).toBe('380635567090');
  });
});

describe('formatPhoneForPrint', () => {
  it.each([
    ['+380974122235', '097-412-22-35'],
    ['380974122235', '097-412-22-35'],
    ['0974122235', '097-412-22-35'],
    ['80974122235', '097-412-22-35'],
    ['+38 067 111 22 33', '067-111-22-33'],
    ['+38 (050) 556-70-90', '050-556-70-90'],
    ['050-556-70-90', '050-556-70-90'],
    ['  050 556 70 90 ', '  050-556-70-90 '],
  ])('formats %s as %s', (input, expected) => {
    expect(formatPhoneForPrint(input)).toBe(expected);
  });

  it.each([
    '+48123456789',
    '+1 202 555 0123',
    '12345',
    '+3809741222',
    '097412223',
    'call me',
    '0974122235 ext 12',
    '-',
  ])('leaves %s unchanged', (input) => {
    expect(formatPhoneForPrint(input)).toBe(input);
  });

  it('handles empty values', () => {
    expect(formatPhoneForPrint('')).toBe('');
    expect(formatPhoneForPrint(undefined)).toBe('');
    expect(formatPhoneForPrint(null)).toBe('');
  });

  it('formats each number in a list', () => {
    expect(formatPhoneForPrint('+380974122235, +48123456789; 0501234567')).toBe(
      '097-412-22-35, +48123456789; 050-123-45-67',
    );
  });

  it('is idempotent', () => {
    expect(formatPhoneForPrint(formatPhoneForPrint('+380974122235'))).toBe('097-412-22-35');
  });
});
