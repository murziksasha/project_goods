import { HttpError } from '../../shared/lib/errors';
import { normalizeProductModelName } from '../product/service';

export const normalizeCatalogProductName = (value: string) =>
  value.trim().replace(/\s+/g, ' ');

export const catalogProductNameMaxLength = 120;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const catalogProductNamesAreEqual = (left: string, right: string) =>
  normalizeProductModelName(left) === normalizeProductModelName(right);

export const buildCatalogSnapshotNamePattern = (name: string) =>
  `^${escapeRegExp(normalizeCatalogProductName(name)).replace(/\s+/g, '\\s+')}$`;

export const buildCatalogLineItemNamePattern = (name: string) =>
  `^${escapeRegExp(normalizeCatalogProductName(name)).replace(/\s+/g, '\\s+')}(?:\\s*\\(.*\\))?$`;

export const matchesCatalogSnapshotProductName = (
  snapshotName: string,
  previousName: string,
) =>
  new RegExp(buildCatalogSnapshotNamePattern(previousName), 'i').test(
    normalizeCatalogProductName(snapshotName),
  );

export const matchesCatalogLineItemProductName = (
  lineItemName: string,
  previousName: string,
) => new RegExp(buildCatalogLineItemNamePattern(previousName), 'i').test(lineItemName);

export const shouldPropagateCatalogProductRename = (
  previousName: string,
  nextName: string,
) => {
  const normalizedPreviousName = normalizeCatalogProductName(previousName);
  const normalizedNextName = normalizeCatalogProductName(nextName);

  if (!normalizedPreviousName || !normalizedNextName) {
    return false;
  }

  return !catalogProductNamesAreEqual(normalizedPreviousName, normalizedNextName);
};

export const assertCatalogProductNameFitsWarehouse = (name: string) => {
  const normalizedName = normalizeCatalogProductName(name);
  if (normalizedName.length > catalogProductNameMaxLength) {
    throw new HttpError(
      400,
      `Product name must contain no more than ${catalogProductNameMaxLength} characters for warehouse stock.`,
    );
  }
};

type SupplierOrderItemLike = {
  catalogProductId?: { toString(): string } | string | null;
  productName: string;
};

export const shouldRenameSupplierOrderItem = (
  item: SupplierOrderItemLike,
  catalogProductId: string,
  previousName: string,
) => {
  const matchesByCatalogId = item.catalogProductId?.toString() === catalogProductId;
  const matchesByName = catalogProductNamesAreEqual(item.productName, previousName);
  return matchesByCatalogId || matchesByName;
};

export const renameSupplierOrderItems = <T extends SupplierOrderItemLike>(
  items: T[],
  catalogProductId: string,
  previousName: string,
  nextName: string,
) =>
  items.map((item) => {
    if (!shouldRenameSupplierOrderItem(item, catalogProductId, previousName)) {
      return item;
    }

    return {
      ...item,
      productName: nextName,
    };
  });

type SaleLineItemLike = {
  kind: string;
  catalogProductId?: { toString(): string } | string | null;
  name: string;
};

type SaleLike = {
  productSnapshot?: {
    article?: string;
    name?: string;
    serialNumber?: string | null;
  } | null;
  lineItems?: SaleLineItemLike[];
};

export const renameSaleForCatalogProduct = (
  sale: SaleLike,
  catalogProductId: string,
  previousName: string,
  nextName: string,
) => {
  const snapshotName = sale.productSnapshot?.name ?? '';
  const nextSnapshotName = matchesCatalogSnapshotProductName(snapshotName, previousName)
    ? nextName
    : snapshotName;
  const nextLineItems = (sale.lineItems ?? []).map((item) => {
    if (item.kind !== 'product') {
      return item;
    }

    const matchesByCatalogId = item.catalogProductId?.toString() === catalogProductId;
    const matchesByName = matchesCatalogLineItemProductName(item.name, previousName);

    if (!matchesByCatalogId && !matchesByName) {
      return item;
    }

    return {
      ...item,
      name: nextName,
    };
  });

  const snapshotChanged = nextSnapshotName !== snapshotName;
  const lineItemsChanged =
    JSON.stringify(nextLineItems) !== JSON.stringify(sale.lineItems ?? []);

  return {
    snapshotChanged,
    lineItemsChanged,
    nextSnapshotName,
    nextLineItems,
  };
};