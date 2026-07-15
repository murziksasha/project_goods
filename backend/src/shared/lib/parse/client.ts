import { clientStatuses, type ClientStatus } from '../../../domain/client/constants';
import type { ClientPayload } from '../../../domain/shared/types';
import { normalizeClientPhone, toNonEmptyString } from './primitives';

export const normalizePhonesList = (payload: { phone?: unknown; phones?: unknown }) => {
  const legacyPhone = normalizeClientPhone(payload.phone);

  let inputPhones: unknown[] = [];
  if (Array.isArray(payload.phones)) {
    inputPhones = payload.phones;
  } else if (typeof payload.phones === 'string' && payload.phones.trim()) {
    inputPhones = payload.phones.split(/[;,\n\r]+/);
  }

  const normalizedList = inputPhones
    .map(normalizeClientPhone)
    .filter((p) => p && p.length > 0);

  if (legacyPhone && !normalizedList.includes(legacyPhone)) {
    normalizedList.unshift(legacyPhone);
  }
  if (normalizedList.length === 0 && legacyPhone) {
    normalizedList.push(legacyPhone);
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of normalizedList) {
    if (!seen.has(p)) {
      seen.add(p);
      unique.push(p);
    }
  }

  const phone = legacyPhone || unique[0] || '';
  const phones = phone
    ? [phone, ...unique.filter((value) => value !== phone)]
    : [];

  return { phone, phones };
};

export const normalizeClientPayload = (payload: ClientPayload) => {
  const { phone, phones } = normalizePhonesList(payload);

  return {
    phone,
    phones,
    name: toNonEmptyString(payload.name),
    email: toNonEmptyString(payload.email),
    address: toNonEmptyString(payload.address),
    registrationId: toNonEmptyString(payload.registrationId),
    iban: toNonEmptyString(payload.iban).replace(/\s+/g, '').toUpperCase(),
    note: toNonEmptyString(payload.note),
    status: (() => {
      const raw = String(payload.status ?? '');
      if (raw === '') return '';
      return clientStatuses.includes(raw as ClientStatus)
        ? (raw as ClientStatus)
        : '';
    })(),
  };
};
