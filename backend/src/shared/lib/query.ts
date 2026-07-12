import mongoose from 'mongoose';
import { HttpError } from './errors';
import { normalizeClientPhone } from './parsers';

export const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getPhoneSearchDigits = (rawQuery: string) => {
  const digits = rawQuery.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('380') && digits.length >= 12) {
    return digits.slice(3);
  }

  if (digits.startsWith('0') && digits.length >= 10) {
    return digits.slice(1);
  }

  return digits;
};

export const getSearchQuery = (rawQuery: unknown) => {
  const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';

  if (!query) {
    return {};
  }

  const lowerQuery = query.toLowerCase();
  const phoneDigits = getPhoneSearchDigits(query);
  const orConditions: Record<string, unknown>[] = [
    {
      searchText: {
        $regex: escapeRegExp(lowerQuery),
        $options: 'i',
      },
    },
  ];

  if (phoneDigits.length >= 3) {
    const digitPattern = escapeRegExp(phoneDigits);
    orConditions.push(
      { phone: { $regex: digitPattern, $options: 'i' } },
      { phones: { $regex: digitPattern, $options: 'i' } },
      { phoneIdentities: { $regex: digitPattern, $options: 'i' } },
    );

    if (phoneDigits.length === 9) {
      const normalizedPhone = normalizeClientPhone(phoneDigits);
      orConditions.push(
        { phone: normalizedPhone },
        { phones: normalizedPhone },
        { phoneIdentities: normalizedPhone },
      );
    }
  }

  return orConditions.length === 1 ? orConditions[0]! : { $or: orConditions };
};

export const isValidObjectIdOrThrow = (value: string, label: string) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new HttpError(400, `Valid ${label} is required.`);
  }
};
