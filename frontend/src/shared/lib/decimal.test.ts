import { describe, expect, it } from 'vitest';
import {
  normalizeDecimalInput,
  parseDecimal,
  parseMoney,
} from './decimal';

describe('decimal helpers', () => {
  it('keeps decimal input editable and filters unsupported characters', () => {
    expect(normalizeDecimalInput('834,48')).toBe('834,48');
    expect(normalizeDecimalInput('834.48')).toBe('834.48');
    expect(normalizeDecimalInput('0,01')).toBe('0,01');
    expect(normalizeDecimalInput('834,')).toBe('834,');
    expect(normalizeDecimalInput('12a,3.4')).toBe('12,34');
  });

  it('parses comma and dot decimals', () => {
    expect(parseDecimal('834,48')).toBe(834.48);
    expect(parseDecimal('834.48')).toBe(834.48);
    expect(parseDecimal('0,01')).toBe(0.01);
    expect(parseDecimal('834,')).toBe(834);
    expect(parseDecimal('1,2,3')).toBeNaN();
  });

  it('rounds money to cents', () => {
    expect(parseMoney('10,239')).toBe(10.24);
  });
});
