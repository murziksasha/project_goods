import { describe, expect, it } from 'vitest';
import type { Product } from '../../../entities/product/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
import {
  buildSalesByProductId,
  buildSupplierOrdersByProductId,
  buildProductWarehouseMetaById,
  filterStockProducts,
  getIssuedSaleProductIds,
  getStockSupplierLabel,
  isSaleLineItemLinkedToStockProduct,
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

const supplierOrder = (
  overrides: Partial<SupplierOrder> = {},
): SupplierOrder => ({
  id: 'so-1',
  orderBaseId: 'SO-1',
  supplierId: 'supplier-1',
  supplierName: 'Linked supplier',
  deliveryDate: '2026-01-01T00:00:00.000Z',
  supplyType: 'Local',
  number: 'SO-1',
  note: '',
  createdBy: 'Owner',
  status: 'stocked',
  paymentStatus: 'pending',
  receiptStatus: 'received',
  total: 100,
  paid: 0,
  isFavorite: false,
  items: [
    {
      lineId: 'line-1',
      itemIndex: 0,
      catalogProductId: 'catalog-1',
      productName: 'Airmouse G10S',
      quantity: 1,
      price: 100,
      receiptStatus: 'received',
    },
  ],
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

  it('links supplier order only through exact product provenance', () => {
    const products = [
      product({
        id: 'p-linked',
        supplierOrderId: 'so-1',
        supplierOrderItemIndex: 0,
      }),
      product({ id: 'p-legacy', name: 'Airmouse G10S' }),
    ];
    const links = buildSupplierOrdersByProductId({
      products,
      supplierOrders: [supplierOrder()],
    });

    expect(links['p-linked'].map((link) => link.displayNumber)).toEqual([
      'SO-1',
    ]);
    expect(links['p-legacy']).toEqual([]);
  });

  it('does not infer supplier order from matching name or catalog product', () => {
    const products = [
      product({
        id: 'p-new',
        name: 'Patchcord 1m',
        supplierOrderId: '',
        supplierOrderItemIndex: undefined,
      }),
    ];
    const links = buildSupplierOrdersByProductId({
      products,
      supplierOrders: [
        supplierOrder({
          id: 'so-old',
          number: 'SO-OLD',
          orderBaseId: 'SO-OLD',
          items: [
            {
              lineId: 'line-old',
              itemIndex: 0,
              catalogProductId: 'catalog-patchcord',
              productName: 'Patchcord 1m',
              quantity: 1,
              price: 35,
              receiptStatus: 'received',
            },
          ],
        }),
      ],
    });

    expect(links['p-new']).toEqual([]);
  });

  it('ignores product provenance that points to a missing supplier order item', () => {
    const links = buildSupplierOrdersByProductId({
      products: [
        product({
          id: 'p-linked',
          supplierOrderId: 'so-1',
          supplierOrderItemIndex: 9,
        }),
      ],
      supplierOrders: [supplierOrder()],
    });

    expect(links['p-linked']).toEqual([]);
  });

  it('links serialized stock only when serial numbers are bound', () => {
    const stockProduct = product({ id: 'p-1', serialNumber: 'S-1' });
    const linkedItem = {
      id: 'line-1',
      kind: 'product' as const,
      productId: 'p-1',
      name: 'Airmouse G10S',
      price: 100,
      quantity: 1,
      warrantyPeriod: 0,
      serialNumbers: ['S-1'],
    };
    const unboundItem = {
      ...linkedItem,
      serialNumbers: [] as string[],
    };

    expect(
      isSaleLineItemLinkedToStockProduct(linkedItem, stockProduct),
    ).toBe(true);
    expect(
      isSaleLineItemLinkedToStockProduct(unboundItem, stockProduct),
    ).toBe(false);
  });

  it('keeps bulk stock linked by product id without serial numbers', () => {
    const bulkProduct = product({ id: 'p-bulk', serialNumber: '' });
    const bulkItem = {
      id: 'line-bulk',
      kind: 'product' as const,
      productId: 'p-bulk',
      name: 'Patchcord 1m',
      price: 35,
      quantity: 4,
      warrantyPeriod: 0,
      serialNumbers: [] as string[],
    };

    expect(
      isSaleLineItemLinkedToStockProduct(bulkItem, bulkProduct),
    ).toBe(true);
  });

  it('does not map client order for unbound serialized line items', () => {
    const products = [product({ id: 'p-1', serialNumber: 'S-1' })];
    const linkedSales = buildSalesByProductId(products, [
      sale({
        id: 's-bound',
        recordNumber: 'SO-BOUND',
        lineItems: [
          {
            id: 'line-1',
            kind: 'product',
            productId: 'p-1',
            name: 'Airmouse G10S',
            price: 100,
            quantity: 1,
            warrantyPeriod: 0,
            serialNumbers: ['S-1'],
          },
        ],
      }),
      sale({
        id: 's-unbound',
        recordNumber: 'SO-UNBOUND',
        lineItems: [
          {
            id: 'line-2',
            kind: 'product',
            productId: 'p-1',
            name: 'Airmouse G10S',
            price: 100,
            quantity: 1,
            warrantyPeriod: 0,
            serialNumbers: [],
          },
        ],
      }),
    ]);

    expect(linkedSales['p-1']?.map((item) => item.recordNumber)).toEqual([
      'SO-BOUND',
    ]);
  });

  it('does not hide issued serialized stock when serials were unbound', () => {
    const products = [product({ id: 'p-1', serialNumber: 'S-1' })];

    expect(
      getIssuedSaleProductIds(products, [
        sale({
          status: 'issued',
          lineItems: [
            {
              id: 'line-1',
              kind: 'product',
              productId: 'p-1',
              name: 'Airmouse G10S',
              price: 100,
              quantity: 1,
              warrantyPeriod: 0,
              serialNumbers: [],
            },
          ],
        }),
      ]).has('p-1'),
    ).toBe(false);

    expect(
      filter({
        products,
        sales: [
          sale({
            status: 'issued',
            lineItems: [
              {
                id: 'line-1',
                kind: 'product',
                productId: 'p-1',
                name: 'Airmouse G10S',
                price: 100,
                quantity: 1,
                warrantyPeriod: 0,
                serialNumbers: [],
              },
            ],
          }),
        ],
      }).map((item) => item.id),
    ).toEqual(['p-1']);
  });
});
