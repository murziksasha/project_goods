import { describe, expect, it } from 'vitest';
import type { Client } from '../../../entities/client';
import type { Sale } from '../../../entities/sale';
import {
  clientsFiltersStorageKey,
  clientsSuppliersSavedFiltersStorageKey,
  clientsSuppliersTabStorageKey,
  collectClientHistorySerials,
  defaultClientStats,
  emptyFilters,
  formatItemList,
  getClientStatsMap,
  getStoredClientCardTab,
  relaxStoredClientFiltersForClient,
  type ClientFilters,
} from './clients-workspace';

const baseSale: Sale = {
  id: 'sale-1',
  recordNumber: 'r000001',
  saleDate: '2026-05-12T10:00:00.000Z',
  quantity: 9,
  salePrice: 999,
  kind: 'sale',
  status: 'paid',
  paidAmount: 180,
  note: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [
    {
      id: 'line-1',
      kind: 'product',
      name: 'Part',
      price: 80,
      quantity: 2,
      warrantyPeriod: 0,
    },
    {
      id: 'line-2',
      kind: 'service',
      name: 'Work',
      price: 40,
      quantity: 1,
      warrantyPeriod: 0,
    },
  ],
  discount: { mode: 'amount', value: 20 },
  client: {
    id: 'client-1',
    name: 'Client',
    phone: '+380501111111',
    status: 'new',
  },
  product: null,
  manager: null,
  master: null,
  issuedBy: null,
  createdAt: '2026-05-12T10:00:00.000Z',
  updatedAt: '2026-05-12T10:00:00.000Z',
};

describe('getStoredClientCardTab', () => {
  it('restores devices tab from local storage', () => {
    window.localStorage.setItem('project-goods.client-card-tab', 'devices');
    expect(getStoredClientCardTab()).toBe('devices');
  });

  it('migrates legacy services tab to orders', () => {
    window.localStorage.setItem('project-goods.client-card-tab', 'services');
    expect(getStoredClientCardTab()).toBe('orders');
  });

  it('restores information tab from local storage', () => {
    window.localStorage.setItem('project-goods.client-card-tab', 'information');
    expect(getStoredClientCardTab()).toBe('information');
  });
});

describe('getClientStatsMap', () => {
  it('uses line items and discounts instead of salePrice * quantity', () => {
    const statsByClient = getClientStatsMap([baseSale]);
    const stats = statsByClient.get('client-1');

    expect(stats?.visits).toBe(1);
    expect(stats?.income).toBe(180);
    expect(stats?.salesCount).toBe(1);
  });

  it('aggregates multiple sales for the same client', () => {
    const secondSale: Sale = {
      ...baseSale,
      id: 'sale-2',
      recordNumber: 'r000002',
      discount: { mode: 'amount', value: 0 },
      lineItems: [
        {
          id: 'line-3',
          kind: 'product',
          name: 'Cable',
          price: 50,
          quantity: 1,
          warrantyPeriod: 0,
        },
      ],
    };

    const statsByClient = getClientStatsMap([baseSale, secondSale]);
    const stats = statsByClient.get('client-1');

    expect(stats?.visits).toBe(2);
    expect(stats?.income).toBe(230);
  });
});

describe('formatItemList', () => {
  it('shows the repair device on Orders, not joined services', () => {
    const repair: Sale = {
      ...baseSale,
      kind: 'repair',
      product: {
        id: 'device-1',
        article: '',
        name: 'Dell monitor',
        serialNumber: 'SN-1',
      },
      lineItems: [
        {
          id: 'line-device',
          kind: 'product',
          name: 'Dell monitor',
          price: 0,
          quantity: 1,
          warrantyPeriod: 0,
        },
        {
          id: 'line-service',
          kind: 'service',
          name: 'BIOS flash',
          price: 400,
          quantity: 1,
          warrantyPeriod: 0,
        },
      ],
    };

    expect(formatItemList(repair, 'orders')).toBe('Dell monitor');
    expect(formatItemList(repair, 'orders')).not.toContain('BIOS flash');
  });

  it('keeps product line items on Sales', () => {
    expect(formatItemList(baseSale, 'sales')).toBe('Part x2');
  });
});

