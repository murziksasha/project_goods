import XLSX from 'xlsx';
import { Product, type ProductDocument } from './model';
import { Sale } from '../sale/model';
import { formatProduct } from '../../shared/lib/formatters';
import { normalizeProductPayload } from '../../shared/lib/parsers';
import { getSearchQuery, isValidObjectIdOrThrow } from '../../shared/lib/query';
import type { ProductPayload } from '../shared/types';

export const listProducts = async (query: unknown) => {
  const products = await Product.find(getSearchQuery(query))
    .sort({ createdAt: -1 })
    .lean<ProductDocument[]>();

  return products.map(formatProduct);
};

export const createProduct = async (payload: ProductPayload) => {
  const product = new Product(normalizeProductPayload(payload));
  await product.validate();
  await product.save();
  return formatProduct(product.toObject<ProductDocument>());
};

export const updateProduct = async (productId: string, payload: ProductPayload) => {
  isValidObjectIdOrThrow(productId, 'productId');

  const existingProduct = await Product.findById(productId).lean<ProductDocument | null>();
  if (!existingProduct) {
    throw new Error('Product not found.');
  }

  const normalizedPayload = normalizeProductPayload(payload);
  if (normalizedPayload.quantity - existingProduct.reservedQuantity < 0) {
    throw new Error('Quantity cannot be less than reserved quantity.');
  }

  const product = await Product.findByIdAndUpdate(productId, normalizedPayload, {
    new: true,
    runValidators: true,
  }).lean<ProductDocument | null>();

  if (!product) {
    throw new Error('Product not found.');
  }

  return formatProduct(product);
};

export const deleteProduct = async (productId: string) => {
  isValidObjectIdOrThrow(productId, 'productId');

  if (await Sale.exists({ product: productId })) {
    throw new Error('Cannot delete a product that has sales history.');
  }

  const deletedProduct = await Product.findByIdAndDelete(productId).lean<ProductDocument | null>();
  if (!deletedProduct) {
    throw new Error('Product not found.');
  }

  return { id: productId };
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
