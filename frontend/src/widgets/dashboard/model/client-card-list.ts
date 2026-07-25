import type { ClientDevice } from '../../../entities/client-device/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import { formatDateTime } from '../../../shared/lib/format';
import {
  formatClientIncome,
  formatItemList,
  getClientSaleIncome,
  type ClientCardTab,
} from './clients-workspace';

export const CLIENT_CARD_PAGE_SIZE = 10;

export type ClientHistoryListFilters = {
  query: string;
  status: string;
  dateFrom: string;
  dateTo: string;
};

export type ClientDeviceListFilters = {
  query: string;
  activity: 'all' | 'active' | 'inactive';
};

export type PaginatedResult<T> = {
  pageItems: T[];
  page: number;
  pageCount: number;
  total: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const normalizeQuery = (query: string) => query.trim().toLowerCase();

const matchesDateRange = (
  saleDate: string,
  dateFrom: string,
  dateTo: string,
): boolean => {
  const day = (saleDate || '').slice(0, 10);
  if (!day) return !dateFrom && !dateTo;

  if (dateFrom && day < dateFrom) return false;
  if (dateTo && day > dateTo) return false;
  return true;
};

const historySearchHaystack = (
  sale: Sale,
  tab: ClientCardTab,
): string => {
  const number = sale.recordNumber ?? sale.id.slice(-6);
  const items = formatItemList(sale, tab);
  const amount = formatClientIncome(getClientSaleIncome(sale));
  let dateText = '';
  try {
    dateText = formatDateTime(sale.saleDate);
  } catch {
    dateText = sale.saleDate ?? '';
  }

  return [number, items, sale.status, amount, dateText]
    .join(' ')
    .toLowerCase();
};

export const collectHistoryStatuses = (rows: Sale[]): string[] => {
  const statuses = new Set<string>();
  rows.forEach((sale) => {
    const status = (sale.status || '').trim();
    if (status) statuses.add(status);
  });
  return Array.from(statuses).sort((a, b) => a.localeCompare(b));
};

export const filterClientHistoryRows = (
  rows: Sale[],
  filters: ClientHistoryListFilters,
  tab: ClientCardTab,
): Sale[] => {
  const query = normalizeQuery(filters.query);
  const statusFilter =
    filters.status && filters.status !== 'all' ? filters.status : '';

  return rows.filter((sale) => {
    if (statusFilter && sale.status !== statusFilter) return false;
    if (
      !matchesDateRange(sale.saleDate, filters.dateFrom, filters.dateTo)
    ) {
      return false;
    }
    if (!query) return true;
    return historySearchHaystack(sale, tab).includes(query);
  });
};

const deviceSearchHaystack = (
  device: ClientDevice,
  activeLabel: string,
  inactiveLabel: string,
): string =>
  [
    device.name,
    device.note,
    device.serialNumber,
    device.isActive ? activeLabel : inactiveLabel,
  ]
    .join(' ')
    .toLowerCase();

export const filterClientDeviceRows = (
  devices: ClientDevice[],
  filters: ClientDeviceListFilters,
  labels: { active: string; inactive: string } = {
    active: 'active',
    inactive: 'inactive',
  },
): ClientDevice[] => {
  const query = normalizeQuery(filters.query);

  return devices.filter((device) => {
    if (filters.activity === 'active' && !device.isActive) return false;
    if (filters.activity === 'inactive' && device.isActive) return false;
    if (!query) return true;
    return deviceSearchHaystack(
      device,
      labels.active,
      labels.inactive,
    ).includes(query);
  });
};

export const paginateItems = <T>(
  items: T[],
  page: number,
  pageSize: number = CLIENT_CARD_PAGE_SIZE,
): PaginatedResult<T> => {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = clamp(page, 1, pageCount);
  const start = (safePage - 1) * pageSize;

  return {
    pageItems: items.slice(start, start + pageSize),
    page: safePage,
    pageCount,
    total,
  };
};
