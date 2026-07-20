import type {
  Client,
  ClientFormValues,
  ClientStatus,
} from '../../../entities/client/model/types';
import { getClientPhones, getPrimaryClientPhone } from '../../../entities/client/model/forms';
import {
  clientMatchesPhoneQuery,
  normalizeClientPhoneIdentity,
} from '../../../entities/client/lib/phone-match';
import type { Sale } from '../../../entities/sale/model/types';
import { getSaleProductName } from '../../../entities/sale/lib/sale-product';
import { getEffectiveClientStatusLogic } from '../../../entities/client/model/constants';
import { formatCurrency } from '../../../shared/lib/format';
import i18n from '../../../shared/i18n/config';
import { getSaleTotal } from './sales-analytics';

export const getClientSaleIncome = (sale: Sale) => getSaleTotal(sale);

export type ClientFilters = {
  query: string;
  clientId: string;
  orderNumber: string;
  dateFrom: string;
  dateTo: string;
  visitsFrom: string;
  visitsTo: string;
  incomeFrom: string;
  incomeTo: string;
  status: ClientStatus | '' | 'all';
};

export type ClientCardTab =
  | 'main'
  | 'orders'
  | 'sales'
  | 'devices'
  | 'information';

export type ClientStats = {
  visits: number;
  income: number;
  serviceCount: number;
  salesCount: number;
  orderNumbers: string[];
};

export type ClientDraft = {
  phone: string;
  phones: string[];
  name: string;
  address: string;
  email: string;
  registrationId: string;
  iban: string;
  note: string;
};

export type ClientMainForm = ClientDraft & {
  status: ClientStatus | '';
};

export const clientsFiltersStorageKey =
  'project-goods.clients-active-filters';
export const clientsSuppliersSavedFiltersStorageKey =
  'project-goods.clients-suppliers-saved-filters';
export const clientCardTabStorageKey = 'project-goods.client-card-tab';

export const emptyFilters: ClientFilters = {
  query: '',
  clientId: '',
  orderNumber: '',
  dateFrom: '',
  dateTo: '',
  visitsFrom: '',
  visitsTo: '',
  incomeFrom: '',
  incomeTo: '',
  status: 'all',
};

export const emptyClientDraft: ClientDraft = {
  phone: '+380',
  phones: ['+380'],
  name: '',
  address: '',
  email: '',
  registrationId: '',
  iban: '',
  note: '',
};

export const defaultClientStats: ClientStats = {
  visits: 0,
  income: 0,
  serviceCount: 0,
  salesCount: 0,
  orderNumbers: [],
};

export const normalizeText = (value: string) => value.trim().toLowerCase();

export const isBlacklistClient = (client: Client) =>
  client.status === 'blacklist';

export const findBlacklistClientMatch = (
  clients: Client[],
  phoneInput: string,
  nameInput: string,
) => {
  const phoneIdentity = normalizeClientPhoneIdentity(phoneInput);
  const exactPhoneMatch =
    phoneIdentity.length >= 7
      ? clients.find((client) => {
          if (!isBlacklistClient(client)) return false;
          const clientPhones = getClientPhones(client);
          return clientPhones.some((ph) => normalizeClientPhoneIdentity(ph) === phoneIdentity);
        })
      : null;

  if (exactPhoneMatch) return exactPhoneMatch;

  const normalizedName = normalizeText(nameInput);
  if (normalizedName.length < 4) return null;

  const nameMatches = clients.filter(
    (client) =>
      isBlacklistClient(client) &&
      normalizeText(client.name) === normalizedName,
  );

  return nameMatches.length === 1 ? nameMatches[0] : null;
};

export const getBlacklistClientWarning = (client: Client) =>
  `${client.name} (${getPrimaryClientPhone(client)}) is in blacklist. Check client card before creating a repair or sale order.`;

export const parseNumber = (value: string) => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeIban = (value: string) =>
  value.replace(/\s+/g, '').toUpperCase();

export const isOptionalAddressValid = (value: string) =>
  value.trim().length === 0 || value.trim().length >= 5;

