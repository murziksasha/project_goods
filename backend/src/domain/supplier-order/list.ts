import { getSearchQuery, isValidObjectIdOrThrow } from '../../shared/lib/query';
import { HttpError } from '../../shared/lib/errors';
import {
  SupplierOrder,
  type SupplierOrderDocument,
} from './model';
import {
  formatOrdersWithSupplierNames,
  withSupplierName,
} from './internal';

export const listSupplierOrders = async (queryValue: unknown) => {
  const query = getSearchQuery(queryValue);
  const orders = await SupplierOrder.find(query)
    .sort({ createdAt: -1 })
    .lean<SupplierOrderDocument[]>();
  return formatOrdersWithSupplierNames(orders);
};

export const updateSupplierOrderFavorite = async (
  supplierOrderId: string,
  payload: { isFavorite?: unknown },
) => {
  isValidObjectIdOrThrow(supplierOrderId, 'supplierOrderId');

  const existing = await SupplierOrder.findById(supplierOrderId);
  if (!existing) throw new HttpError(404, 'Supplier order not found.');

  existing.isFavorite = payload.isFavorite === true;
  await existing.save();
  return withSupplierName(existing.toObject<SupplierOrderDocument>());
};

export const listSupplierOrdersForAccounting = async () => {
  const orders = await SupplierOrder.find({
    status: {
      $in: [
        'approved',
        'overdue',
        'partially_stocked',
        'partially_completed',
        'stocked',
      ],
    },
    paymentStatus: 'pending',
    total: { $gt: 0 },
  })
    .sort({ createdAt: -1 })
    .lean<SupplierOrderDocument[]>();

  const withNames = await formatOrdersWithSupplierNames(orders);
  return withNames.map((order) => ({
    id: order.id,
    orderBaseId: order.orderBaseId,
    number: order.number,
    supplierName: order.supplierName,
    deliveryDate: order.deliveryDate,
    total: order.total,
    createdAt: order.createdAt,
  }));
};
