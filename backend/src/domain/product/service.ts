import XLSX from 'xlsx';
import { Product, type ProductDocument } from './model';
import { Sale } from '../sale/model';
import { formatProduct } from '../../shared/lib/formatters';
import { normalizeProductPayload } from '../../shared/lib/parsers';
import { getSearchQuery, isValidObjectIdOrThrow } from '../../shared/lib/query';
import type { ProductPayload } from '../shared/types';
import { assertNotStale } from '../../shared/lib/errors';
import {
  formatProductSerialNumber,
  getNextProductSerialNumberValue,
} from '../sequence/service';
import { Sequence } from '../sequence/model';

const productSerialSequenceKey = 'product-serial-number';
const productSerialPattern = /^S\d+$/;

const syncProductSerialSequenceWithDatabase = async () => {
  const [lastSequence, topProduct] = await Promise.all([
    Sequence.findOne({ key: productSerialSequenceKey }).lean<{ value: number } | null>(),
    Product.findOne({
      serialNumber: { $regex: '^S\\d+$' },
    })
      .sort({ serialNumber: -1 })
      .select({ serialNumber: 1 })
      .lean<{ serialNumber?: string } | null>(),
  ]);

  const serialNumericValue = Number(topProduct?.serialNumber?.slice(1) ?? 0);
  const maxValue = Math.max(lastSequence?.value ?? 0, Number.isFinite(serialNumericValue) ? serialNumericValue : 0);

  await Sequence.findOneAndUpdate(
    { key: productSerialSequenceKey },
    { value: maxValue },
    { upsert: true, setDefaultsOnInsert: true },
  );
};

const reserveNextUniqueProductSerialNumber = async () => {
  await syncProductSerialSequenceWithDatabase();

  for (let attempts = 0; attempts < 2000; attempts += 1) {
    const nextValue = await getNextProductSerialNumberValue();
    const candidate = formatProductSerialNumber(nextValue);
    const exists = await Product.exists({ serialNumber: candidate });
    if (!exists) return candidate;
  }

  throw new Error('Failed to generate unique product serial number.');
};

export const listProducts = async (query: unknown) => {
  const products = await Product.find(getSearchQuery(query))
    .sort({ createdAt: -1 })
    .lean<ProductDocument[]>();

  return products.map(formatProduct);
};

export const createProduct = async (payload: ProductPayload) => {
  const normalizedPayload = normalizeProductPayload(payload);
  if (!normalizedPayload.serialNumber) {
    normalizedPayload.serialNumber = await reserveNextUniqueProductSerialNumber();
  }

  const product = new Product(normalizedPayload);
  await product.validate();
  await product.save();
  return formatProduct(product.toObject<ProductDocument>());
};

export const getNextProductSerialNumber = async () => {
  const serialNumber = await reserveNextUniqueProductSerialNumber();
  return {
    serialNumber,
    pattern: productSerialPattern.source,
  };
};

export const updateProduct = async (productId: string, payload: ProductPayload) => {
  isValidObjectIdOrThrow(productId, 'productId');

  const existingProduct = await Product.findById(productId).lean<ProductDocument | null>();
  if (!existingProduct) {
    throw new Error('Product not found.');
  }
  assertNotStale(payload.expectedUpdatedAt, existingProduct.updatedAt, 'Product');

  const normalizedPayload = normalizeProductPayload(payload);
  if (normalizedPayload.quantity - existingProduct.reservedQuantity < 0) {
    throw new Error('Quantity cannot be less than reserved quantity.');
  }

  const product = await Product.findByIdAndUpdate(productId, normalizedPayload, {
    returnDocument: 'after',
    runValidators: true,
  }).lean<ProductDocument | null>();

  if (!product) {
    throw new Error('Product not found.');
  }

  return formatProduct(product);
};

export const deleteProduct = async (productId: string) => {
  isValidObjectIdOrThrow(productId, 'productId');

  if (
    await Sale.exists({
      $or: [{ product: productId }, { 'lineItems.productId': productId }],
    })
  ) {
    throw new Error('Cannot delete a product that has sales history.');
  }

  const deletedProduct = await Product.findByIdAndDelete(productId).lean<ProductDocument | null>();
  if (!deletedProduct) {
    throw new Error('Product not found.');
  }

  return { id: productId };
};

export const archiveProduct = async (productId: string) => {
  isValidObjectIdOrThrow(productId, 'productId');

  const product = await Product.findById(productId).lean<ProductDocument | null>();
  if (!product) {
    throw new Error('Product not found.');
  }

  if ((product.quantity ?? 0) > 0 || (product.reservedQuantity ?? 0) > 0) {
    throw new Error('Product is in stock.');
  }

  const wasUsed = await Sale.exists({
    $or: [{ product: productId }, { 'lineItems.productId': productId }],
  });

  if (!wasUsed) {
    await Product.findByIdAndDelete(productId);
    return { id: productId, action: 'deleted' as const };
  }

  const updatedProduct = await Product.findByIdAndUpdate(
    productId,
    { isActive: false },
    { returnDocument: 'after', runValidators: true },
  ).lean<ProductDocument | null>();

  if (!updatedProduct) {
    throw new Error('Product not found.');
  }

  return {
    action: 'deactivated' as const,
    product: formatProduct(updatedProduct),
  };
};

export const exportProductsWorkbook = async () => {
  const products = await Product.find().sort({ createdAt: -1 }).lean<ProductDocument[]>();

  const worksheet = XLSX.utils.json_to_sheet(
    products.map((product) => {
      const freeQuantity = Math.max(product.quantity - product.reservedQuantity, 0);

      return {
        Name: product.name,
        Article: product.article,
        'Serial Number': product.serialNumber,
        Price: product.price,
        'Sale Price Options': (product.salePriceOptions ?? []).join(', '),
        Note: product.note ?? '',
        Quantity: product.quantity,
        'Reserved Quantity': product.reservedQuantity,
        'Free Quantity': freeQuantity,
        'In Stock': freeQuantity > 0 ? 'Yes' : 'No',
        'Purchase Place': product.purchasePlace,
        'Purchase Date': product.purchaseDate ? product.purchaseDate.toISOString().slice(0, 10) : '',
        'Warranty Period (months)': product.warrantyPeriod,
        'Created At': product.createdAt.toISOString(),
      };
    }),
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  });
};
