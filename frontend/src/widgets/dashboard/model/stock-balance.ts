import type { Product } from '../../../entities/product';
import type { Sale, StockOrderLink } from '../../../entities/sale';
import { getSaleProductSerialNumber } from '../../../entities/sale';
import type { SupplierOrder } from '../../../entities/supplier-order';
import { buildSupplierOrderItemNumber } from './supplier-order-utils';

export type StockSearchMode =
  | 'serial'
  | 'name'
  | 'article'
  | 'warehouse'
  | 'supplier';

export type StockStatusChip =
  | 'free'
  | 'in_order'
  | 'sold'
  | 'issued_repair';

export type StockStatusFilter = 'all' | StockStatusChip;

export const stockStatusChipOptions: readonly StockStatusChip[] = [
  'free',
  'in_order',
  'sold',
  'issued_repair',
];

export const allStockStatusFilters: readonly StockStatusFilter[] = [
  'all',
  ...stockStatusChipOptions,
];

export const defaultStockStatusFilters: readonly StockStatusFilter[] = [
  'free',
  'in_order',
];

export type StockFilters = {
  name: string;
  serial: string;
  article: string;
  warehouse: string;
  supplier: string;
  buyer: string;
  location: string;
};

export type StockWarehouseLocation = { id: string; name: string };

export type StockWarehouseItem = {
  id: string;
  name: string;
  isActive: boolean;
  locations: StockWarehouseLocation[];
};

export type StockWarehouseMeta = {
  warehouseId: string;
  warehouseName: string;
  locationId: string;
  locationName: string;
};

export type StockSupplierOrderLink<
  TOrder extends Pick<SupplierOrder, 'id' | 'supplierName'> = Pick<
    SupplierOrder,
    'id' | 'supplierName'
  >,
> = {
  order: TOrder;
  itemIndex: number;
  displayNumber: string;
};

const normalizeText = (value: string | null | undefined) =>
  String(value ?? '').trim().toLowerCase();

export const normalizeSaleStatus = (value: string | null | undefined) =>
  normalizeText(value).replace(/[\s_-]+/g, '');

export const isIssuedSaleStatus = (value: string | null | undefined) => {
  const normalized = normalizeSaleStatus(value);
  return (
    normalized === 'issued' ||
    normalized === 'issuedwithoutrepair' ||
    normalized === 'issuedwithoutrepairing'
  );
};

const isExcludedRepairChipStatus = (normalizedStatus: string) =>
  normalizedStatus === 'clientrejected' || normalizedStatus === 'notpickedup';

const isInOrderSaleStatus = (normalizedStatus: string) =>
  normalizedStatus === 'new' ||
  normalizedStatus === 'reserved' ||
  normalizedStatus === 'paid' ||
  normalizedStatus === 'returned' ||
  normalizedStatus === 'away';

export type StockOrderBindingFlags = {
  hasSold: boolean;
  hasIssuedRepair: boolean;
  hasInOrder: boolean;
};

export const classifyStockOrderBindings = (
  linkedSales: ReadonlyArray<Pick<StockSaleLink, 'kind' | 'status'>>,
): StockOrderBindingFlags => {
  let hasSold = false;
  let hasIssuedRepair = false;
  let hasInOrder = false;

  linkedSales.forEach((sale) => {
    const normalized = normalizeSaleStatus(sale.status);
    if (!normalized) return;

    if (sale.kind === 'sale') {
      if (normalized === 'issued') {
        hasSold = true;
      } else if (isInOrderSaleStatus(normalized)) {
        hasInOrder = true;
      }
      return;
    }

    if (isIssuedSaleStatus(normalized)) {
      hasIssuedRepair = true;
    } else if (!isExcludedRepairChipStatus(normalized)) {
      hasInOrder = true;
    }
  });

  return { hasSold, hasIssuedRepair, hasInOrder };
};

export const isStockStatusFilterOption = (
  value: unknown,
): value is StockStatusFilter =>
  typeof value === 'string' &&
  allStockStatusFilters.includes(value as StockStatusFilter);

