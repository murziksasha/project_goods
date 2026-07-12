import { CatalogProduct } from '../catalog-product/model';
import { Product, type ProductDocument } from '../product/model';
import { HttpError } from '../../shared/lib/errors';
import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { Sale, type SaleDocument } from './model';
import type { SaleLineItem } from './stock';

export const assertSerialNumbersNotBoundToOtherSales = async (
  saleId: string,
  lineItems: SaleLineItem[],
) => {
  const requestedSerials = Array.from(
    new Set(
      lineItems
        .filter((item) => item.kind === 'product')
        .flatMap((item) => item.serialNumbers ?? [])
        .map((serial) => String(serial ?? '').trim().toUpperCase())
        .filter(Boolean),
    ),
  );

  if (requestedSerials.length === 0) return;

  const query = {
    ...(saleId ? { _id: { $ne: saleId } } : {}),
    'lineItems.serialNumbers.0': { $exists: true },
  };

  const otherSales = await Sale.find(query)
    .select({ lineItems: 1 })
    .lean<SaleDocument[]>();

  const occupied = new Set<string>();
  otherSales.forEach((sale) => {
    (sale.lineItems ?? []).forEach((item) => {
      if (item.kind !== 'product') return;
      (item.serialNumbers ?? [])
        .map((serial) => String(serial ?? '').trim().toUpperCase())
        .filter(Boolean)
        .forEach((serial) => occupied.add(serial));
    });
  });

  const duplicates = requestedSerials.filter((serial) =>
    occupied.has(serial),
  );
  if (duplicates.length > 0) {
    throw new HttpError(
      400,
      `Serial numbers are already bound to another order: ${duplicates.join(', ')}`,
    );
  }
};

export const assertSerializedLineItemsAreAtomic = async (
  lineItems: SaleLineItem[],
) => {
  for (const item of lineItems) {
    if (item.kind !== 'product' || !item.productId) continue;

    const serialNumbers = Array.from(
      new Set(
        (item.serialNumbers ?? [])
          .map((serial) => String(serial ?? '').trim().toUpperCase())
          .filter(Boolean),
      ),
    );

    if (serialNumbers.length > 0) {
      if (serialNumbers.length !== 1 || item.quantity !== 1) {
        throw new HttpError(
          400,
          'Serialized product line items must contain exactly one serial number and quantity 1.',
        );
      }

      isValidObjectIdOrThrow(item.productId.toString(), 'lineItems.productId');
      const product = await Product.findById(item.productId).lean<ProductDocument | null>();
      if (!product) {
        throw new HttpError(404, 'Product not found.');
      }

      const productSerial = String(product.serialNumber ?? '').trim().toUpperCase();
      if (!productSerial || productSerial !== serialNumbers[0]) {
        throw new HttpError(
          400,
          'Serialized product line item must reference the matching stock product.',
        );
      }
      continue;
    }

    if (item.quantity > 1) {
      isValidObjectIdOrThrow(item.productId.toString(), 'lineItems.productId');
      const product = await Product.findById(item.productId).lean<ProductDocument | null>();
      const productSerial = String(product?.serialNumber ?? '').trim();
      if (productSerial) {
        throw new HttpError(
          400,
          'Serialized stock products cannot be sold with quantity greater than 1.',
        );
      }
    }
  }
};

export const assertLineItemCatalogProductIds = async (
  lineItems: SaleLineItem[],
) => {
  const catalogProductIds = Array.from(
    new Set(
      lineItems
        .map((item) => item.catalogProductId?.toString().trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (catalogProductIds.length === 0) return;

  catalogProductIds.forEach((catalogProductId) =>
    isValidObjectIdOrThrow(catalogProductId, 'lineItems.catalogProductId'),
  );

  const count = await CatalogProduct.countDocuments({
    _id: { $in: catalogProductIds },
  });
  if (count !== catalogProductIds.length) {
    throw new HttpError(404, 'Catalog product not found.');
  }
};
