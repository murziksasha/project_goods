import type { SupplierOrderDocument } from './model';

export const getSupplierOrderDisplayNumber = (
  order: Pick<SupplierOrderDocument, 'number' | 'orderBaseId'> & {
    _id?: SupplierOrderDocument['_id'];
  },
) => order.number?.trim() || order.orderBaseId;

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
  stockedAt: (order as { stockedAt?: Date | null }).stockedAt
    ? new Date((order as { stockedAt: Date }).stockedAt).toISOString()
    : null,
  cancelledAt: (order as { cancelledAt?: Date | null }).cancelledAt
    ? new Date((order as { cancelledAt: Date }).cancelledAt).toISOString()
    : null,
  statusTransitions: Array.isArray(
    (order as unknown as { statusTransitions?: unknown[] }).statusTransitions,
  )
    ? (
        (
          order as unknown as {
            statusTransitions?: Array<Record<string, unknown>>;
          }
        ).statusTransitions ?? []
      ).map((entry) => ({
        id: String(entry.id ?? ''),
        fromStatus: entry.fromStatus ? String(entry.fromStatus) : null,
        toStatus: String(entry.toStatus ?? ''),
        fromReceiptStatus: entry.fromReceiptStatus
          ? String(entry.fromReceiptStatus)
          : null,
        toReceiptStatus: String(entry.toReceiptStatus ?? ''),
        changedById: entry.changedById ? String(entry.changedById) : null,
        changedByName: entry.changedByName
          ? String(entry.changedByName)
          : null,
        changedAt:
          entry.changedAt instanceof Date
            ? entry.changedAt.toISOString()
            : String(entry.changedAt ?? ''),
      }))
    : [],
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
    receivedAt: (item as { receivedAt?: Date | null }).receivedAt
      ? new Date((item as { receivedAt: Date }).receivedAt).toISOString()
      : null,
    cancelledAt: (item as { cancelledAt?: Date | null }).cancelledAt
      ? new Date((item as { cancelledAt: Date }).cancelledAt).toISOString()
      : null,
  })),
  createdAt: order.createdAt.toISOString(),
  updatedAt: order.updatedAt.toISOString(),
});
