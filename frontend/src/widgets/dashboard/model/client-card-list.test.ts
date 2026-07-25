import { describe, expect, it } from 'vitest';
import type { ClientDevice } from '../../../entities/client-device/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import {
  CLIENT_CARD_PAGE_SIZE,
  collectHistoryStatuses,
  filterClientDeviceRows,
  filterClientHistoryRows,
  paginateItems,
} from './client-card-list';

const baseSale = (overrides: Partial<Sale> = {}): Sale => ({
  id: 'sale-1',
  recordNumber: 'r000001',
  saleDate: '2026-07-15T10:00:00.000Z',
  quantity: 1,
  salePrice: 100,
  kind: 'sale',
  status: 'issued',
  paidAmount: 100,
  note: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [
    {
      id: 'line-1',
      kind: 'product',
      name: 'Phone case',
      price: 100,
      quantity: 1,
      warrantyPeriod: 0,
    },
  ],
  client: {
    id: 'client-1',
    name: 'Client',
    phone: '+380501111111',
    status: 'new',
  },
  product: {
    id: 'product-1',
    article: 'A-1',
    name: 'Phone case',
    serialNumber: '',
  },
  manager: null,
  master: null,
  issuedBy: null,
  createdAt: '2026-07-15T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
  ...overrides,
});

const baseDevice = (
  overrides: Partial<ClientDevice> = {},
): ClientDevice => ({
  id: 'device-1',
  clientId: 'client-1',
  clientName: 'Client',
  clientPhone: '+380501111111',
  name: 'Coffee machine',
  serialNumber: 'SN-1',
  note: 'Kitchen',
  source: 'clientCard',
  isActive: true,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
  ...overrides,
});

describe('filterClientHistoryRows', () => {
  const rows = [
    baseSale({
      id: 's1',
      recordNumber: 'r000100',
      status: 'new',
      saleDate: '2026-07-10T12:00:00.000Z',
      lineItems: [
        {
          id: 'l1',
          kind: 'product',
          name: 'Enerlight battery',
          price: 50,
          quantity: 1,
          warrantyPeriod: 0,
        },
      ],
    }),
    baseSale({
      id: 's2',
      recordNumber: 'r000200',
      status: 'issued',
      saleDate: '2026-07-15T12:00:00.000Z',
      lineItems: [
        {
          id: 'l2',
          kind: 'product',
          name: 'Phone case',
          price: 100,
          quantity: 1,
          warrantyPeriod: 0,
        },
      ],
    }),
  ];

  it('filters by free-text query on number and item name', () => {
    const byNumber = filterClientHistoryRows(
      rows,
      { query: 'r000100', status: 'all', dateFrom: '', dateTo: '' },
      'sales',
    );
    expect(byNumber.map((s) => s.id)).toEqual(['s1']);

    const byName = filterClientHistoryRows(
      rows,
      { query: 'phone', status: 'all', dateFrom: '', dateTo: '' },
      'sales',
    );
    expect(byName.map((s) => s.id)).toEqual(['s2']);
  });

  it('filters by status', () => {
    const filtered = filterClientHistoryRows(
      rows,
      { query: '', status: 'issued', dateFrom: '', dateTo: '' },
      'sales',
    );
    expect(filtered.map((s) => s.id)).toEqual(['s2']);
  });

  it('filters by inclusive date range', () => {
    const filtered = filterClientHistoryRows(
      rows,
      {
        query: '',
        status: 'all',
        dateFrom: '2026-07-12',
        dateTo: '2026-07-20',
      },
      'sales',
    );
    expect(filtered.map((s) => s.id)).toEqual(['s2']);
  });
});

describe('collectHistoryStatuses', () => {
  it('returns unique sorted statuses', () => {
    const statuses = collectHistoryStatuses([
      baseSale({ status: 'issued' }),
      baseSale({ status: 'new' }),
      baseSale({ status: 'issued' }),
      baseSale({ status: '' }),
    ]);
    expect(statuses).toEqual(['issued', 'new']);
  });
});

describe('filterClientDeviceRows', () => {
  const devices = [
    baseDevice({ id: 'd1', name: 'TV', isActive: true, note: 'Living' }),
    baseDevice({
      id: 'd2',
      name: 'Phone',
      isActive: false,
      note: 'Broken',
    }),
  ];

  it('filters by query on name and note', () => {
    expect(
      filterClientDeviceRows(devices, {
        query: 'living',
        activity: 'all',
      }).map((d) => d.id),
    ).toEqual(['d1']);
  });

  it('filters by activity', () => {
    expect(
      filterClientDeviceRows(devices, {
        query: '',
        activity: 'inactive',
      }).map((d) => d.id),
    ).toEqual(['d2']);
  });
});

describe('paginateItems', () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  it('returns fixed page size slices', () => {
    const page1 = paginateItems(items, 1, CLIENT_CARD_PAGE_SIZE);
    expect(page1.pageItems).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(page1.pageCount).toBe(3);
    expect(page1.total).toBe(25);

    const page3 = paginateItems(items, 3, CLIENT_CARD_PAGE_SIZE);
    expect(page3.pageItems).toEqual([21, 22, 23, 24, 25]);
    expect(page3.page).toBe(3);
  });

  it('clamps page when list shrinks', () => {
    const result = paginateItems(items.slice(0, 5), 9, CLIENT_CARD_PAGE_SIZE);
    expect(result.page).toBe(1);
    expect(result.pageItems).toEqual([1, 2, 3, 4, 5]);
  });

  it('handles empty list', () => {
    const result = paginateItems([], 1);
    expect(result.pageItems).toEqual([]);
    expect(result.pageCount).toBe(1);
    expect(result.total).toBe(0);
  });
});
