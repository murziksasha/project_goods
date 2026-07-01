import type { SupplierOrderDocument } from './model';

export const formatSupplierOrder = (
  order: SupplierOrderDocument & { supplierName?: string },
) => ({
  id: order._id.toString(),
  orderBaseId: order.orderBaseId,
  supplierId: order.supplier.toString(),
  supplierName: order.supplierName ?? '',
  deliveryDate: order.deliveryDate.toISOString(),
  supplyType: order.supplyType ?? 'Р›РѕРєР°Р»СЊРЅРѕ',
  number: order.number ?? '',
  note: order.note ?? '',
  createdBy: order.createdBy ?? '',
  status: order.status,
  paymentStatus: order.paymentStatus,
  receiptStatus: order.receiptStatus,
  total: order.total,
  paid: order.paid,
  isFavorite: order.isFavorite === true,
  items: (order.items ?? []).map((item) => ({
    lineId: item.lineId,
    itemIndex: item.itemIndex,
    catalogProductId: item.catalogProductId
      ? item.catalogProductId.toString()
      : undefined,
    productName: item.productName,
    quantity: item.quantity,
    price: item.price,
    receiptStatus: item.receiptStatus ?? 'new',
  })),
  createdAt: order.createdAt.toISOString(),
  updatedAt: order.updatedAt.toISOString(),
});
