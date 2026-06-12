import type { Client } from '../../client/model/types';
import type { Product } from '../../product/model/types';

export type SaleProductSnapshot = {
  id: string;
  article: string;
  name: string;
  serialNumber: string;
};

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
    kind?: 'manual' | 'system';
    author: string;
    message: string;
    createdAt: string;
  }>;
  paymentHistory: Array<{
    id: string;
    type: 'deposit' | 'refund';
    paymentMethod: 'cash' | 'non-cash';
    amount: number;
    cashboxId: string;
    cashboxName: string;
    author: string;
    createdAt: string;
  }>;
  lineItems: Array<{
    id: string;
    kind: 'product' | 'service';
    productId?: string;
    catalogProductId?: string;
    serviceId?: string;
    name: string;
    price: number;
    quantity: number;
    warrantyPeriod: number;
    serialNumbers?: string[];
  }>;
  discount?: {
    mode: 'percent' | 'amount';
    value: number;
  };
  client: {
    id: string;
    name: string;
    phone: string;
    status: string;
    email?: string;
    address?: string;
    registrationId?: string;
    iban?: string;
  };
  product: SaleProductSnapshot | null;
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
  issuedBy: {
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
  issuedById?: string;
  kind?: 'repair' | 'sale';
  status?: string;
  paidAmount?: number;
  timeline?: Sale['timeline'];
  paymentHistory?: Sale['paymentHistory'];
  lineItems?: Sale['lineItems'];
  deviceName?: string;
  serialNumber?: string;
  discount?: Sale['discount'];
  expectedUpdatedAt?: string;
};

export type SaleWorkspacePayload = {
  kind?: 'repair' | 'sale';
  status?: string;
  paidAmount?: number;
  masterId?: string;
  issuedById?: string;
  deviceName?: string;
  serialNumber?: string;
  discount?: Sale['discount'];
  timeline?: Sale['timeline'];
  paymentHistory?: Sale['paymentHistory'];
  lineItems?: Sale['lineItems'];
  expectedUpdatedAt?: string;
};

export type SaleLineItemReturnPayload = {
  lineItemId: string;
  cashboxId: string;
  refundAmount: string;
  warehouse: string;
  author: string;
};

export type SaleLineItemSerialReturnPayload = {
  lineItemId: string;
  serialNumbers: string[];
  cashboxId: string;
  refundAmount: string;
  warehouse: string;
  author: string;
};
export type SaleLineItemStockReturnPayload = {
  lineItemId: string;
  warehouse: string;
  author: string;
};

export type SaleReturnPayload = {
  cashboxId: string;
  refundAmount: string;
  warehouse: string;
  author: string;
};

export type SalePaymentPayload = {
  cashboxId?: string;
  amount: string;
  paymentMethod: 'cash' | 'non-cash';
  action: 'deposit' | 'depositAndIssue' | 'issueWithoutPayment';
  targetStatus: 'issued' | 'issuedWithoutRepair' | 'paid';
  author: string;
  issuedById?: string;
};

export type SaleRefundPaymentPayload = {
  cashboxId: string;
  amount: string;
  author: string;
  issuedById?: string;
};

export type SeedResponse = {
  message: string;
  products: Product[];
  clients: Client[];
  sales: Sale[];
  safetyBackupId?: string;
};
