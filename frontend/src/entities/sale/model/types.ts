import type { Client } from '../../client/model/types';
import type { Product } from '../../product/model/types';

export type Sale = {
  id: string;
  saleDate: string;
  quantity: number;
  salePrice: number;
  note: string;
  client: {
    id: string;
    name: string;
    phone: string;
    status: string;
  };
  product: {
    id: string;
    article: string;
    name: string;
    serialNumber: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type SaleFormValues = {
  saleDate: string;
  clientId: string;
  productId: string;
  quantity: string;
  salePrice: string;
  note: string;
};

export type SeedResponse = {
  message: string;
  products: Product[];
  clients: Client[];
  sales: Sale[];
};
