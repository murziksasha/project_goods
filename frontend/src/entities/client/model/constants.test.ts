import { describe, expect, it } from 'vitest';
import { getEffectiveClientStatusLogic } from './constants';

describe('getEffectiveClientStatusLogic', () => {
  it('upgrades legacy stored new by visit count', () => {
    expect(getEffectiveClientStatusLogic('new', 3)).toBe('ok');
    expect(getEffectiveClientStatusLogic('new', 5)).toBe('opt');
    expect(getEffectiveClientStatusLogic('new', 10)).toBe('vip');
  });

  it('upgrades empty stored status by visit count', () => {
    expect(getEffectiveClientStatusLogic('', 5)).toBe('opt');
  });

  it('keeps manual overrides regardless of visits', () => {
    expect(getEffectiveClientStatusLogic('vip', 1)).toBe('vip');
    expect(getEffectiveClientStatusLogic('ok', 20)).toBe('ok');
  });

  it('always keeps blacklist', () => {
    expect(getEffectiveClientStatusLogic('blacklist', 20)).toBe('blacklist');
  });
});