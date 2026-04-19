import type { Product, ProductFormValues } from './types';

export const initialProductForm: ProductFormValues = {
  name: '',
  article: '',
  serialNumber: '',
  price: '',
  salePriceOptions: '',
  quantity: '',
  note: '',
  purchasePlace: '',
  purchaseDate: '',
  warrantyPeriod: '',
};

export const toProductForm = (product: Product): ProductFormValues => ({
  name: product.name,
  article: product.article,
  serialNumber: product.serialNumber,
  price: String(product.price),
  salePriceOptions: product.salePriceOptions.join(', '),
  quantity: String(product.quantity),
  note: product.note,
  purchasePlace: product.purchasePlace,
  purchaseDate: product.purchaseDate ? product.purchaseDate.slice(0, 10) : '',
  warrantyPeriod: String(product.warrantyPeriod),
});
