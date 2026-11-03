import { normalizePhone } from '../../../shared/lib/phoneFormatter';
import {
  isPhoneLikeQuery,
  phonesMatchQuery,
} from '../../../shared/lib/phone-search';
import type { Sale } from '../../../shared/types/domain';
import { getClientPhones } from '../model/forms';
import type { Client } from '../model/types';

export const normalizeClientPhoneIdentity = (
  value: string,
): string => {
  const digits = normalizePhone(value);
  if (digits.startsWith('380')) return digits.slice(3);
  if (digits.startsWith('0')) return digits.slice(1);
  return digits;
};

export const getClientPhoneIdentities = (
  client: Client,
): string[] => {
  const seen = new Set<string>();
  const identities: string[] = [];

  for (const phone of getClientPhones(client)) {
    const identity = normalizeClientPhoneIdentity(phone);
    if (!identity || seen.has(identity)) continue;
    seen.add(identity);
    identities.push(identity);
  }

  return identities;
};

export const clientMatchesPhoneQuery = (
  client: Client,
  query: string,
): boolean => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  if (client.name.toLowerCase().includes(normalizedQuery)) {
    return true;
  }

  if (phonesMatchQuery(getClientPhones(client), query)) {
    return true;
  }

  if (isPhoneLikeQuery(query)) {
    return false;
  }

  return getClientPhones(client).some((phone) =>
    phone.toLowerCase().includes(normalizedQuery),
  );
};

export const formatClientPhonesLabel = (
  client: Client,
  matchedPhone?: string,
): string => {
  const phones = getClientPhones(client);
  const primary = phones[0] || client.phone;
  const extras = phones.slice(1);

  if (extras.length === 0) {
    return primary;
  }

  if (matchedPhone && matchedPhone !== primary) {
    return `${primary} (+ ${extras.join(', ')})`;
  }

  return `${primary} (+ ${extras.length} more)`;
};

export const getSaleClientPhones = (
  sale: Pick<Sale, 'client'>,
): string[] => {
  if (
    Array.isArray(sale.client.phones) &&
    sale.client.phones.length > 0
  ) {
    return sale.client.phones.filter(Boolean);
  }

  return sale.client.phone ? [sale.client.phone] : [];
};

export const saleMatchesPhoneQuery = (
  sale: Pick<Sale, 'client'>,
  query: string,
): boolean => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  if (sale.client.name.toLowerCase().includes(normalizedQuery)) {
    return true;
  }

  if (phonesMatchQuery(getSaleClientPhones(sale), query)) {
    return true;
  }

  if (isPhoneLikeQuery(query)) {
    return false;
  }

  return getSaleClientPhones(sale).some((phone) =>
    phone.toLowerCase().includes(normalizedQuery),
  );
};
