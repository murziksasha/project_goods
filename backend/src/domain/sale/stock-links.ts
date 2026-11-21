import mongoose from 'mongoose';
import { HttpError } from '../../shared/lib/errors';
import { Product } from '../product/model';
import { Sale } from './model';

export const STOCK_ORDER_LINK_LIMIT = 2000;

export type StockOrderLink = {
  productId: string;
  serialNumber: string;
  saleId: string;
  recordNumber: string;
  kind: 'repair' | 'sale';
  status: string;
};

type LinkProduct = {
  id: string;
  serialNumber: string;
};

type LinkSaleLine = {
  kind?: string;
  productId?: string;
  serialNumbers?: string[];
};

type LinkSale = {
  id: string;
  recordNumber: string;
  kind: 'repair' | 'sale';
  status: string;
  productId: string;
  lineItems: LinkSaleLine[];
};

const normalizeSerial = (value: unknown) =>
  String(value ?? '').trim().toUpperCase();

const unique = (values: string[]) => Array.from(new Set(values));

const parseIdList = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return unique(
    value
      .map((item) => String(item ?? '').trim())
      .filter((item) => mongoose.isValidObjectId(item)),
  );
};

const parseSerialList = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return unique(value.map(normalizeSerial).filter(Boolean));
};

const isProductLineLinked = (line: LinkSaleLine, product: LinkProduct) => {
  if (line.kind !== 'product') return false;

  const productSerial = normalizeSerial(product.serialNumber);
  const itemSerials = (line.serialNumbers ?? [])
    .map(normalizeSerial)
    .filter(Boolean);

  if (productSerial && itemSerials.includes(productSerial)) return true;
  if (line.productId !== product.id) return false;
  if (!productSerial) return true;
  return itemSerials.includes(productSerial);
};

export const collectStockOrderLinks = (
  products: LinkProduct[],
  sales: LinkSale[],
): StockOrderLink[] => {
  const productById = new Map(products.map((product) => [product.id, product]));
  const productIdsBySerial = new Map<string, string[]>();
  products.forEach((product) => {
    const serial = normalizeSerial(product.serialNumber);
    if (!serial) return;
    productIdsBySerial.set(serial, [
      ...(productIdsBySerial.get(serial) ?? []),
      product.id,
    ]);
  });

  const links: StockOrderLink[] = [];
  const seen = new Set<string>();

  sales.forEach((sale) => {
    const matched = new Set<string>();
    const legacyProduct = sale.productId
      ? productById.get(sale.productId)
      : undefined;
    if (legacyProduct) matched.add(legacyProduct.id);

    sale.lineItems.forEach((line) => {
      if (line.kind !== 'product') return;

      (line.serialNumbers ?? [])
        .map(normalizeSerial)
        .filter(Boolean)
        .forEach((serial) => {
          (productIdsBySerial.get(serial) ?? []).forEach((productId) =>
            matched.add(productId),
          );
        });

      const product = line.productId
        ? productById.get(line.productId)
        : undefined;
      if (product && isProductLineLinked(line, product)) {
        matched.add(product.id);
      }
    });

    matched.forEach((productId) => {
      const key = `${productId}\u0000${sale.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      const product = productById.get(productId);
      links.push({
        productId,
        serialNumber: normalizeSerial(product?.serialNumber),
        saleId: sale.id,
        recordNumber: sale.recordNumber,
        kind: sale.kind,
        status: sale.status,
      });
    });
  });

  return links.sort((first, second) => {
    const productDiff = first.productId.localeCompare(second.productId);
    if (productDiff !== 0) return productDiff;
    const numberDiff = first.recordNumber.localeCompare(second.recordNumber, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    if (numberDiff !== 0) return numberDiff;
    return first.saleId.localeCompare(second.saleId);
  });
};

const readId = (value: unknown) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    return String(value);
  }
  return '';
};

export const listStockOrderLinks = async (body: unknown = {}) => {
  const payload =
    body && typeof body === 'object'
      ? (body as Record<string, unknown>)
      : {};
  const productIds = parseIdList(payload.productIds);
  const serials = parseSerialList(payload.serials);

  if (
    productIds.length > STOCK_ORDER_LINK_LIMIT ||
    serials.length > STOCK_ORDER_LINK_LIMIT
  ) {
    throw new HttpError(400, 'Too many products or serials.');
  }

  if (productIds.length === 0 && serials.length === 0) {
    return { links: [] as StockOrderLink[] };
  }

  const productQuery = [
    ...(productIds.length > 0 ? [{ _id: { $in: productIds } }] : []),
    ...(serials.length > 0 ? [{ serialNumber: { $in: serials } }] : []),
  ];
  const productDocs = await Product.find(productQuery.length === 1 ? productQuery[0] : { $or: productQuery })
    .select({ serialNumber: 1 })
    .lean<Array<{ _id: unknown; serialNumber?: string }>>();

  const products = productDocs.map((product) => ({
    id: readId(product._id),
    serialNumber: normalizeSerial(product.serialNumber),
  }));
  const idsForSales = unique([
    ...productIds,
    ...products.map((product) => product.id).filter(Boolean),
  ]);
  const serialsForSales = unique([
    ...serials,
    ...products.map((product) => product.serialNumber).filter(Boolean),
  ]);
  const saleQuery = [
    ...(idsForSales.length > 0
      ? [
          { 'lineItems.productId': { $in: idsForSales } },
          { product: { $in: idsForSales } },
        ]
      : []),
    ...(serialsForSales.length > 0
      ? [
          {
            lineItems: {
              $elemMatch: {
                kind: 'product',
                serialNumbers: { $in: serialsForSales },
              },
            },
          },
        ]
      : []),
  ];

  if (saleQuery.length === 0) {
    return { links: [] as StockOrderLink[] };
  }

  const saleDocs = await Sale.find({ $or: saleQuery })
    .select({
      recordNumber: 1,
      kind: 1,
      status: 1,
      product: 1,
      'lineItems.kind': 1,
      'lineItems.productId': 1,
      'lineItems.serialNumbers': 1,
    })
    .lean<
      Array<{
        _id: unknown;
        recordNumber?: string;
        kind?: string;
        status?: string;
        product?: unknown;
        lineItems?: Array<{
          kind?: string;
          productId?: unknown;
          serialNumbers?: string[];
        }>;
      }>
    >();

  const sales = saleDocs.map((sale) => ({
    id: readId(sale._id),
    recordNumber: String(sale.recordNumber ?? '').trim(),
    kind: sale.kind === 'sale' ? ('sale' as const) : ('repair' as const),
    status: String(sale.status ?? ''),
    productId: readId(sale.product),
    lineItems: (sale.lineItems ?? []).map((item) => ({
      kind: item.kind,
      productId: readId(item.productId),
      serialNumbers: item.serialNumbers ?? [],
    })),
  }));

  return { links: collectStockOrderLinks(products, sales) };
};
