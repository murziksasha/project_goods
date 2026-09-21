import type {
  Client,
  Product,
  Sale,
  SaleProductSnapshot,
} from '../../../shared/types/domain';

export type { Client, Product, Sale, SaleProductSnapshot };

export type SaleFormValues = {
  saleDate: string;
  clientId: string;
  productId: string;
  quantity: string;
  salePrice: string;
  note: string;
  userNote?: string;
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
  isRapidSale?: boolean;
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
  userNote?: string;
  expectedUpdatedAt?: string;
  kanbanRank?: number;
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
