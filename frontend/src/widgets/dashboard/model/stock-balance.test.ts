import { describe, expect, it } from 'vitest';
import type { Product } from '../../../entities/product/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import {
  buildProductWarehouseMetaById,
  filterStockProducts,
  getStockSupplierLabel,
  type StockSupplierOrderLink,
} from './stock-balance';

const product = (overrides: Partial<Product>): Product => ({
  id: 'p-1',
  name: 'Airmouse G10S',
  article: 'A-1',
  serialNumber: 'S-1',
  price: 100,
  salePriceOptions: [],
  note: '',
  quantity: 1,
  reservedQuantity: 0,
  freeQuantity: 1,
  isInStock: true,
  purchasePlace: '',
  purchaseDate: null,
  warrantyPeriod: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const sale = (overrides: Partial<Sale>): Sale => ({
  id: 's-1',
  recordNumber: 'SO-1',
  saleDate: '2026-01-01T00:00:00.000Z',
  quantity: 1,
  salePrice: 100,
  kind: 'sale',
  status: 'issued',
  paidAmount: 0,
  note: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [],
  client: {
    id: 'c-1',
    name: 'Client',
    phone: '+380000000000',
    status: 'new',
  },
  product: {
    id: '',
    article: '',
    name: '',
    serialNumber: '',
  },
  manager: null,
  master: null,
  issuedBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const filter = ({
  products,
  sales = [],
  supplierOrdersByProductId = {},
}: {
  products: Product[];
  sales?: Sale[];
  supplierOrdersByProductId?: Record<string, StockSupplierOrderLink[]>;
}) =>
  filterStockProducts({
    products,
    sales,
    query: '',
    searchMode: 'serial',
    filters: {
      name: '',
      serial: '',
      article: '',
      warehouse: '',
      supplier: '',
      buyer: '',
      location: '',
    },
    productWarehouseMetaById: buildProductWarehouseMetaById(products, []),
    supplierOrdersByProductId,
    buyersByProductName: {},
  });

describe('stock balance', () => {
  it('hides issued stock by strict product id', () => {
    const products = [product({ id: 'p-1' }), product({ id: 'p-2' })];

    expect(
      filter({
        products,
        sales: [sale({ product: { id: 'p-1', article: '', name: '', serialNumber: '' } })],
      }).map((item) => item.id),
    ).toEqual(['p-2']);
  });

  it('hides issued stock by exact serial only', () => {
    const products = [
      product({ id: 'p-1', serialNumber: 'ABC-1' }),
      product({ id: 'p-2', serialNumber: 'ABC-10' }),
    ];

    expect(
      filter({
        products,
        sales: [
          sale({
            product: {
              id: '',
              article: '',
              name: 'Airmouse G10S',
              serialNumber: 'ABC-1',
            },
          }),
        ],
      }).map((item) => item.id),
    ).toEqual(['p-2']);
  });

  it('does not link stock by similar product names', () => {
    const products = [
      product({ id: 'p-1', name: 'Airmouse G10S', serialNumber: 'S-1' }),
      product({ id: 'p-2', name: 'Airmouse G10S Pro', serialNumber: 'S-2' }),
    ];

    expect(
      filter({
        products,
        sales: [
          sale({
            product: {
              id: '',
              article: '',
              name: 'Airmouse G10S',
              serialNumber: '',
            },
          }),
        ],
      }).map((item) => item.id),
    ).toEqual(['p-1', 'p-2']);
  });

  it('maps warehouse and location by id, purchase place, then fallback', () => {
    const warehouses = [
      {
        id: 'w-1',
        name: 'Main',
        isActive: true,
        locations: [{ id: 'l-1', name: 'A1' }],
      },
      {
        id: 'w-2',
        name: 'Second',
        isActive: true,
        locations: [{ id: 'l-2', name: 'B1' }],
      },
    ];
    const products = [
      product({ id: 'p-1', warehouseId: 'w-2', locationId: 'l-2' }),
      product({ id: 'p-2', purchasePlace: 'Second' }),
      product({ id: 'p-3', purchasePlace: 'Unknown' }),
    ];

    expect(buildProductWarehouseMetaById(products, warehouses)).toMatchObject({
      'p-1': { warehouseName: 'Second', locationName: 'B1' },
      'p-2': { warehouseName: 'Second', locationName: 'B1' },
      'p-3': { warehouseName: 'Main', locationName: 'A1' },
    });
  });

  it('uses supplier order supplier before purchase place fallback', () => {
    const stockProduct = product({ purchasePlace: 'Legacy supplier' });

    expect(
      getStockSupplierLabel(stockProduct, [
        {
          order: { id: 'so-1', supplierName: 'Linked supplier' },
          itemIndex: 0,
          displayNumber: 'SO-1',
        },
      ]),
    ).toBe('Linked supplier');
    expect(getStockSupplierLabel(stockProduct, [])).toBe('Legacy supplier');
  });
});
