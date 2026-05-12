export type SupplierOrderStatus =
  | 'request'
  | 'ordered'
  | 'approved'
  | 'stocked'
  | 'overdue'
  | 'cancelled'
  | 'unavailable';

export type SupplierPaymentStatus = 'pending' | 'paid' | 'cancelled';
export type SupplierReceiptStatus = 'new' | 'approved' | 'received';

export type SupplierOrderItem = {
  lineId: string;
  itemIndex: number;
  productName: string;
  quantity: number;
  price: number;
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
  items: SupplierOrderItem[];
  createdAt: string;
  updatedAt: string;
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
