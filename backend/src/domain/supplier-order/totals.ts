export type SupplierOrderItemTotalLike = {
  quantity?: number;
  price?: number;
  receiptStatus?: string;
};

export const calculateSupplierOrderPayableTotal = (
  items: SupplierOrderItemTotalLike[] = [],
) =>
  items.reduce((sum, item) => {
    if (item.receiptStatus === 'cancelled') {
      return sum;
    }
    const quantity = Number.isFinite(item.quantity) ? Number(item.quantity) : 0;
    const price = Number.isFinite(item.price) ? Number(item.price) : 0;
    return sum + quantity * price;
  }, 0);

export type ApplySupplierOrderFinancialTotalsInput = {
  items?: SupplierOrderItemTotalLike[];
  paymentStatus?: string;
  paid?: number;
  isPaymentStatusModified?: boolean;
};

export const applySupplierOrderFinancialTotals = ({
  items = [],
  paymentStatus = 'pending',
  paid = 0,
  isPaymentStatusModified = false,
}: ApplySupplierOrderFinancialTotalsInput = {}) => {
  const total = calculateSupplierOrderPayableTotal(items);
  if (paymentStatus !== 'paid') {
    return { total, paid: 0 };
  }

  const preserveHistoricalPaid = paid > 0 && !isPaymentStatusModified;
  return {
    total,
    paid: preserveHistoricalPaid ? paid : total,
  };
};