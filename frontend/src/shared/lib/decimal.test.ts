import { describe, expect, it } from 'vitest';
import {
  formatMoneyAmount,
  formatMoneyRemainder,
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

  it('formats money amount with two decimals and dot', () => {
    expect(formatMoneyAmount(888.3)).toBe('888.30');
  });

  it('formats money remainder with two decimals and comma', () => {
    expect(formatMoneyRemainder(888.3, '888')).toBe('0,30');
    expect(formatMoneyRemainder(0.3)).toBe('0,30');
    expect(formatMoneyRemainder(888.3, '888.30')).toBe('0,00');
    expect(formatMoneyRemainder(888.3, '887.30')).toBe('1,00');
    expect(formatMoneyRemainder(888.3, '')).toBe('888,30');
  });
});