export const normalizeStockStatusFilters = (
  value: unknown,
  fallback: readonly StockStatusFilter[] = defaultStockStatusFilters,
): StockStatusFilter[] => {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const filtered = Array.from(new Set(value.filter(isStockStatusFilterOption)));
  if (filtered.includes('all')) {
    return [...allStockStatusFilters];
  }
  return filtered;
};

export const toggleStockStatusFilter = (
  selected: readonly StockStatusFilter[],
  chip: StockStatusChip,
): StockStatusFilter[] => {
  if (selected.includes(chip)) {
    return selected.filter((item) => item !== chip && item !== 'all');
  }
  return [...selected.filter((item) => item !== 'all'), chip];
};

export const toggleAllStockStatusFilters = (
  selected: readonly StockStatusFilter[],
): StockStatusFilter[] => {
  if (selected.includes('all')) {
    return [];
  }
  return [...allStockStatusFilters];
};

export const isDefaultStockStatusFilter = (
  selected: readonly StockStatusFilter[],
): boolean => {
  if (selected.includes('all')) return false;
  const unique = Array.from(new Set(selected));
  return (
    unique.length === defaultStockStatusFilters.length &&
    defaultStockStatusFilters.every((item) => unique.includes(item))
  );
};

export const matchesStockStatusChips = (
  linkedSales: ReadonlyArray<Pick<StockSaleLink, 'kind' | 'status'>>,
  stockStatuses: readonly StockStatusFilter[] = defaultStockStatusFilters,
): boolean => {
  if (stockStatuses.includes('all')) {
    return true;
  }
  if (stockStatuses.length === 0) {
    return false;
  }
  if (linkedSales.length === 0) {
    return stockStatuses.includes('free');
  }

  const { hasSold, hasIssuedRepair, hasInOrder } =
    classifyStockOrderBindings(linkedSales);

  if (hasSold || hasIssuedRepair) {
    return (
      (hasSold && stockStatuses.includes('sold')) ||
      (hasIssuedRepair && stockStatuses.includes('issued_repair'))
    );
  }

  return hasInOrder && stockStatuses.includes('in_order');
};

type SaleLineItemLink = Pick<
  Sale['lineItems'][number],
  'kind' | 'productId' | 'serialNumbers'
>;

type StockProductLink = Pick<Product, 'id' | 'serialNumber'>;

export const isSaleLineItemLinkedToStockProduct = (
  item: SaleLineItemLink,
  product: StockProductLink,
): boolean => {
  if (item.kind !== 'product') return false;

  const productSerial = normalizeText(product.serialNumber);
  const itemSerials = (item.serialNumbers ?? [])
    .map(normalizeText)
    .filter(Boolean);

  if (productSerial && itemSerials.includes(productSerial)) {
    return true;
  }

  if (item.productId === product.id) {
    if (!productSerial) return true;
    return itemSerials.includes(productSerial);
  }

  return false;
};

const buildProductIdsBySerial = (products: Product[]) => {
  const productIdsBySerial = new Map<string, string[]>();

  products.forEach((product) => {
    const serial = normalizeText(product.serialNumber);
    if (!serial) return;
    productIdsBySerial.set(serial, [
      ...(productIdsBySerial.get(serial) ?? []),
      product.id,
    ]);
  });

  return productIdsBySerial;
};

