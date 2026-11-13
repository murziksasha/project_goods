import { describe, expect, it } from 'vitest';
import {
  flexiblePhonePattern,
  getContactListSearchQuery,
  getPhoneSearchKey,
  isPhoneLikeQuery,
  phoneDigitsMatch,
  phonesMatchQuery,
  toComparablePhoneDigits,
} from './phone-search';

describe('phone search rule', () => {
  it('rewrites Ukrainian prefixes to the local trunk form', () => {
    expect(toComparablePhoneDigits('+380 (63) 556-70-90')).toBe('0635567090');
    expect(toComparablePhoneDigits('380635567090')).toBe('0635567090');
    expect(toComparablePhoneDigits('0635567090')).toBe('0635567090');
    expect(toComparablePhoneDigits('+1 (202) 555-0143')).toBe('12025550143');
  });

  it('starts phone matching at three local digits', () => {
    expect(getPhoneSearchKey('+38063')).toBe('063');
    expect(getPhoneSearchKey('38063')).toBe('063');
    expect(getPhoneSearchKey('063')).toBe('063');
    expect(getPhoneSearchKey('+380')).toBeNull();
    expect(getPhoneSearchKey('380')).toBeNull();
    expect(getPhoneSearchKey('+3806')).toBeNull();
    expect(getPhoneSearchKey('06')).toBeNull();
  });

  it('accepts pasted phone punctuation while excluding lettered identifiers', () => {
    expect(isPhoneLikeQuery('+380/63–111 22 33')).toBe(true);
    expect(isPhoneLikeQuery('+380−63 111 22 33')).toBe(true);
    expect(isPhoneLikeQuery('+380*63')).toBe(false);
    expect(getPhoneSearchKey('+380/63–111 22 33')).toBe('0631112233');
    expect(getPhoneSearchKey('S000123')).toBeNull();
  });

  it('does not treat product codes or serials as phones', () => {
    expect(isPhoneLikeQuery('S000123')).toBe(false);
    expect(isPhoneLikeQuery('ART-1')).toBe(false);
    expect(isPhoneLikeQuery('r000588')).toBe(false);
    expect(getPhoneSearchKey('S000123')).toBeNull();
    expect(phonesMatchQuery(['+380631112233'], 'S000123')).toBe(false);
  });

  it('matches equivalent forms, punctuation, additional phones, and middle fragments', () => {
    const phones = ['+380 67 111 22 33', '0635567090', '+1 (202) 555-0143'];

    expect(phonesMatchQuery(phones, '+38063')).toBe(true);
    expect(phonesMatchQuery(phones, '(063) 556-70-90')).toBe(true);
    expect(phonesMatchQuery(phones, '556')).toBe(true);
    expect(phonesMatchQuery(phones, '+38067')).toBe(true);
    expect(phonesMatchQuery(phones, '202555')).toBe(true);
    expect(phonesMatchQuery(phones, '+380')).toBe(false);
    expect(phoneDigitsMatch('+380631112233', '063')).toBe(true);
    expect(flexiblePhonePattern('063')).toBe('0\\D*6\\D*3');
  });
});

describe('getContactListSearchQuery', () => {
  it('keeps name search on searchText', () => {
    expect(getContactListSearchQuery('Ivan Petrenko', ['name', 'note'])).toEqual({
      searchText: { $regex: 'ivan petrenko', $options: 'i' },
    });
  });

  it('does not phone-match a bare country code', () => {
    expect(getContactListSearchQuery('+380', ['name', 'note'])).toEqual({
      $or: [
        { name: { $regex: '\\+380', $options: 'i' } },
        { note: { $regex: '\\+380', $options: 'i' } },
      ],
    });
  });

  it('matches phone fields from three local digits without using searchText', () => {
    const phoneMatch = { $regex: '0\\D*6\\D*3', $options: 'i' };
    expect(getContactListSearchQuery('+38063', ['name', 'note'])).toEqual({
      $or: [
        { name: { $regex: '\\+38063', $options: 'i' } },
        { note: { $regex: '\\+38063', $options: 'i' } },
        { phone: phoneMatch },
        { phones: phoneMatch },
        { phoneIdentities: phoneMatch },
      ],
    });
  });

  it('executes the generated contact regex against legacy phone separators', () => {
    const query = getContactListSearchQuery('+380/63–111 22 33', ['name']);
    const branches = query.$or as Array<Record<string, { $regex: string; $options: string }>>;
    const phoneMatch = branches.find((branch) => branch.phone)?.phone;

    expect(phoneMatch).toBeDefined();
    expect(new RegExp(phoneMatch!.$regex, phoneMatch!.$options).test('+380—63/111.22.33')).toBe(true);
  });

  it('leaves serial text on searchText', () => {
    expect(getContactListSearchQuery('S000123', ['name'])).toEqual({
      searchText: { $regex: 's000123', $options: 'i' },
    });
  });
});
