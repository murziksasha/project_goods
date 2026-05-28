import type { Product } from '../../../entities/product/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';

export type StockSearchMode =
  | 'serial'
  | 'name'
  | 'article'
  | 'warehouse'
  | 'supplier';

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

export type StockSupplierOrderLink = {
  order: Pick<SupplierOrder, 'id' | 'supplierName'>;
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

export const getIssuedSaleProductIds = (
  products: Product[],
  sales: Sale[],
) => {
  const issuedProductIds = new Set<string>();
  const productIdsBySerial = new Map<string, string[]>();

  products.forEach((product) => {
    const serial = normalizeText(product.serialNumber);
    if (!serial) return;
    productIdsBySerial.set(serial, [
      ...(productIdsBySerial.get(serial) ?? []),
      product.id,
    ]);
  });

  sales.forEach((sale) => {
    if (!isIssuedSaleStatus(sale.status)) return;

    if (sale.product?.id) {
      issuedProductIds.add(sale.product.id);
    }

    const saleSerial = normalizeText(sale.product?.serialNumber);
    (saleSerial ? productIdsBySerial.get(saleSerial) ?? [] : []).forEach(
      (productId) => issuedProductIds.add(productId),
    );

    (sale.lineItems ?? []).forEach((item) => {
      if (item.kind !== 'product') return;
      if (item.productId) {
        issuedProductIds.add(item.productId);
      }

      (item.serialNumbers ?? [])
        .map(normalizeText)
        .filter(Boolean)
        .forEach((serial) =>
          (productIdsBySerial.get(serial) ?? []).forEach((productId) =>
            issuedProductIds.add(productId),
          ),
        );
    });
  });

  return issuedProductIds;
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

export const filterStockProducts = ({
  products,
  sales,
  query,
  searchMode,
  filters,
  productWarehouseMetaById,
  supplierOrdersByProductId,
  buyersByProductName,
}: {
  products: Product[];
  sales: Sale[];
  query: string;
  searchMode: StockSearchMode;
  filters: StockFilters;
  productWarehouseMetaById: Record<string, StockWarehouseMeta>;
  supplierOrdersByProductId: Record<string, StockSupplierOrderLink[]>;
  buyersByProductName: Record<string, string[]>;
}) => {
  const issuedProductIds = getIssuedSaleProductIds(products, sales);
  const normalizedQuery = normalizeText(query);

  return products
    .filter(
      (product) =>
        product.quantity > 0 && !issuedProductIds.has(product.id),
    )
    .filter((product) => {
      const productMeta = productWarehouseMetaById[product.id];
      const warehouseName = productMeta?.warehouseName ?? '-';
      const locationName = productMeta?.locationName ?? '-';
      const supplierLabel = getStockSupplierLabel(
        product,
        supplierOrdersByProductId[product.id],
      );
      const matchesQuery =
        !normalizedQuery ||
        getStockSearchText(
          product,
          searchMode,
          productMeta,
          supplierLabel,
        )
          .toLowerCase()
          .includes(normalizedQuery);

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