export const getStockProductIdsLinkedToSale = (
  sale: Pick<Sale, 'product' | 'lineItems'>,
  products: Product[],
): string[] => {
  const linkedProductIds = new Set<string>();
  const productsById = new Map(products.map((product) => [product.id, product]));
  const productIdsBySerial = buildProductIdsBySerial(products);

  const saleProductId = sale.product?.id?.trim();
  if (saleProductId) {
    linkedProductIds.add(saleProductId);
  }

  const saleSerial = normalizeText(getSaleProductSerialNumber(sale));
  (saleSerial ? productIdsBySerial.get(saleSerial) ?? [] : []).forEach(
    (productId) => linkedProductIds.add(productId),
  );

  (sale.lineItems ?? []).forEach((item) => {
    if (item.kind !== 'product') return;

    const itemSerials = (item.serialNumbers ?? [])
      .map(normalizeText)
      .filter(Boolean);

    itemSerials.forEach((serial) =>
      (productIdsBySerial.get(serial) ?? []).forEach((productId) =>
        linkedProductIds.add(productId),
      ),
    );

    const productId = item.productId?.trim();
    if (!productId) return;

    const product = productsById.get(productId);
    if (!product) return;

    if (isSaleLineItemLinkedToStockProduct(item, product)) {
      linkedProductIds.add(productId);
    }
  });

  return Array.from(linkedProductIds);
};

export const buildSalesByProductId = (
  products: Product[],
  sales: Sale[],
): Record<string, Sale[]> =>
  sales.reduce<Record<string, Sale[]>>((acc, sale) => {
    getStockProductIdsLinkedToSale(sale, products).forEach((productId) => {
      acc[productId] = [...(acc[productId] ?? []), sale];
    });
    return acc;
  }, {});

export type StockSaleLink = Pick<Sale, 'status' | 'product' | 'lineItems'> & {
  kind?: Sale['kind'];
};

export const getIssuedSaleProductIds = (
  products: Product[],
  sales: StockSaleLink[],
) => {
  const issuedProductIds = new Set<string>();

  sales.forEach((sale) => {
    if (!isIssuedSaleStatus(sale.status)) return;

    getStockProductIdsLinkedToSale(sale, products).forEach((productId) =>
      issuedProductIds.add(productId),
    );
  });

  return issuedProductIds;
};

export const buildStockSaleLinksByProductId = (
  products: Product[],
  sales: StockSaleLink[],
): Map<string, StockSaleLink[]> => {
  const map = new Map<string, StockSaleLink[]>();

  sales.forEach((sale) => {
    getStockProductIdsLinkedToSale(sale, products).forEach((productId) => {
      const current = map.get(productId);
      if (current) {
        current.push(sale);
      } else {
        map.set(productId, [sale]);
      }
    });
  });

  return map;
};

const stockOrderLinkKind = (kind: StockOrderLink['kind']): Sale['kind'] =>
  kind === 'sale' ? 'sale' : 'repair';

const saleFromStockOrderLinks = (
  saleId: string,
  links: StockOrderLink[],
): Sale => {
  const first = links[0];
  return {
    id: saleId,
    recordNumber: first?.recordNumber.trim() || null,
    saleDate: '',
    quantity: 1,
    salePrice: 0,
    kind: stockOrderLinkKind(first?.kind ?? 'repair'),
    status: first?.status ?? '',
    paidAmount: 0,
    note: '',
    timeline: [],
    paymentHistory: [],
    lineItems: links.map((link) => ({
      id: `${saleId}:${link.productId}`,
      kind: 'product',
      productId: link.productId,
      name: '',
      price: 0,
      quantity: 1,
      warrantyPeriod: 0,
      serialNumbers: link.serialNumber.trim() ? [link.serialNumber.trim()] : [],
    })),
    client: {
      id: '',
      name: '',
      phone: '',
      status: '',
    },
    product: {
      id: first?.productId ?? '',
      article: '',
      name: '',
      serialNumber: first?.serialNumber ?? '',
    },
    manager: null,
    master: null,
    issuedBy: null,
    createdAt: '',
    updatedAt: '',
  };
};

export const mergeSalesWithStockOrderLinks = (
  sales: Sale[],
  links: StockOrderLink[],
) => {
  if (links.length === 0) return sales;

  const knownSaleIds = new Set(sales.map((sale) => sale.id));
  const linksBySaleId = new Map<string, StockOrderLink[]>();
  links.forEach((link) => {
    const saleId = link.saleId.trim();
    if (!saleId || knownSaleIds.has(saleId)) return;
    linksBySaleId.set(saleId, [...(linksBySaleId.get(saleId) ?? []), link]);
  });

  if (linksBySaleId.size === 0) return sales;

  return [
    ...sales,
    ...Array.from(linksBySaleId.entries()).map(([saleId, saleLinks]) =>
      saleFromStockOrderLinks(saleId, saleLinks),
    ),
  ];
};

