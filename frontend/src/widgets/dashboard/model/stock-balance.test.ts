import { describe, expect, it } from 'vitest';
import type { Product } from '../../../entities/product';
import type { Sale } from '../../../entities/sale';
import type { SupplierOrder } from '../../../entities/supplier-order';
import {
  allStockStatusFilters,
  buildSalesByProductId,
  buildSupplierOrdersByProductId,
  buildProductWarehouseMetaById,
  defaultStockStatusFilters,
  filterStockProducts,
  getIssuedSaleProductIds,
  getStockSupplierLabel,
  groupStockProductsByModel,
  isDefaultStockStatusFilter,
  isProductNameLikeStockQuery,
  isSaleLineItemLinkedToStockProduct,
  matchesStockSearchQuery,
  matchesStockStatusChips,
  mergeSalesWithStockOrderLinks,
  normalizeStockStatusFilters,
  toggleAllStockStatusFilters,
  toggleStockStatusFilter,
  type StockSearchMode,
  type StockStatusFilter,
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
  query = '',
  searchMode = 'serial',
  stockStatuses = defaultStockStatusFilters,
}: {
  products: Product[];
  sales?: Sale[];
  supplierOrdersByProductId?: Record<string, StockSupplierOrderLink[]>;
  query?: string;
  searchMode?: StockSearchMode;
  stockStatuses?: readonly StockStatusFilter[];
}) =>
  filterStockProducts({
    products,
    sales,
    query,
    searchMode,
    filters: {
      name: '',
      serial: '',
      article: '',
      warehouse: '',
      supplier: '',
      buyer: '',
      location: '',
    },
    stockStatuses,
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

  it('finds remaining stock by product name even in serial search mode', () => {
    const products = [
      product({
        id: 'p-sold',
        name: '114527 Парфумована вода для жінок Bali, 50 мл',
        serialNumber: 'S000101',
      }),
      product({
        id: 'p-free',
        name: '114527 Парфумована вода для жінок Bali, 50 мл',
        serialNumber: 'S000102',
      }),
    ];

    expect(
      filter({
        products,
        sales: [
          sale({
            status: 'issued',
            product: {
              id: 'p-sold',
              article: '',
              name: '114527 Парфумована вода для жінок Bali, 50 мл',
              serialNumber: 'S000101',
            },
          }),
        ],
        query: '114527 Парфумована вода для жінок Bali, 50 мл',
        searchMode: 'serial',
      }).map((item) => item.id),
    ).toEqual(['p-free']);
  });

  it('keeps serial-mode scans matching only serials', () => {
    const products = [
      product({ id: 'p-1', name: 'Cable S000102', serialNumber: 'S000101' }),
      product({ id: 'p-2', name: 'Hub', serialNumber: 'S000102' }),
    ];

    expect(
      filter({
        products,
        query: 'S000102',
        searchMode: 'serial',
      }).map((item) => item.id),
    ).toEqual(['p-2']);
  });
});

describe('stock search query matching', () => {
  it('treats spaced or cyrillic queries as product names', () => {
    expect(isProductNameLikeStockQuery('S000102')).toBe(false);
    expect(isProductNameLikeStockQuery('114527')).toBe(false);
    expect(
      isProductNameLikeStockQuery(
        '114527 Парфумована вода для жінок Bali, 50 мл',
      ),
    ).toBe(true);
    expect(isProductNameLikeStockQuery('Парфумована')).toBe(true);
  });

  it('does not broaden warehouse or supplier search modes', () => {
    const stockProduct = product({
      name: '114527 Парфумована вода для жінок Bali, 50 мл',
      serialNumber: 'S000102',
      purchasePlace: 'Main',
    });

    expect(
      matchesStockSearchQuery({
        product: stockProduct,
        query: '114527 Парфумована вода для жінок Bali, 50 мл',
        searchMode: 'warehouse',
        meta: {
          warehouseId: 'w-1',
          warehouseName: 'Main',
          locationId: 'l-1',
          locationName: 'A1',
        },
        supplierLabel: 'Livesta',
      }),
    ).toBe(false);
  });
});

