const PHONE_LIKE_QUERY = /^\+?[\d\s().\x2f\-\u2010-\u2015\u2212]+$/u;

/** Keep in sync with backend/src/shared/lib/phone-search.ts. */

/** Digits only, with a Ukrainian 380 prefix rewritten to the local 0 trunk. */
export const toComparablePhoneDigits = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('380')) return `0${digits.slice(3)}`;
  return digits;
};

/** Digits and phone punctuation only. Letters stay on text search. */
export const isPhoneLikeQuery = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 && /\d/.test(trimmed) && PHONE_LIKE_QUERY.test(trimmed);
};

/**
 * Local digit key for a phone-like query, or null when phone matching must not run.
 * `+38063` → `063`. A bare `+380` → null.
 */
export const getPhoneSearchKey = (value: string) => {
  if (!isPhoneLikeQuery(value)) return null;
  const key = toComparablePhoneDigits(value);
  return key.length >= 3 ? key : null;
};

export const phoneDigitsMatch = (phone: string, key: string) =>
  toComparablePhoneDigits(phone).includes(key);

export const phonesMatchQuery = (phones: string[], query: string) => {
  const key = getPhoneSearchKey(query);
  if (!key) return false;
  return phones.some((phone) => phoneDigitsMatch(phone, key));
};

/** First additional phone that matches. The primary number stays in place. */
export const findFirstMatchedAdditionalPhone = (
  phones: string[],
  query: string,
) => {
  const key = getPhoneSearchKey(query);
  if (!key || phones.length < 2) return '';
  const primary = phones[0] ?? '';
  for (const phone of phones.slice(1)) {
    if (phone && phone !== primary && phoneDigitsMatch(phone, key)) {
      return phone;
    }
  }
  return '';
};
