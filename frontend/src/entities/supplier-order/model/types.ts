export type SupplierOrderStatus =
  | 'request'
  | 'ordered'
  | 'approved'
  | 'partially_stocked'
  | 'partially_completed'
  | 'stocked'
  | 'overdue'
  | 'cancelled'
  | 'unavailable';

export type SupplierPaymentStatus = 'pending' | 'paid' | 'without_payment' | 'cancelled';
export type SupplierReceiptStatus = 'new' | 'approved' | 'received' | 'cancelled';

export type SupplierOrderItem = {
  lineId: string;
  itemIndex: number;
  catalogProductId?: string;
  productName: string;
  quantity: number;
  price: number;
  receiptStatus?: SupplierReceiptStatus;
};

export type SupplierOrder = {
  id: string;
  orderBaseId: string;
  supplierId: string;
  supplierName: string;
  deliveryDate: string;
  supplyType: string;
  number: string;
  note: string;
  createdBy: string;
  status: SupplierOrderStatus;
  paymentStatus: SupplierPaymentStatus;
  receiptStatus: SupplierReceiptStatus;
  total: number;
  paid: number;
  isFavorite: boolean;
  items: SupplierOrderItem[];
  createdAt: string;
  updatedAt: string;
};

export type StockedProductSummary = {
  id: string;
  name: string;
  article: string;
  serialNumber: string;
};

export type TakeOnChargeResult = SupplierOrder & {
  stockedProducts?: StockedProductSummary[];
};

export type SupplierOrderFormValues = {
  orderBaseId?: string;
  supplierId: string;
  deliveryDate: string;
  supplyType: string;
  number: string;
  note: string;
  createdBy: string;
  status?: SupplierOrderStatus;
  paymentStatus?: SupplierPaymentStatus;
  items: SupplierOrderItem[];
};