describe('groupStockProductsByModel', () => {
  it('groups units that share name and article', () => {
    const groups = groupStockProductsByModel([
      product({ id: 'p-1', serialNumber: 'S-1' }),
      product({ id: 'p-2', serialNumber: 'S-2' }),
      product({
        id: 'p-3',
        name: 'Other',
        article: 'B-1',
        serialNumber: 'S-3',
      }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.products.map((item) => item.id)).toEqual(['p-1', 'p-2']);
    expect(groups[1]?.products.map((item) => item.id)).toEqual(['p-3']);
  });
});

describe('mergeSalesWithStockOrderLinks', () => {
  it('hides an issued unit whose sale is outside the loaded list and leaves quantity unchanged', () => {
    const unit = product({
      id: 'p-113',
      serialNumber: 'S000113',
      quantity: 1,
    });
    const sales = mergeSalesWithStockOrderLinks(
      [],
      [
        {
          productId: 'p-113',
          serialNumber: 'S000113',
          saleId: 'sale-old',
          recordNumber: 'r000255',
          kind: 'sale',
          status: 'issued',
        },
      ],
    );

    expect(filter({ products: [unit], sales }).map((item) => item.id)).toEqual(
      [],
    );
    expect(unit.quantity).toBe(1);
  });

  it('keeps a returned unit visible and exposes its order number', () => {
    const unit = product({
      id: 'p-113',
      serialNumber: 'S000113',
      quantity: 1,
    });
    const sales = mergeSalesWithStockOrderLinks(
      [],
      [
        {
          productId: 'p-113',
          serialNumber: 'S000113',
          saleId: 'sale-old',
          recordNumber: 'r000255',
          kind: 'sale',
          status: 'returned',
        },
      ],
    );

    expect(filter({ products: [unit], sales }).map((item) => item.id)).toEqual([
      'p-113',
    ]);
    expect(
      buildSalesByProductId([unit], sales)['p-113']?.map(
        (item) => item.recordNumber,
      ),
    ).toEqual(['r000255']);
    expect(unit.quantity).toBe(1);
  });

  it('keeps a loaded sale and adds only sales missing from that list', () => {
    const loaded = sale({
      id: 'sale-known',
      recordNumber: 'r000001',
      status: 'new',
    });
    const merged = mergeSalesWithStockOrderLinks(
      [loaded],
      [
        {
          productId: 'p-1',
          serialNumber: 'S-1',
          saleId: 'sale-known',
          recordNumber: 'r000001',
          kind: 'sale',
          status: 'new',
        },
        {
          productId: 'p-1',
          serialNumber: 'S-1',
          saleId: 'sale-old',
          recordNumber: 'r000255',
          kind: 'sale',
          status: 'issued',
        },
      ],
    );

    expect(merged).toHaveLength(2);
    expect(merged[0]).toBe(loaded);
    expect(merged[1]?.id).toBe('sale-old');
  });
});

describe('stock status chips', () => {
  it('separates free, in_order, sold, issued_repair, and excluded repair statuses', () => {
    const pFree = product({ id: 'p-free', serialNumber: 'S-FREE' });
    const pSaleNew = product({ id: 'p-sale-new', serialNumber: 'S-NEW' });
    const pSaleReturned = product({ id: 'p-returned', serialNumber: 'S-RET' });
    const pSaleAway = product({ id: 'p-away', serialNumber: 'S-AWAY' });
    const pRepairReady = product({ id: 'p-ready', serialNumber: 'S-READY' });
    const pSold = product({ id: 'p-sold', serialNumber: 'S-SOLD' });
    const pIssuedRepair = product({ id: 'p-rep-iss', serialNumber: 'S-REP-ISS' });
    const pIssuedNoRep = product({ id: 'p-rep-nor', serialNumber: 'S-REP-NOR' });
    const pRejected = product({ id: 'p-rejected', serialNumber: 'S-REJ' });
    const pNotPicked = product({ id: 'p-not-picked', serialNumber: 'S-NPU' });
    const pZeroSold = product({
      id: 'p-zero',
      serialNumber: 'S-ZERO',
      quantity: 0,
    });

    const allProducts = [
      pFree,
      pSaleNew,
      pSaleReturned,
      pSaleAway,
      pRepairReady,
      pSold,
      pIssuedRepair,
      pIssuedNoRep,
      pRejected,
      pNotPicked,
      pZeroSold,
    ];
    const salesList = [
      sale({
        id: 's-new',
        kind: 'sale',
        status: 'new',
        product: { id: pSaleNew.id, article: '', name: '', serialNumber: '' },
      }),
      sale({
        id: 's-ret',
        kind: 'sale',
        status: 'returned',
        product: { id: pSaleReturned.id, article: '', name: '', serialNumber: '' },
      }),
      sale({
        id: 's-away',
        kind: 'sale',
        status: 'away',
        product: { id: pSaleAway.id, article: '', name: '', serialNumber: '' },
      }),
      sale({
        id: 's-ready',
        kind: 'repair',
        status: 'ready',
        product: { id: pRepairReady.id, article: '', name: '', serialNumber: '' },
      }),
      sale({
        id: 's-sold',
        kind: 'sale',
        status: 'issued',
        product: { id: pSold.id, article: '', name: '', serialNumber: '' },
      }),
      sale({
        id: 's-rep-iss',
        kind: 'repair',
        status: 'issued',
        product: { id: pIssuedRepair.id, article: '', name: '', serialNumber: '' },
      }),
      sale({
        id: 's-rep-nor',
        kind: 'repair',
        status: 'issuedWithoutRepair',
        product: { id: pIssuedNoRep.id, article: '', name: '', serialNumber: '' },
      }),
      sale({
        id: 's-rej',
        kind: 'repair',
        status: 'clientRejected',
        product: { id: pRejected.id, article: '', name: '', serialNumber: '' },
      }),
      sale({
        id: 's-npu',
        kind: 'repair',
        status: 'notPickedUp',
        product: { id: pNotPicked.id, article: '', name: '', serialNumber: '' },
      }),
      sale({
        id: 's-zero',
        kind: 'sale',
        status: 'issued',
        product: { id: pZeroSold.id, article: '', name: '', serialNumber: '' },
      }),
    ];

    expect(
      filter({ products: allProducts, sales: salesList }).map((p) => p.id),
    ).toEqual(['p-free', 'p-sale-new', 'p-returned', 'p-away', 'p-ready']);

    expect(
      filter({
        products: allProducts,
        sales: salesList,
        stockStatuses: ['free'],
      }).map((p) => p.id),
    ).toEqual(['p-free']);

    expect(
      filter({
        products: allProducts,
        sales: salesList,
        stockStatuses: ['in_order'],
      }).map((p) => p.id),
    ).toEqual(['p-sale-new', 'p-returned', 'p-away', 'p-ready']);

    expect(
      filter({
        products: allProducts,
        sales: salesList,
        stockStatuses: ['sold'],
      }).map((p) => p.id),
    ).toEqual(['p-sold']);

    expect(
      filter({
        products: allProducts,
        sales: salesList,
        stockStatuses: ['issued_repair'],
      }).map((p) => p.id),
    ).toEqual(['p-rep-iss', 'p-rep-nor']);

    // Selecting all 4 chips by hand excludes clientRejected and notPickedUp
    expect(
      filter({
        products: allProducts,
        sales: salesList,
        stockStatuses: ['free', 'in_order', 'sold', 'issued_repair'],
      }).map((p) => p.id),
    ).toEqual([
      'p-free',
      'p-sale-new',
      'p-returned',
      'p-away',
      'p-ready',
      'p-sold',
      'p-rep-iss',
      'p-rep-nor',
    ]);

    // All includes every quantity > 0 unit including clientRejected and notPickedUp, never quantity 0
    expect(
      filter({
        products: allProducts,
        sales: salesList,
        stockStatuses: allStockStatusFilters,
      }).map((p) => p.id),
    ).toEqual([
      'p-free',
      'p-sale-new',
      'p-returned',
      'p-away',
      'p-ready',
      'p-sold',
      'p-rep-iss',
      'p-rep-nor',
      'p-rejected',
      'p-not-picked',
    ]);

    expect(
      filter({
        products: allProducts,
        sales: salesList,
        stockStatuses: [],
      }),
    ).toEqual([]);
  });

  it('hides rows with handoff bindings even when another ordinary binding matches', () => {
    expect(
      matchesStockStatusChips(
        [
          { kind: 'sale', status: 'issued' },
          { kind: 'repair', status: 'paid' },
        ],
        ['free', 'in_order'],
      ),
    ).toBe(false);
    expect(
      matchesStockStatusChips(
        [
          { kind: 'sale', status: 'issued' },
          { kind: 'repair', status: 'paid' },
        ],
        ['sold'],
      ),
    ).toBe(true);
    expect(
      matchesStockStatusChips(
        [
          { kind: 'repair', status: 'issuedWithoutRepair' },
          { kind: 'repair', status: 'ready' },
        ],
        ['in_order'],
      ),
    ).toBe(false);
    expect(
      matchesStockStatusChips(
        [
          { kind: 'repair', status: 'issuedWithoutRepair' },
          { kind: 'repair', status: 'ready' },
        ],
        ['issued_repair'],
      ),
    ).toBe(true);
    expect(
      matchesStockStatusChips(
        [
          { kind: 'repair', status: 'clientRejected' },
          { kind: 'repair', status: 'diagnostics' },
        ],
        ['in_order'],
      ),
    ).toBe(true);
  });

  it('toggles chips, All, normalization, and quiet badge check', () => {
    expect(toggleAllStockStatusFilters(['free', 'in_order'])).toEqual([
      'all',
      'free',
      'in_order',
      'sold',
      'issued_repair',
    ]);
    expect(toggleAllStockStatusFilters(allStockStatusFilters)).toEqual([]);
    expect(toggleStockStatusFilter(allStockStatusFilters, 'sold')).toEqual([
      'free',
      'in_order',
      'issued_repair',
    ]);
    const manualFour = toggleStockStatusFilter(
      ['free', 'in_order', 'sold'],
      'issued_repair',
    );
    expect(manualFour).toEqual(['free', 'in_order', 'sold', 'issued_repair']);
    expect(manualFour).not.toContain('all');

    expect(normalizeStockStatusFilters(undefined)).toEqual([
      'free',
      'in_order',
    ]);
    expect(normalizeStockStatusFilters([])).toEqual([]);
    expect(normalizeStockStatusFilters(['all'])).toEqual(allStockStatusFilters);

    expect(isDefaultStockStatusFilter(['free', 'in_order'])).toBe(true);
    expect(isDefaultStockStatusFilter(['in_order', 'free'])).toBe(true);
    expect(isDefaultStockStatusFilter([])).toBe(false);
    expect(isDefaultStockStatusFilter(['free'])).toBe(false);
    expect(isDefaultStockStatusFilter(allStockStatusFilters)).toBe(false);
  });
});
