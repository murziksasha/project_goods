import { describe, expect, it } from 'vitest';
import type { Sale } from '../model/types';
import {
  getSaleListItemSerial,
  getSaleListItemSerialNumbers,
  getSaleListLineItems,
  getSaleListPrimaryItem,
} from './sale-list-items';
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

  it.each([false, true])(
    'uses current products before services despite a stale snapshot (rapid=%s)',
    (isRapidSale) => {
      const currentSale = sale({
        isRapidSale,
        product: {
          id: 'old-product',
          article: 'OLD-ARTICLE',
          name: 'Diagnostics',
          serialNumber: 'OLD-SERIAL',
        },
        lineItems: [
          {
            id: 'service', kind: 'service', name: 'Setup',
            price: 50, quantity: 1, warrantyPeriod: 0,
          },
          {
            id: 'first', kind: 'product', productId: 'current-product',
            name: 'Current goods', price: 100, quantity: 2,
            warrantyPeriod: 0, serialNumbers: [' S000001 ', '', ' S000002 '],
          },
          {
            id: 'second', kind: 'product', name: 'Other goods',
            price: 200, quantity: 1, warrantyPeriod: 0,
          },
        ],
      });

      const primary = getSaleListPrimaryItem(currentSale);
      expect(primary?.name).toBe('Current goods');
      expect(getSaleListItemSerialNumbers(primary)).toEqual(['S000001', 'S000002']);
      expect(getSaleListItemSerial(primary)).toBe('S000001, S000002');
      expect(getSaleListLineItems(currentSale).map((item) => item.id)).toEqual([
        'service', 'first', 'second',
      ]);
      expect(saleMatchesListSearchQuery(currentSale, 'Other goods')).toBe(true);
      expect(saleMatchesListSearchQuery(currentSale, 'S000002')).toBe(true);
      for (const removed of ['Diagnostics', 'OLD-SERIAL', 'OLD-ARTICLE']) {
        expect(saleMatchesListSearchQuery(currentSale, removed)).toBe(false);
      }

      const serviceOnly = sale({
        ...currentSale,
        lineItems: currentSale.lineItems.filter((item) => item.kind === 'service'),
      });
      expect(getSaleListPrimaryItem(serviceOnly)?.name).toBe('Setup');
      expect(getSaleListItemSerial(getSaleListPrimaryItem(serviceOnly))).toBe('');
      // The snapshot helper used by repairs and other screens is unchanged.
      expect(getSaleProductName(currentSale)).toBe('Diagnostics');
      expect(getSaleProductSnapshot(currentSale).serialNumber).toBe('OLD-SERIAL');
    },
  );

  it.each([[], undefined])('does not revive an empty or missing composition (%s)', (lineItems) => {
    const emptySale = sale({
      product: { id: 'old-product', name: 'Removed', article: 'OLD', serialNumber: 'OLD-SN' },
      lineItems,
    });
    expect(getSaleListLineItems(emptySale)).toEqual([]);
    expect(getSaleListPrimaryItem(emptySale)).toBeNull();
    expect(getSaleListItemSerialNumbers(getSaleListPrimaryItem(emptySale))).toEqual([]);
    expect(getSaleListItemSerial(getSaleListPrimaryItem(emptySale))).toBe('');
    expect(getSaleListSearchValues(emptySale)).toEqual([]);
  });

  it('keeps article search only while the same stock product is a current row', () => {
    const currentSale = sale({
      product: { id: 'stock-1', name: 'Old title', article: 'ART-7', serialNumber: 'OLD-SN' },
      lineItems: [{
        id: 'line', kind: 'product', productId: 'stock-1', name: 'Renamed product',
        price: 100, quantity: 1, warrantyPeriod: 0,
      }],
    });
    expect(saleMatchesListSearchQuery(currentSale, 'ART-7')).toBe(true);
    expect(saleMatchesListSearchQuery(currentSale, 'Old title')).toBe(false);
    expect(saleMatchesListSearchQuery(currentSale, 'OLD-SN')).toBe(false);
    expect(getSaleListItemSerial(getSaleListPrimaryItem(currentSale))).toBe('');

    for (const productId of ['stock-2', undefined]) {
      const otherProduct = sale({
        ...currentSale,
        lineItems: [{ ...currentSale.lineItems[0], productId, name: 'Old title' }],
      });
      expect(saleMatchesListSearchQuery(otherProduct, 'ART-7')).toBe(false);
    }
    const serviceWithId = sale({
      ...currentSale,
      lineItems: [{ ...currentSale.lineItems[0], kind: 'service' }],
    });
    expect(saleMatchesListSearchQuery(serviceWithId, 'ART-7')).toBe(false);
  });
});
