import { describe, expect, it } from 'vitest';
import { formatCurrency, roundCurrency } from './format';

describe('roundCurrency', () => {
  it('rounds standard amounts to integer kopiykas', () => {
    expect(roundCurrency(123.45)).toBe(12345);
    expect(roundCurrency(100)).toBe(10000);
    expect(roundCurrency(0)).toBe(0);
  });

  it('handles negative amounts and leading minus', () => {
    expect(roundCurrency(-123.45)).toBe(-12345);
    expect(roundCurrency(-0.05)).toBe(-5);
    expect(roundCurrency(-0)).toBe(0);
  });

  it('rounds matching formatCurrency', () => {
    expect(roundCurrency(10.004)).toBe(1000);
    expect(roundCurrency(10.006)).toBe(1001);
    expect(formatCurrency(10.004)).toBe(formatCurrency(roundCurrency(10.004) / 100));
    expect(formatCurrency(10.006)).toBe(formatCurrency(roundCurrency(10.006) / 100));
  });

  it('handles non-finite numbers by returning 0', () => {
    expect(roundCurrency(NaN)).toBe(0);
    expect(roundCurrency(Infinity)).toBe(0);
    expect(roundCurrency(-Infinity)).toBe(0);
  });
});