export const buildProductWarehouseMetaById = (
  products: Product[],
  warehouses: StockWarehouseItem[],
) => {
  const byId = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
  const byName = new Map(
    warehouses.map((warehouse) => [
      normalizeText(warehouse.name),
      warehouse,
    ]),
  );
  const fallbackWarehouse = warehouses[0];

  return products.reduce<Record<string, StockWarehouseMeta>>(
    (acc, product) => {
      const matchedWarehouseById = product.warehouseId
        ? byId.get(product.warehouseId)
        : undefined;
      const matchedWarehouse =
        matchedWarehouseById ??
        byName.get(normalizeText(product.purchasePlace)) ??
        fallbackWarehouse;
      const matchedLocation =
        product.locationId && matchedWarehouse
          ? matchedWarehouse.locations.find(
              (location) => location.id === product.locationId,
            )
          : undefined;
      const firstLocation = matchedLocation ?? matchedWarehouse?.locations[0];

      acc[product.id] = {
        warehouseId: matchedWarehouse?.id ?? '',
        warehouseName: matchedWarehouse?.name ?? '-',
        locationId: firstLocation?.id ?? '',
        locationName: firstLocation?.name ?? '-',
      };
      return acc;
    },
    {},
  );
};

export const getStockSupplierLabel = (
  product: Product,
  links: StockSupplierOrderLink[] = [],
) => links[0]?.order.supplierName || product.purchasePlace || '-';

export const buildSupplierOrdersByProductId = ({
  products,
  supplierOrders,
}: {
  products: Product[];
  supplierOrders: SupplierOrder[];
}) => {
  const supplierOrderById = new Map(
    supplierOrders.map((order) => [order.id, order]),
  );

  return products.reduce<Record<string, StockSupplierOrderLink<SupplierOrder>[]>>(
    (acc, product) => {
      const supplierOrderId = product.supplierOrderId?.trim();
      const supplierOrderItemIndex = product.supplierOrderItemIndex;
      if (!supplierOrderId || typeof supplierOrderItemIndex !== 'number') {
        acc[product.id] = [];
        return acc;
      }

      const order = supplierOrderById.get(supplierOrderId);
      const item = order?.items.find(
        (candidate) => candidate.itemIndex === supplierOrderItemIndex,
      );
      acc[product.id] =
        order && item
          ? [
              {
                order,
                itemIndex: supplierOrderItemIndex,
                displayNumber: buildSupplierOrderItemNumber(
                  order,
                  supplierOrderItemIndex,
                ),
              },
            ]
          : [];
      return acc;
    },
    {},
  );
};

export const getStockSearchText = (
  product: Product,
  mode: StockSearchMode,
  meta: StockWarehouseMeta | undefined,
  supplierLabel: string,
) => {
  if (mode === 'serial') return product.serialNumber;
  if (mode === 'article') return product.article;
  if (mode === 'warehouse') return meta?.warehouseName ?? '-';
  if (mode === 'supplier') return supplierLabel;
  return [product.name, product.article, product.note].join(' ');
};

export const getStockIdentitySearchText = (product: Product) =>
  [product.name, product.article, product.serialNumber, product.note].join(' ');

/** Product-name queries have spaces or non-ASCII letters; serial scans do not. */
export const isProductNameLikeStockQuery = (query: string) => {
  const trimmed = query.trim();
  if (!trimmed) return false;
  return /\s/.test(trimmed) || /[^\x20-\x7E]/.test(trimmed);
};