export const isOptionalRegistrationIdValid = (value: string) =>
  value.trim().length === 0 || /^[0-9A-Za-z-]{8,12}$/.test(value.trim());

export const isOptionalIbanValid = (value: string) => {
  const normalized = normalizeIban(value);
  return normalized.length === 0 || /^UA\d{27}$/.test(normalized);
};

export const getDateStart = (value: string) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

export const getDateEnd = (value: string) => {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

export const getClientSubtitle = (client: Client) =>
  `${client.name} (${getPrimaryClientPhone(client)})`;

export const formatClientIncome = (value: number) =>
  `${formatCurrency(value)
    .replace(/[^\d,\s.-]/g, '')
    .trim()} UAH`;

export const getStoredClientCardTab = (): ClientCardTab => {
  try {
    const storedTab = window.localStorage.getItem(clientCardTabStorageKey);
    if (storedTab === 'services') return 'orders';
    return storedTab === 'main' ||
      storedTab === 'orders' ||
      storedTab === 'sales' ||
      storedTab === 'devices' ||
      storedTab === 'information'
      ? storedTab
      : 'main';
  } catch {
    return 'main';
  }
};

const getMetaFieldFromNote = (note: string, key: 'Address' | 'Email') => {
  const prefix = `${key}:`;
  const line = note.split('\n').find((item) => item.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : '';
};

const getMetaFieldFromNoteLegacy = (
  note: string,
  key: 'Address' | 'Email',
) => {
  const prefix = `${key}:`;
  const line = note.split('\n').find((item) => item.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : '';
};

export const getPlainNote = (note: string) =>
  note
    .split('\n')
    .filter(
      (line) =>
        !line.startsWith('Address:') &&
        !line.startsWith('Email:') &&
        !line.startsWith('Address:') &&
        !line.startsWith('Email:'),
    )
    .join('\n')
    .trim();

export const getLegacyClientEmail = (client: Client) =>
  client.email ||
  getMetaFieldFromNote(client.note, 'Email') ||
  getMetaFieldFromNoteLegacy(client.note, 'Email');

export const getLegacyClientAddress = (client: Client) =>
  client.address ||
  getMetaFieldFromNote(client.note, 'Address') ||
  getMetaFieldFromNoteLegacy(client.note, 'Address');

export const formatItemList = (sale: Sale, tab: ClientCardTab) => {
  const targetKind = tab === 'orders' ? 'service' : 'product';
  const lineItems = (sale.lineItems ?? []).filter(
    (item) => item.kind === targetKind,
  );

  if (lineItems.length > 0) {
    return lineItems
      .map((item) => `${item.name} x${item.quantity}`)
      .join(', ');
  }

  return getSaleProductName(sale, i18n.t('orders.fallbacks.product'));
};

export const getClientStatsMap = (sales: Sale[]) => {
  const map = new Map<string, ClientStats>();

  sales.forEach((sale) => {
    const current = map.get(sale.client.id) ?? { ...defaultClientStats };
    const income = getClientSaleIncome(sale);
    const orderNumbers = sale.recordNumber
      ? [...current.orderNumbers, sale.recordNumber]
      : current.orderNumbers;

    map.set(sale.client.id, {
      visits: current.visits + 1,
      income: current.income + income,
      serviceCount:
        current.serviceCount + (sale.kind === 'repair' ? 1 : 0),
      salesCount: current.salesCount + (sale.kind === 'sale' ? 1 : 0),
      orderNumbers,
    });
  });

  return map;
};

export const mapClientDraftToPayload = (
  draft: ClientDraft,
  status: ClientStatus | '' = '',
): ClientFormValues => {
  const primary = (draft.phone || '').trim();
  let phoneList = Array.isArray(draft.phones)
    ? draft.phones.map((p) => (p || '').trim()).filter((p) => p.length > 0)
    : [];

  if (phoneList.length === 0 && primary) {
    phoneList = [primary];
  }

  // Ensure primary phone is first
  if (primary) {
    phoneList = [
      primary,
      ...phoneList.filter((p) => p !== primary),
    ];
  }

  // Deduplicate while preserving order
  const seen = new Set<string>();
  phoneList = phoneList.filter((p) => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });

  if (phoneList.length === 0 && primary) {
    phoneList = [primary];
  }

  const finalPrimary = phoneList[0] || primary || '';

  return {
    phone: finalPrimary,
    phones: phoneList.length > 0 ? phoneList : (finalPrimary ? [finalPrimary] : []),
    name: draft.name.trim(),
    email: draft.email.trim(),
    address: draft.address.trim(),
    registrationId: draft.registrationId.trim(),
    iban: normalizeIban(draft.iban),
    note: draft.note.trim(),
    status,
  };
};

export const getActiveClientFiltersCount = (filters: ClientFilters) =>
  (filters.query ? 1 : 0) +
  (filters.clientId ? 1 : 0) +
  (filters.orderNumber ? 1 : 0) +
  (filters.dateFrom ? 1 : 0) +
  (filters.dateTo ? 1 : 0) +
  (filters.visitsFrom ? 1 : 0) +
  (filters.visitsTo ? 1 : 0) +
  (filters.incomeFrom ? 1 : 0) +
  (filters.incomeTo ? 1 : 0) +
  (filters.status !== 'all' ? 1 : 0);

export const normalizeClientFiltersForApply = (
  filters: ClientFilters,
): ClientFilters => ({
  ...filters,
  query: filters.query.trim(),
  clientId: filters.clientId.trim(),
  orderNumber: filters.orderNumber.trim(),
  visitsFrom: filters.visitsFrom.trim(),
  visitsTo: filters.visitsTo.trim(),
  incomeFrom: filters.incomeFrom.trim(),
  incomeTo: filters.incomeTo.trim(),
});

export const getFilteredClients = (
  clients: Client[],
  appliedFilters: ClientFilters,
  statsByClient: Map<string, ClientStats>,
) => {
  const query = normalizeText(appliedFilters.query);
  const byOrder = normalizeText(appliedFilters.orderNumber);
  const dateFrom = getDateStart(appliedFilters.dateFrom);
  const dateTo = getDateEnd(appliedFilters.dateTo);
  const visitsFrom = parseNumber(appliedFilters.visitsFrom);
  const visitsTo = parseNumber(appliedFilters.visitsTo);
  const incomeFrom = parseNumber(appliedFilters.incomeFrom);
  const incomeTo = parseNumber(appliedFilters.incomeTo);

  return [...clients]
    .filter((client) => {
      const stats = statsByClient.get(client.id) ?? defaultClientStats;
      const phonesText = getClientPhones(client).join(' ') || getPrimaryClientPhone(client) || '';
      const searchable =
        `${client.id} ${client.name} ${phonesText} ${client.note}`.toLowerCase();
      const createdAt = new Date(client.createdAt).getTime();
      const effectiveStatus = getEffectiveClientStatusLogic(
        client.status || '',
        stats.visits,
      );

      if (query && !searchable.includes(query) && !clientMatchesPhoneQuery(client, appliedFilters.query)) {
        return false;
      }
      if (
        appliedFilters.clientId &&
        !client.id
          .toLowerCase()
          .includes(appliedFilters.clientId.trim().toLowerCase())
      ) {
        return false;
      }
      if (
        byOrder &&
        !stats.orderNumbers.some((number) =>
          number.toLowerCase().includes(byOrder),
        )
      ) {
        return false;
      }
      if (dateFrom !== null && createdAt < dateFrom) return false;
      if (dateTo !== null && createdAt > dateTo) return false;
      if (visitsFrom !== null && stats.visits < visitsFrom) return false;
      if (visitsTo !== null && stats.visits > visitsTo) return false;
      if (incomeFrom !== null && stats.income < incomeFrom) return false;
      if (incomeTo !== null && stats.income > incomeTo) return false;
      if (
        appliedFilters.status !== 'all' &&
        effectiveStatus !== appliedFilters.status
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};
