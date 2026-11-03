import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import type { Sale } from '../../../../../entities/sale';
import {
  saleMatchesClientFilter,
  saleMatchesListQuery,
} from './orders-list-search';

const t = ((key: string) =>
  key === 'orders.rapidSale.clientLabel' ? 'Rapid sale' : key) as TFunction;

const sale = (patch: Partial<Sale> = {}): Sale => ({
  id: 'sale-1',
  recordNumber: 'r000588',
  saleDate: '2026-01-01T00:00:00.000Z',
  quantity: 1,
  salePrice: 100,
  kind: 'sale',
  status: 'issued',
  paidAmount: 0,
  note: 'callback tomorrow',
  userNote: 'left a voicemail',
  timeline: [],
  paymentHistory: [],
  lineItems: [
    {
      id: 'line-1',
      kind: 'product',
      productId: 'product-1',
      name: 'Cable',
      price: 80,
      quantity: 1,
      warrantyPeriod: 0,
      serialNumbers: ['S000123'],
    },
  ],
  client: {
    id: 'client-1',
    name: 'Ivan',
    phone: '+380671112233',
    phones: ['+380671112233', '+380 (63) 111-22-33'],
    status: 'ok',
  },
  product: {
    id: 'product-1',
    article: 'ART-1',
    name: 'Old Nokia',
    serialNumber: 'SNAP-1',
  },
  manager: { id: 'manager-1', name: 'Olena', role: 'manager' },
  master: null,
  issuedBy: { id: 'issuer-1', name: 'Petro', role: 'manager' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

describe('saleMatchesListQuery', () => {
  it('matches full, partial, punctuated, and middle phone fragments', () => {
    const row = sale();
    expect(saleMatchesListQuery(row, '', 'sales', t)).toBe(true);
    expect(saleMatchesListQuery(row, '+38063', 'sales', t)).toBe(true);
    expect(saleMatchesListQuery(row, '380631112233', 'orders', t)).toBe(true);
    expect(saleMatchesListQuery(row, '(063) 111-22-33', 'sales', t)).toBe(true);
    expect(saleMatchesListQuery(row, '1112233', 'kanban', t)).toBe(true);
    expect(saleMatchesListQuery(row, '+380', 'sales', t)).toBe(false);
    expect(saleMatchesListQuery(row, '+3806', 'orders', t)).toBe(false);
  });

  it('matches a legacy snapshot that only stores the primary phone', () => {
    const legacy = sale({
      client: {
        id: 'client-2',
        name: 'Anna',
        phone: '+380 (63) 111-22-33',
        status: 'ok',
      },
    });
    expect(saleMatchesListQuery(legacy, '063111', 'orders', t)).toBe(true);
    expect(saleMatchesListQuery(legacy, '+38067', 'orders', t)).toBe(false);
  });

  it('keeps names, numbers, notes, products, serials, and managers on text search', () => {
    const row = sale();
    expect(saleMatchesListQuery(row, 'ivan', 'sales', t)).toBe(true);
    expect(saleMatchesListQuery(row, 'r000588', 'orders', t)).toBe(true);
    expect(saleMatchesListQuery(row, 'voicemail', 'sales', t)).toBe(true);
    expect(saleMatchesListQuery(row, 'callback', 'kanban', t)).toBe(true);
    expect(saleMatchesListQuery(row, 'S000123', 'sales', t)).toBe(true);
    expect(saleMatchesListQuery(row, 'Cable', 'sales', t)).toBe(true);
    expect(saleMatchesListQuery(row, 'ART-1', 'sales', t)).toBe(true);
    expect(saleMatchesListQuery(row, 'Olena', 'sales', t)).toBe(true);
    expect(saleMatchesListQuery(row, 'Petro', 'sales', t)).toBe(true);
    expect(saleMatchesListQuery(row, 'issued', 'sales', t)).toBe(false);
  });

  it('keeps sales item search on current rows and repair search on the device snapshot', () => {
    const row = sale();
    expect(saleMatchesListQuery(row, 'Old Nokia', 'sales', t)).toBe(false);
    expect(saleMatchesListQuery(row, 'SNAP-1', 'sales', t)).toBe(false);
    expect(saleMatchesListQuery(row, 'Old Nokia', 'orders', t)).toBe(true);
    expect(saleMatchesListQuery(row, 'Olena', 'orders', t)).toBe(false);

    const detachedArticle = sale({
      lineItems: [
        {
          id: 'line-2',
          kind: 'product',
          productId: 'other-product',
          name: 'Adapter',
          price: 10,
          quantity: 1,
          warrantyPeriod: 0,
        },
      ],
    });
    expect(saleMatchesListQuery(detachedArticle, 'ART-1', 'sales', t)).toBe(false);
  });

  it('does not treat a serial as a phone hit', () => {
    const row = sale({
      client: {
        id: 'client-1',
        name: 'Ivan',
        phone: '+380671112233',
        phones: ['+380671112233'],
        status: 'ok',
      },
      lineItems: [],
      note: '',
      userNote: '',
    });
    expect(saleMatchesListQuery(row, 'S000123', 'sales', t)).toBe(false);
  });
});

describe('saleMatchesClientFilter', () => {
  it('matches client name, record number, and phones, not notes or status', () => {
    const row = sale();
    expect(saleMatchesClientFilter(row, 'Ivan', t)).toBe(true);
    expect(saleMatchesClientFilter(row, 'r000588', t)).toBe(true);
    expect(saleMatchesClientFilter(row, '+38063', t)).toBe(true);
    expect(saleMatchesClientFilter(row, '(063) 111-22-33', t)).toBe(true);
    expect(saleMatchesClientFilter(row, '+380', t)).toBe(false);
    expect(saleMatchesClientFilter(row, 'voicemail', t)).toBe(false);
    expect(saleMatchesClientFilter(row, 'issued', t)).toBe(false);
    expect(saleMatchesClientFilter(row, 'Olena', t)).toBe(false);
  });
});
