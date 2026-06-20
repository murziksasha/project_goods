import { describe, expect, it } from 'vitest';
import { getPhoneSearchDigits, getSearchQuery } from './query';

describe('getPhoneSearchDigits', () => {
  it('normalizes ukrainian phone input to local digits', () => {
    expect(getPhoneSearchDigits('0635567090')).toBe('635567090');
    expect(getPhoneSearchDigits('+380635567090')).toBe('635567090');
    expect(getPhoneSearchDigits('380635567090')).toBe('635567090');
  });
});

describe('getSearchQuery', () => {
  it('searches phones and phoneIdentities for digit queries', () => {
    expect(getSearchQuery('635567090')).toEqual({
      $or: [
        {
          searchText: {
            $regex: '635567090',
            $options: 'i',
          },
        },
        { phone: { $regex: '635567090', $options: 'i' } },
        { phones: { $regex: '635567090', $options: 'i' } },
        { phoneIdentities: { $regex: '635567090', $options: 'i' } },
        { phone: '+380635567090' },
        { phones: '+380635567090' },
        { phoneIdentities: '+380635567090' },
      ],
    });
  });

  it('keeps name-only search on searchText', () => {
    expect(getSearchQuery('Ivan Petrenko')).toEqual({
      searchText: {
        $regex: 'ivan petrenko',
        $options: 'i',
      },
    });
  });
});