describe('collectClientHistorySerials', () => {
  it('uses the repair device serial on Orders and skips services', () => {
    const repair: Sale = {
      ...baseSale,
      kind: 'repair',
      product: {
        id: 'device-1',
        article: '',
        name: 'Dell monitor',
        serialNumber: 'SN-1',
      },
      lineItems: [
        {
          id: 'line-device',
          kind: 'product',
          name: 'Dell monitor',
          price: 0,
          quantity: 1,
          warrantyPeriod: 0,
          serialNumbers: ['PART-SN'],
        },
      ],
    };

    expect(collectClientHistorySerials(repair, 'orders')).toEqual(['SN-1']);
  });

  it('hides repair placeholder serials', () => {
    const repair: Sale = {
      ...baseSale,
      kind: 'repair',
      product: {
        id: 'device-1',
        article: '',
        name: 'Dell monitor',
        serialNumber: 'REPAIR-PLACEHOLDER',
      },
    };

    expect(collectClientHistorySerials(repair, 'orders')).toEqual([]);
  });

  it('collects unique product serials on Sales', () => {
    const sale: Sale = {
      ...baseSale,
      lineItems: [
        {
          id: 'line-1',
          kind: 'product',
          name: 'TV box',
          price: 100,
          quantity: 1,
          warrantyPeriod: 0,
          serialNumbers: ['S000001', '  ', 'S000001'],
        },
        {
          id: 'line-2',
          kind: 'product',
          name: 'Cable',
          price: 50,
          quantity: 1,
          warrantyPeriod: 0,
          serialNumbers: ['S000002'],
        },
        {
          id: 'line-3',
          kind: 'service',
          name: 'Setup',
          price: 40,
          quantity: 1,
          warrantyPeriod: 0,
          serialNumbers: ['SVC-1'],
        },
      ],
    };

    expect(collectClientHistorySerials(sale, 'sales')).toEqual([
      'S000001',
      'S000002',
    ]);
  });
});

const revealClient = (patch: Partial<Client> = {}): Client => ({
  id: 'client-olga',
  phone: '+380501111111',
  phones: ['+380501111111'],
  name: 'Olga',
  email: '',
  address: '',
  registrationId: '',
  iban: '',
  note: '',
  status: 'new',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

const writeStoredFilters = (applied: Partial<ClientFilters>) => {
  const filters = { ...emptyFilters, ...applied };
  window.localStorage.setItem(
    clientsFiltersStorageKey,
    JSON.stringify({
      draftFilters: filters,
      appliedFilters: filters,
      searchValue: filters.query,
      isFilterOpen: true,
    }),
  );
};

describe('relaxStoredClientFiltersForClient', () => {
  it('clears a status filter that hides the client and remembers Clients tab', () => {
    writeStoredFilters({ status: 'vip' });

    const next = relaxStoredClientFiltersForClient(
      revealClient(),
      defaultClientStats,
    );

    expect(next.appliedFilters.status).toBe('all');
    expect(next.draftFilters.status).toBe('all');
    expect(next.searchValue).toBe('');
    expect(window.localStorage.getItem(clientsSuppliersTabStorageKey)).toBe(
      'clients',
    );
  });

  it('clears a search query that hides the client', () => {
    writeStoredFilters({ query: 'Petr' });

    const next = relaxStoredClientFiltersForClient(
      revealClient(),
      defaultClientStats,
    );

    expect(next.appliedFilters.query).toBe('');
    expect(next.draftFilters.query).toBe('');
    expect(next.searchValue).toBe('');
  });

  it('keeps a query that already matches the client name', () => {
    writeStoredFilters({ query: 'Olga' });

    const next = relaxStoredClientFiltersForClient(
      revealClient(),
      defaultClientStats,
    );

    expect(next.appliedFilters.query).toBe('Olga');
    expect(next.searchValue).toBe('Olga');
    expect(next.isFilterOpen).toBe(true);
  });

  it('does not touch named saved-filter presets', () => {
    writeStoredFilters({ query: 'Petr' });
    window.localStorage.setItem(
      clientsSuppliersSavedFiltersStorageKey,
      '{"kept":true}',
    );

    relaxStoredClientFiltersForClient(revealClient(), defaultClientStats);

    expect(
      window.localStorage.getItem(clientsSuppliersSavedFiltersStorageKey),
    ).toBe('{"kept":true}');
  });
});