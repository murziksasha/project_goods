import type { Sale, SaleFormValues } from './types';

export const initialSaleForm: SaleFormValues = {
  saleDate: new Date().toISOString().slice(0, 10),
  clientId: '',
  productId: '',
  quantity: '1',
  salePrice: '',
  note: '',
};

export const toSaleForm = (sale: Sale): SaleFormValues => ({
  saleDate: sale.saleDate.slice(0, 10),
  clientId: sale.client.id,
  productId: sale.product.id,
  quantity: String(sale.quantity),
  salePrice: String(sale.salePrice),
  note: sale.note,
});
