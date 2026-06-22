import { describe, expect, it } from 'vitest';
import { getEffectiveClientStatus } from './constants';

describe('getEffectiveClientStatus', () => {
  it('upgrades auto-managed statuses by visit count', () => {
    expect(getEffectiveClientStatus('new', 3)).toBe('ok');
    expect(getEffectiveClientStatus('', 10)).toBe('vip');
  });

  it('keeps manual overrides', () => {
    expect(getEffectiveClientStatus('opt', 1)).toBe('opt');
    expect(getEffectiveClientStatus('blacklist', 15)).toBe('blacklist');
  });
});