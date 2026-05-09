import { describe, expect, it } from 'vitest';
import {
  formatUkrainianPhone,
  isValidUkrainianPhone,
  normalizePhone,
} from './phoneFormatter';

describe('phoneFormatter', () => {
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
