import { describe, expect, it } from 'vitest';
import type { Sale } from '../model/types';
import {
  getSaleListSearchValues,
  getSaleProductName,
  getSaleProductSnapshot,
  saleMatchesListSearchQuery,
} from './sale-product';

const sale = (patch: Partial<Sale> = {}): Sale =>
  ({
    id: 'sale-1',
    recordNumber: 's000001',
    saleDate: '2026-01-01T00:00:00.000Z',
    quantity: 1,
    salePrice: 100,
    kind: 'sale',
    status: 'new',
    paidAmount: 0,
    note: '',
    timeline: [],
    paymentHistory: [],
    lineItems: [],
    client: { id: 'client-1', name: 'Client', phone: '+380000000001' },
    ...patch,
  }) as Sale;

describe('sale-product helpers', () => {
  it('uses the first service line item when no product lines exist', () => {
    const serviceOnlySale = sale({
      lineItems: [
        {
          id: 'service-1',
          kind: 'service',
          name: 'Screen cleaning',
          price: 150,
          quantity: 1,
          warrantyPeriod: 1,
        },
      ],
    });

    expect(getSaleProductName(serviceOnlySale)).toBe('Screen cleaning');
    expect(getSaleProductSnapshot(serviceOnlySale).name).toBe('Screen cleaning');
  });

  it('prefers product line items over service line items', () => {
    const mixedSale = sale({
      lineItems: [
        {
          id: 'product-1',
          kind: 'product',
          name: 'Cable',
          price: 100,
          quantity: 1,
          warrantyPeriod: 0,
        },
        {
          id: 'service-1',
          kind: 'service',
          name: 'Setup',
          price: 50,
          quantity: 1,
          warrantyPeriod: 1,
        },
      ],
    });

    expect(getSaleProductName(mixedSale)).toBe('Cable');
  });

  it('matches extra card product lines, not only the first Product cell', () => {
    const extraLineSale = sale({
      product: {
        id: 'p-mcc',
        article: '',
        name: '114719 Дієтична добавка MCC LIVESTA, 90 таб.',
        serialNumber: 'S000336',
      },
      lineItems: [
        {
          id: 'li-mcc',
          kind: 'product',
          productId: 'p-mcc',
          name: '114719 Дієтична добавка MCC LIVESTA, 90 таб.',
          price: 150,
          quantity: 1,
          warrantyPeriod: 0,
          serialNumbers: ['S000336'],
        },
        {
          id: 'li-bali',
          kind: 'product',
          productId: 'p-bali',
          name: '114527 Парфумована вода для жінок Bali, 50 мл',
          price: 260,
          quantity: 1,
          warrantyPeriod: 0,
          serialNumbers: ['S000367'],
        },
      ],
    });

    expect(getSaleProductName(extraLineSale)).toBe(
      '114719 Дієтична добавка MCC LIVESTA, 90 таб.',
    );
    expect(getSaleListSearchValues(extraLineSale)).toEqual(
      expect.arrayContaining([
        '114719 Дієтична добавка MCC LIVESTA, 90 таб.',
        '114527 Парфумована вода для жінок Bali, 50 мл',
        'S000336',
        'S000367',
      ]),
    );
    expect(
      saleMatchesListSearchQuery(
        extraLineSale,
        '114527 Парфумована вода для жінок Bali, 50 мл',
      ),
    ).toBe(true);
    expect(saleMatchesListSearchQuery(extraLineSale, 'S000367')).toBe(true);
    expect(saleMatchesListSearchQuery(extraLineSale, 'HDMI Cable')).toBe(false);
  });
});