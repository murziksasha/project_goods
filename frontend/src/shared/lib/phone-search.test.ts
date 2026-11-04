import { describe, expect, it } from 'vitest';
import {
  findFirstMatchedAdditionalPhone,
  getPhoneSearchKey,
  isPhoneLikeQuery,
  phonesMatchQuery,
  toComparablePhoneDigits,
} from './phone-search';

describe('phone search rule', () => {
  const phones = ['+380671112233', '(063) 556-70-90', '+1 202 555 0143'];

  it('treats Ukrainian forms as the same local number', () => {
    expect(toComparablePhoneDigits('+38 (063) 556-70-90')).toBe('0635567090');
    expect(toComparablePhoneDigits('380635567090')).toBe('0635567090');
    expect(toComparablePhoneDigits('0635567090')).toBe('0635567090');
    expect(phonesMatchQuery(phones, '+38063')).toBe(true);
    expect(phonesMatchQuery(phones, '380635567090')).toBe(true);
    expect(phonesMatchQuery(phones, '0635567090')).toBe(true);
  });

  it('matches middle fragments and other countries by typed digits', () => {
    expect(phonesMatchQuery(phones, '556')).toBe(true);
    expect(phonesMatchQuery(phones, '+1 (202) 555-0143')).toBe(true);
    expect(phonesMatchQuery(phones, '202555')).toBe(true);
  });

  it('matches pasted slash and Unicode dash forms against a legacy formatted phone', () => {
    expect(phonesMatchQuery(phones, '+380/63/556/70/90')).toBe(true);
    expect(phonesMatchQuery(phones, '+380–63–556–70–90')).toBe(true);
    expect(phonesMatchQuery(phones, '+380−63−556−70−90')).toBe(true);
    expect(getPhoneSearchKey('+380/63')).toBe('063');
  });

  it('ignores a bare country code and non-phone text', () => {
    expect(getPhoneSearchKey('+380')).toBeNull();
    expect(getPhoneSearchKey('+3806')).toBeNull();
    expect(phonesMatchQuery(phones, '+380')).toBe(false);
    expect(phonesMatchQuery(phones, 'S000123')).toBe(false);
    expect(phonesMatchQuery(phones, 'ART-1')).toBe(false);
    expect(isPhoneLikeQuery('+38063***')).toBe(false);
    expect(getPhoneSearchKey('+38063***')).toBeNull();
    expect(phonesMatchQuery(phones, '+38063***')).toBe(false);
    expect(isPhoneLikeQuery('tel:+380/63/556/70/90')).toBe(false);
    expect(phonesMatchQuery(phones, 'tel:+380/63/556/70/90')).toBe(false);
  });

  it('returns the first matched additional phone and keeps the primary out of that slot', () => {
    expect(findFirstMatchedAdditionalPhone(phones, '063556')).toBe(
      '(063) 556-70-90',
    );
    expect(findFirstMatchedAdditionalPhone(phones, '067111')).toBe('');
    expect(findFirstMatchedAdditionalPhone(phones, '+380')).toBe('');
  });
});
