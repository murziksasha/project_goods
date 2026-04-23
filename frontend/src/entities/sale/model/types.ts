import type { Client } from '../../client/model/types';
import type { Product } from '../../product/model/types';

export type Sale = {
  id: string;
  recordNumber: string | null;
  saleDate: string;
  quantity: number;
  salePrice: number;
  kind: 'repair' | 'sale';
  status: string;
  paidAmount: number;
  note: string;
  timeline: Array<{
    id: string;
    author: string;
    message: string;
    createdAt: string;
  }>;
  paymentHistory: Array<{
    id: string;
    type: 'deposit' | 'refund';
    amount: number;
    cashboxId: string;
    cashboxName: string;
    author: string;
    createdAt: string;
  }>;
  lineItems: Array<{
    id: string;
    kind: 'product' | 'service';
    name: string;
    price: number;
    quantity: number;
  }>;
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
  manager: {
    id: string;
    name: string;
    role: string;
  } | null;
  master: {
    id: string;
    name: string;
    role: string;
  } | null;
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
  managerId?: string;
  masterId?: string;
  kind?: 'repair' | 'sale';
  status?: string;
  paidAmount?: number;
  timeline?: Sale['timeline'];
  paymentHistory?: Sale['paymentHistory'];
  lineItems?: Sale['lineItems'];
};

export type SaleWorkspacePayload = {
  kind?: 'repair' | 'sale';
  status?: string;
  paidAmount?: number;
  timeline?: Sale['timeline'];
  paymentHistory?: Sale['paymentHistory'];
  lineItems?: Sale['lineItems'];
};

export type SeedResponse = {
  message: string;
  products: Product[];
  clients: Client[];
  sales: Sale[];
};
