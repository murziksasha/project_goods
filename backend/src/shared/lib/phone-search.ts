import { escapeRegExp } from './query';

const PHONE_LIKE_QUERY = /^\+?[\d\s().\x2f\-\u2010-\u2015\u2212]+$/u;
const PHONE_SEPARATOR = '\\D*';

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

/** Substring match that allows phone punctuation between the key's digits. */
export const flexiblePhonePattern = (key: string) =>
  key.split('').join(PHONE_SEPARATOR);

export const phoneDigitsMatch = (phone: string, key: string) =>
  toComparablePhoneDigits(phone).includes(key);

export const phonesMatchQuery = (phones: string[], query: string) => {
  const key = getPhoneSearchKey(query);
  if (!key) return false;
  return phones.some((phone) => phoneDigitsMatch(phone, key));
};

const textRegex = (value: string) => ({
  $regex: escapeRegExp(value.trim().toLowerCase()),
  $options: 'i',
});

/**
 * List search for clients and suppliers.
 * Non-phone text still uses `searchText`. Phone-like text does not, so a bare
 * `+380` cannot match every stored Ukrainian number inside `searchText`.
 */
export const getContactListSearchQuery = (
  rawQuery: unknown,
  textFields: string[],
) => {
  const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';
  if (!query) return {};

  if (!isPhoneLikeQuery(query)) {
    return { searchText: textRegex(query) };
  }

  const orConditions: Record<string, unknown>[] = textFields.map((field) => ({
    [field]: textRegex(query),
  }));
  const key = getPhoneSearchKey(query);
  if (key) {
    const phoneMatch = { $regex: flexiblePhonePattern(key), $options: 'i' };
    orConditions.push(
      { phone: phoneMatch },
      { phones: phoneMatch },
      { phoneIdentities: phoneMatch },
    );
  }

  return orConditions.length === 1 ? orConditions[0]! : { $or: orConditions };
};