export const matchesStockSearchQuery = ({
  product,
  query,
  searchMode,
  meta,
  supplierLabel,
}: {
  product: Product;
  query: string;
  searchMode: StockSearchMode;
  meta: StockWarehouseMeta | undefined;
  supplierLabel: string;
}) => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return true;

  const modeText = getStockSearchText(
    product,
    searchMode,
    meta,
    supplierLabel,
  );
  if (modeText.toLowerCase().includes(normalizedQuery)) return true;

  if (searchMode === 'warehouse' || searchMode === 'supplier') return false;
  if (searchMode === 'name') return false;
  if (!isProductNameLikeStockQuery(query)) return false;

  return getStockIdentitySearchText(product)
    .toLowerCase()
    .includes(normalizedQuery);
};

export const filterStockProducts = ({
  products,
  sales,
  query,
  searchMode,
  filters,
  stockStatuses = defaultStockStatusFilters,
  productWarehouseMetaById,
  supplierOrdersByProductId,
  buyersByProductName,
}: {
  products: Product[];
  sales: Sale[];
  query: string;
  searchMode: StockSearchMode;
  filters: StockFilters;
  stockStatuses?: readonly StockStatusFilter[];
  productWarehouseMetaById: Record<string, StockWarehouseMeta>;
  supplierOrdersByProductId: Record<string, StockSupplierOrderLink[]>;
  buyersByProductName: Record<string, string[]>;
}) => {
  const saleLinksByProductId = buildStockSaleLinksByProductId(products, sales);

  return products
    .filter(
      (product) =>
        product.quantity > 0 &&
        matchesStockStatusChips(
          saleLinksByProductId.get(product.id) ?? [],
          stockStatuses,
        ),
    )
    .filter((product) => {
      const productMeta = productWarehouseMetaById[product.id];
      const warehouseName = productMeta?.warehouseName ?? '-';
      const locationName = productMeta?.locationName ?? '-';
      const supplierLabel = getStockSupplierLabel(
        product,
        supplierOrdersByProductId[product.id],
      );
      const matchesQuery = matchesStockSearchQuery({
        product,
        query,
        searchMode,
        meta: productMeta,
        supplierLabel,
      });

      if (!matchesQuery) return false;
      if (
        filters.name.trim() &&
        !product.name.toLowerCase().includes(normalizeText(filters.name))
      ) {
        return false;
      }
      if (
        filters.serial.trim() &&
        !product.serialNumber
          .toLowerCase()
          .includes(normalizeText(filters.serial))
      ) {
        return false;
      }
      if (
        filters.article.trim() &&
        !product.article.toLowerCase().includes(normalizeText(filters.article))
      ) {
        return false;
      }
      if (
        filters.warehouse.trim() &&
        !warehouseName.toLowerCase().includes(normalizeText(filters.warehouse))
      ) {
        return false;
      }
      if (
        filters.supplier.trim() &&
        !supplierLabel.toLowerCase().includes(normalizeText(filters.supplier))
      ) {
        return false;
      }
      if (
        filters.location &&
        locationName.toLowerCase() !== normalizeText(filters.location)
      ) {
        return false;
      }
      if (filters.buyer.trim()) {
        const productBuyers =
          buyersByProductName[normalizeText(product.name)] ?? [];
        if (
          !productBuyers.some(
            (buyer) => normalizeText(buyer) === normalizeText(filters.buyer),
          )
        ) {
          return false;
        }
      }
      return true;
    });
};

export type StockModelGroup = {
  id: string;
  name: string;
  article: string;
  products: Product[];
};

export const getStockModelGroupId = (
  product: Pick<Product, 'name' | 'article'>,
) => `${normalizeText(product.name)}::${normalizeText(product.article)}`;

export const groupStockProductsByModel = (
  products: Product[],
): StockModelGroup[] => {
  const order: string[] = [];
  const groups = new Map<string, StockModelGroup>();

  products.forEach((product) => {
    const id = getStockModelGroupId(product);
    const existing = groups.get(id);
    if (existing) {
      existing.products.push(product);
      return;
    }
    groups.set(id, {
      id,
      name: product.name,
      article: product.article,
      products: [product],
    });
    order.push(id);
  });

  return order.map((id) => groups.get(id)!);
};
