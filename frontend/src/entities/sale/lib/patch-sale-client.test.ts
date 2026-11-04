import { describe, expect, it } from 'vitest';
import type { Client, Sale } from '../model/types';
import {
  mapCachedSalesClientSnapshot,
  patchSaleClientSnapshot,
} from './patch-sale-client';

const client: Client = {
  id: 'client-1',
  phone: '+380509999999',
  phones: ['+380509999999', '+380501111111'],
  name: 'Olga Updated',
  email: 'olga@example.com',
  address: 'Kyiv',
  registrationId: '123',
  iban: 'UA00',
  note: 'note',
  status: 'blacklist',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
};

const sale = (clientId: string): Sale => ({
  id: `sale-${clientId}`,
  recordNumber: 'r000001',
  saleDate: '2026-05-12T10:00:00.000Z',
  quantity: 1,
  salePrice: 100,
  kind: 'repair',
  status: 'new',
  paidAmount: 0,
  note: 'keep-note',
  timeline: [],
  paymentHistory: [],
  lineItems: [],
  discount: { mode: 'amount', value: 0 },
  client: {
    id: clientId,
    name: 'Old name',
    phone: '+380501111111',
    status: 'new',
  },
  product: {
    id: 'device-1',
    article: '',
    name: 'Unsaved device',
    serialNumber: 'SN-KEEP',
  },
  manager: null,
  master: { id: 'master-1', name: 'Master', role: 'master' },
  issuedBy: null,
  createdAt: '2026-05-12T10:00:00.000Z',
  updatedAt: '2026-05-12T10:00:00.000Z',
});

describe('patchSaleClientSnapshot', () => {
  it('updates client fields on the matching sale and leaves the order body', () => {
    const next = patchSaleClientSnapshot(sale('client-1'), client);

    expect(next.client).toEqual({
      id: 'client-1',
      name: 'Olga Updated',
      phone: '+380509999999',
      phones: ['+380509999999', '+380501111111'],
      status: 'blacklist',
      email: 'olga@example.com',
      address: 'Kyiv',
      registrationId: '123',
      iban: 'UA00',
    });
    expect(next.note).toBe('keep-note');
    expect(next.product?.name).toBe('Unsaved device');
    expect(next.product?.serialNumber).toBe('SN-KEEP');
    expect(next.master?.id).toBe('master-1');
  });

  it('leaves a sale for a different client unchanged', () => {
    const other = sale('client-2');
    expect(patchSaleClientSnapshot(other, client)).toBe(other);
  });
});

describe('mapCachedSalesClientSnapshot', () => {
  it('patches an array and a paged items list', () => {
    const matching = sale('client-1');
    const other = sale('client-2');
    const page = { items: [matching, other], total: 2 };

    const patchedArray = mapCachedSalesClientSnapshot(
      [matching, other],
      client,
    ) as Sale[];
    const patchedPage = mapCachedSalesClientSnapshot(page, client) as {
      items: Sale[];
      total: number;
    };

    expect(patchedArray[0]?.client.name).toBe('Olga Updated');
    expect(patchedArray[1]).toBe(other);
    expect(patchedPage.items[0]?.client.name).toBe('Olga Updated');
    expect(patchedPage.items[1]).toBe(other);
    expect(patchedPage.total).toBe(2);
  });

  it('patches a sale detail object', () => {
    const detail = sale('client-1');
    const next = mapCachedSalesClientSnapshot(detail, client) as Sale;
    expect(next.client.phone).toBe('+380509999999');
    expect(next.product?.serialNumber).toBe('SN-KEEP');
  });
});