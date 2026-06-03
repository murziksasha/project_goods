import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import JsBarcode from 'jsbarcode';
import type { Employee } from '../../../entities/employee/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import { isRepairOrder } from '../../../entities/sale/lib/sale-kind';
import { formatCurrency, formatDateTime } from '../../../shared/lib/format';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
import type { Product, ProductModelUpdatePayload } from '../../../entities/product/model/types';
import type { PrintForm } from '../../../entities/settings/model/types';
import {
  customLabelSizePresetId,
  defaultPrintForms,
  labelSizePresets,
  normalizeLabelSize,
  normalizePrintFormsForView,
  printDocumentStyles,
  renderPrintTemplate as renderSettingsPrintTemplate,
  type PrintTemplateData,
} from '../../../entities/settings/model/printForms';

export type OrdersWorkspaceProps = {
  sales: Sale[];
  employees: Employee[];
  isLoading: boolean;
  activeTab: OrdersTab;
  searchValue: string;
  currentEmployee: Employee | null;
  canCreateOrders: boolean;
  onActiveTabChange: (tab: OrdersTab) => void;
  onSearchChange: (value: string) => void;
  onCreateOrder: (tab: OrdersTab) => void;
  createOrderHref: string;
  onSaleUpdate: (sale: Sale) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  externalSelectedSaleId?: string | null;
  onExternalSaleOpenHandled?: () => void;
  onOpenClientCard: (clientId: string) => void;
  products: Product[];
  printForms: PrintForm[];
  printCompanySettings: PrintCompanySettings;
  onUpdateProductModel: (payload: ProductModelUpdatePayload) => Promise<boolean>;
};

export type PrintCompanySettings = {
  serviceName: string;
  company: string;
  companyAddress: string;
  companyId: string;
  companyIban: string;
  companyEmail: string;
  companySite: string;
};

export type OrderPrintRequest = {
  sale: Sale;
  lineItems: OrderLineItem[];
  paidAmount: number;
  orderNumber: string;
};

export type OrdersTab =
  | 'orders'
  | 'sales'
  | 'supplierOrders'
  | 'supplierInformation';
export type OrdersColumnKey =
  | 'orderNumber'
  | 'client'
  | 'status'
  | 'primaryItem'
  | 'price'
  | 'paid'
  | 'term'
  | 'warehouse'
  | 'manager'
  | 'master'
  | 'received'
  | 'createdAt'
  | 'readyDate';
export type OrdersColumnVisibility = Record<OrdersTab, OrdersColumnKey[]>;
export const isPlainLeftClick = (
  event: ReactMouseEvent<HTMLAnchorElement>,
) =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

export type RepairStatus =
  | 'issued'
  | 'ready'
  | 'new'
  | 'paid'
  | 'diagnostics'
  | 'inRepair'
  | 'waitingParts'
  | 'clientApproved'
  | 'clientRejected'
  | 'issuedWithoutRepair'
  | 'ready';
export type SaleStatus =
  | 'new'
  | 'reserved'
  | 'paid'
  | 'issued'
  | 'returned';
export type OrderStatus = RepairStatus | SaleStatus;
export type PaymentAction =
  | 'deposit'
  | 'depositAndIssue'
  | 'issueWithoutPayment';
export type PaymentTargetStatus =
  | 'issued'
  | 'issuedWithoutRepair'
  | 'paid';
export type TimelineEntry = {
  id: string;
  author: string;
  message: string;
  createdAt: string;
};
export type PaymentEntry = {
  id: string;
  type: 'deposit' | 'refund';
  paymentMethod: 'cash' | 'non-cash';
  amount: number;
  cashboxId: string;
  cashboxName: string;
  createdAt: string;
  author: string;
};
export type PaymentMethod = 'cash' | 'non-cash';
export type OrderLineItemKind = 'product' | 'service';
export type OrderLineItem = {
  id: string;
  kind: OrderLineItemKind;
  productId?: string;
  serviceId?: string;
  name: string;
  price: number;
  quantity: number;
  warrantyPeriod: number;
  serialNumbers?: string[];
};
export type RepairTypeFilter = 'all' | 'paid' | 'warranty';
export type OrdersFilters = {
  statuses: OrderStatus[];
  orderNumber: string;
  client: string;
  assigneeId: string;
  warehouse: string;
  repairType: RepairTypeFilter;
  paymentMethod: '' | PaymentMethod;
  dateFrom: string;
  dateTo: string;
  product: string;
  service: string;
};
export type SavedOrdersFilter = {
  id: string;
  employeeId: string;
  name: string;
  icon: string;
  tab: OrdersTab;
  filters: OrdersFilters;
  createdAt: string;
};

export const orderTabs: Array<{ key: OrdersTab; label: string }> = [
  { key: 'orders', label: 'Orders' },
  { key: 'sales', label: 'Sales' },
  { key: 'supplierOrders', label: 'Supplier Order' },
  { key: 'supplierInformation', label: 'Information' },
];

export const supplierOrderSaleLinkPrefix = '[LINKED_SALE_ID:';
export const supplierOrderClientLinkPrefix = '[LINKED_CLIENT_ID:';
export const orderDetailSectionsStorageKey =
  'project-goods.order-detail-sections';
export const orderDetailRelatedTabStorageKey =
  'project-goods.order-detail-related-tab';

export const buildSupplierOrderLinkNote = (
  saleReference: string,
  clientId: string,
) =>
  `${supplierOrderSaleLinkPrefix}${saleReference}] ${supplierOrderClientLinkPrefix}${clientId}]`;

export const withSupplierOrderLinkNote = (
  note: string,
  saleReference: string,
  clientId: string,
) => {
  const linkNote = buildSupplierOrderLinkNote(saleReference, clientId);
  const normalizedNote = note.trim();
  const withoutExistingMarkers = normalizedNote
    .replace(/\[LINKED_SALE_ID:[^\]]+\]/gi, '')
    .replace(/\[LINKED_CLIENT_ID:[^\]]+\]/gi, '')
    .trim();
  return withoutExistingMarkers
    ? `${withoutExistingMarkers}\n${linkNote}`
    : linkNote;
};

export const extractLinkedValueFromNote = (
  note: string,
  prefix: string,
) => {
  const pattern = new RegExp(
    `${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\]]+)\\]`,
    'i',
  );
  return note.match(pattern)?.[1]?.trim() ?? '';
};

export const extractLinkedSaleIdFromSupplierOrder = (order: SupplierOrder) =>
  extractLinkedValueFromNote(order.note ?? '', supplierOrderSaleLinkPrefix);

export const extractLinkedClientIdFromSupplierOrder = (
  order: SupplierOrder,
) =>
  extractLinkedValueFromNote(
    order.note ?? '',
    supplierOrderClientLinkPrefix,
  );

export const isSupplierOrderLinkedToSale = (
  order: SupplierOrder,
  sale: Sale,
) => {
  const linkedSaleRef = extractLinkedSaleIdFromSupplierOrder(order)
    .trim()
    .toLowerCase();
  if (!linkedSaleRef) return false;
  const saleRecordNumber = (sale.recordNumber ?? '')
    .trim()
    .toLowerCase();
  if (!saleRecordNumber) return false;
  return linkedSaleRef === saleRecordNumber;
};

export type StoredOrderDetailSections = Record<
  string,
  { productsOpen: boolean; servicesOpen: boolean }
>;

export const readOrderDetailSectionsState = (): StoredOrderDetailSections => {
  try {
    const raw = JSON.parse(
      window.localStorage.getItem(orderDetailSectionsStorageKey) ??
        '{}',
    ) as StoredOrderDetailSections;
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
};

export const writeOrderDetailSectionsState = (
  value: StoredOrderDetailSections,
) => {
  window.localStorage.setItem(
    orderDetailSectionsStorageKey,
    JSON.stringify(value),
  );
};

export const getStoredOrderDetailRelatedTab = (): OrdersTab => {
  try {
    const storedTab = window.localStorage.getItem(
      orderDetailRelatedTabStorageKey,
    );
    return storedTab === 'orders' ||
      storedTab === 'sales' ||
      storedTab === 'supplierOrders' ||
      storedTab === 'supplierInformation'
      ? storedTab
      : 'orders';
  } catch {
    return 'orders';
  }
};

export const getSupplierOrderStatusLabel = (
  status: SupplierOrder['status'],
) => {
  switch (status) {
    case 'request':
      return 'Purchase request';
    case 'ordered':
      return 'Ordered';
    case 'approved':
      return 'Approved';
    case 'stocked':
      return 'Stocked';
    case 'overdue':
      return 'Overdue';
    case 'cancelled':
      return 'Cancelled';
    case 'unavailable':
      return 'Unavailable';
    default:
      return status;
  }
};

export const ordersColumnsStorageKey = 'project-goods.orders-columns';
export const savedOrdersFiltersStorageKey =
  'project-goods.saved-orders-filters';
export const activeOrdersFiltersStorageKey = 'project-goods.orders-active-filters';
export const filterIconOptions = [
  '\u2753',
  '\u2702\ufe0f',
  '\ud83e\udd16',
  '\ud83d\udcc8',
  '\ud83e\ude9f',
  '\ud83d\udc26',
  '\u2733\ufe0f',
  '\u00a9\ufe0f',
  '\ud83d\udd07',
  '\u2795',
  '\ud83d\udc19',
  '\u2195\ufe0f',
  '\u2716\ufe0f',
  '\ud83d\udc4d',
  '\ud83d\udc4e',
  '\u261d\ufe0f',
  '\ud83d\udcde',
  '\ud83d\udd2d',
  '\ud83d\udd12',
  'VISA',
  '\ud83d\udd17',
  '\ud83c\udf4e',
  '\ud83d\udcb2',
  '\u21a9\ufe0f',
  '\ud83e\uddee',
  '@',
  '\u2620\ufe0f',
  '\ud83d\udd0c',
  '\u2796',
  '\ud83d\udcbc',
  '\ud83d\ude97',
  '\ud83d\ude80',
  '\u2708\ufe0f',
  '\ud83d\udeb4',
  '\u267f\ufe0f',
  '\u2194\ufe0f',
  '\u2605',
  '\u2606',
  '\u2728',
];
export const allOrdersColumnKeys: OrdersColumnKey[] = [
  'orderNumber',
  'client',
  'status',
  'primaryItem',
  'price',
  'paid',
  'term',
  'warehouse',
  'manager',
  'master',
  'received',
  'createdAt',
  'readyDate',
];
export const defaultVisibleColumns: OrdersColumnVisibility = {
  orders: allOrdersColumnKeys,
  sales: [
    'orderNumber',
    'client',
    'status',
    'price',
    'paid',
    'warehouse',
    'manager',
    'master',
    'received',
    'createdAt',
    'readyDate',
  ],
  supplierOrders: allOrdersColumnKeys,
  supplierInformation: allOrdersColumnKeys,
};
export const availableColumnsByTab: Record<OrdersTab, OrdersColumnKey[]> = {
  orders: allOrdersColumnKeys,
  sales: defaultVisibleColumns.sales,
  supplierOrders: allOrdersColumnKeys,
  supplierInformation: allOrdersColumnKeys,
};
export const lockedColumnsByTab: Record<OrdersTab, OrdersColumnKey[]> = {
  orders: ['orderNumber'],
  sales: ['orderNumber'],
  supplierOrders: ['orderNumber'],
  supplierInformation: ['orderNumber'],
};

export const repairStatuses: Array<{ key: RepairStatus; label: string }> = [
  { key: 'ready', label: 'Ready' },
  { key: 'issued', label: 'Issued' },
  { key: 'paid', label: 'Paid' },
  { key: 'new', label: 'New repair' },
  { key: 'diagnostics', label: 'Diagnostics' },
  { key: 'inRepair', label: 'In repair' },
  { key: 'waitingParts', label: 'Waiting parts' },
  { key: 'clientApproved', label: 'Client approved' },
  { key: 'clientRejected', label: 'Client rejected' },
  { key: 'issuedWithoutRepair', label: 'Issued without repair' },
];
export const saleStatuses: Array<{ key: SaleStatus; label: string }> = [
  { key: 'new', label: 'New sale' },
  { key: 'reserved', label: 'Reserved' },
  { key: 'paid', label: 'Paid' },
  { key: 'issued', label: 'Issued' },
  { key: 'returned', label: 'Returned' },
];
export const finalRepairStatuses: RepairStatus[] = [
  'issued',
  'clientRejected',
  'issuedWithoutRepair',
];
export const stockLockedRepairStatuses = new Set<RepairStatus>([
  'issued',
  'clientRejected',
  'issuedWithoutRepair',
]);
export const stockLockedRepairStatusMessage =
  'Cannot change repair status to final while a warehouse serial is shipped. Return shipped products back to stock first.';
export const emptyOrdersFilters: OrdersFilters = {
  statuses: [],
  orderNumber: '',
  client: '',
  assigneeId: '',
  warehouse: '',
  repairType: 'all',
  paymentMethod: '',
  dateFrom: '',
  dateTo: '',
  product: '',
  service: '',
};

export const readActiveOrderFilters = () => {
  try {
    const raw = JSON.parse(
      window.localStorage.getItem(activeOrdersFiltersStorageKey) ?? '{}',
    ) as Partial<Record<OrdersTab, OrdersFilters>>;

    const normalizeOne = (
      value:
        | (OrdersFilters & {
            date?: string;
          })
        | undefined,
    ): OrdersFilters => {
      if (!value) return emptyOrdersFilters;
      const normalizedLegacyDate = value.date ?? '';
      return {
        ...emptyOrdersFilters,
        ...value,
        dateFrom: value.dateFrom ?? normalizedLegacyDate,
        dateTo: value.dateTo ?? normalizedLegacyDate,
        statuses: Array.isArray(value.statuses) ? value.statuses : [],
      };
    };

    return {
      orders: normalizeOne(raw.orders),
      sales: normalizeOne(raw.sales),
      supplierOrders: normalizeOne(raw.supplierOrders),
      supplierInformation: normalizeOne(raw.supplierInformation),
    } as Record<OrdersTab, OrdersFilters>;
  } catch {
    return {
      orders: emptyOrdersFilters,
      sales: emptyOrdersFilters,
      supplierOrders: emptyOrdersFilters,
      supplierInformation: emptyOrdersFilters,
    } as Record<OrdersTab, OrdersFilters>;
  }
};

export const statusLabels = repairStatuses.reduce(
  (acc, status) => ({ ...acc, [status.key]: status.label }),
  saleStatuses.reduce(
    (acc, status) => ({ ...acc, [status.key]: status.label }),
    {} as Record<OrderStatus, string>,
  ),
);

export const normalizeOrderStatus = (
  status: string | null | undefined,
): OrderStatus => {
  const normalized = String(status ?? '')
    .trim()
    .toLowerCase();
  const aliasMap: Record<string, OrderStatus> = {
    issuedwithoutrepair: 'issuedWithoutRepair',
    issuedwithoutrepairing: 'issuedWithoutRepair',
    issued_without_repair: 'issuedWithoutRepair',
    issued_without_repairing: 'issuedWithoutRepair',
    'issued without repair': 'issuedWithoutRepair',
    'issued without repairing': 'issuedWithoutRepair',
  };
  const repairStatusMap: Record<string, RepairStatus> = {
    new: 'new',
    paid: 'paid',
    diagnostics: 'diagnostics',
    inrepair: 'inRepair',
    waitingparts: 'waitingParts',
    clientapproved: 'clientApproved',
    clientrejected: 'clientRejected',
    ready: 'ready',
    issued: 'issued',
    issuedwithoutrepair: 'issuedWithoutRepair',
    issuedwithoutrepairing: 'issuedWithoutRepair',
  };
  const saleStatusMap: Record<string, SaleStatus> = {
    new: 'new',
    reserved: 'reserved',
    paid: 'paid',
    issued: 'issued',
    returned: 'returned',
  };
  const compact = normalized.replace(/[\s_-]+/g, '');

  return (
    aliasMap[normalized] ??
    aliasMap[compact] ??
    repairStatusMap[compact] ??
    saleStatusMap[compact] ??
    'new'
  );
};

export const getStatusOptionsForSale = (sale: Sale) =>
  isRepairOrder(sale) ? repairStatuses : saleStatuses;

export const getStatusLabel = (sale: Sale, status: OrderStatus) =>
  getStatusOptionsForSale(sale).find(
    (option) => option.key === status,
  )?.label ?? statusLabels[status];

export const readSavedOrderFilters = () => {
  try {
    const raw = JSON.parse(
      window.localStorage.getItem(savedOrdersFiltersStorageKey) ??
        '[]',
    ) as SavedOrdersFilter[];
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (item) =>
        Boolean(item?.id) &&
        Boolean(item?.employeeId) &&
        Boolean(item?.name) &&
        (item?.tab === 'orders' ||
          item?.tab === 'sales' ||
          item?.tab === 'supplierOrders' ||
          item?.tab === 'supplierInformation') &&
        item?.filters,
    );
  } catch {
    return [];
  }
};

export const createOrderLineItem = (
  sale: Sale,
  kind: OrderLineItemKind,
): OrderLineItem => ({
  id: `${sale.id}-${kind}-default`,
  kind,
  productId: kind === 'product' ? sale.product.id : undefined,
  serviceId: undefined,
  name: kind === 'product' ? sale.product.name : 'Repair',
  price: sale.salePrice,
  quantity: sale.quantity,
  warrantyPeriod: kind === 'service' ? 1 : 0,
});

export const warrantyOptions = [
  { label: 'None', value: 0 },
  { label: '30 day', value: 1 },
  { label: '3 month', value: 3 },
  { label: '6 month', value: 6 },
  { label: '1 year', value: 12 },
  { label: '2 year', value: 24 },
  { label: '3 year', value: 36 },
];

export const getDefaultLineItems = (sale: Sale) =>
  isRepairOrder(sale)
    ? []
    : [createOrderLineItem(sale, 'product')];

export const getDiscount = (sale: Sale) => ({
  mode: sale.discount?.mode === 'percent' ? 'percent' : 'amount',
  value:
    Number.isFinite(sale.discount?.value) && (sale.discount?.value ?? 0) > 0
      ? Number(sale.discount?.value)
      : 0,
} as const);

export const getDiscountAmount = (
  sale: Sale,
  total: number,
) => {
  const discount = getDiscount(sale);
  if (discount.value <= 0 || total <= 0) return 0;
  if (discount.mode === 'percent') {
    return Math.min(
      Math.round(((total * discount.value) / 100) * 100) / 100,
      total,
    );
  }
  return Math.min(Math.round(discount.value * 100) / 100, total);
};

export const getOrderBaseTotal = (
  sale: Sale,
  lineItems: OrderLineItem[] = Array.isArray(sale.lineItems)
    ? sale.lineItems
    : getDefaultLineItems(sale),
) =>
  lineItems.length > 0
    ? lineItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0,
      )
    : Array.isArray(sale.lineItems)
      ? 0
      : sale.salePrice;

export const getOrderTotal = (
  sale: Sale,
  lineItems: OrderLineItem[] = Array.isArray(sale.lineItems)
    ? sale.lineItems
    : getDefaultLineItems(sale),
) =>
  (() => {
    const baseTotal = getOrderBaseTotal(sale, lineItems);
    const discountAmount = getDiscountAmount(sale, baseTotal);
    return Math.max(
      Math.round((baseTotal - discountAmount) * 100) / 100,
      0,
    );
  })();

export const getLineItemsTotal = (lineItems: OrderLineItem[]) =>
  lineItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
export const getLineItemRefundableAmount = (
  sale: Sale,
  lineItem: OrderLineItem,
  lineItems: OrderLineItem[] = Array.isArray(sale.lineItems)
    ? sale.lineItems
    : getDefaultLineItems(sale),
) => {
  const baseTotal = getOrderBaseTotal(sale, lineItems);
  const itemTotal = Math.round(lineItem.price * lineItem.quantity * 100) / 100;
  if (baseTotal <= 0 || itemTotal <= 0) return 0;
  const orderTotal = getOrderTotal(sale, lineItems);
  const ratio = itemTotal / baseTotal;
  const discountedItemTotal =
    Math.round(orderTotal * ratio * 100) / 100;
  return Math.max(
    Math.min(discountedItemTotal, itemTotal),
    0,
  );
};
export const normalizeProductLookupValue = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

export const isProductAvailableForOrder = (product: Product) =>
  product.isActive && product.isInStock && product.freeQuantity > 0;

export const isRepairDevicePlaceholderLineItem = (
  sale: Sale,
  item: OrderLineItem,
) => {
  if (!isRepairOrder(sale)) return false;
  if (item.kind !== 'product') return false;
  if ((item.productId ?? '').trim()) return false;
  if ((item.serialNumbers ?? []).length > 0) return false;

  const normalizedItemName = normalizeProductLookupValue(item.name);
  const normalizedDeviceName = normalizeProductLookupValue(
    getPrimaryDeviceName(sale),
  );
  if (!normalizedItemName || !normalizedDeviceName) return false;
  if (normalizedItemName !== normalizedDeviceName) return false;

  const hasLegacyPrice = Math.abs((item.price ?? 0) - sale.salePrice) < 0.01;
  const hasLegacyQuantity = Number(item.quantity ?? 0) === Number(sale.quantity ?? 0);

  return hasLegacyPrice && hasLegacyQuantity;
};

export const hasShippedStockProducts = (
  sale: Sale,
  lineItems: OrderLineItem[] = Array.isArray(sale.lineItems)
    ? sale.lineItems
    : getDefaultLineItems(sale),
) =>
  isRepairOrder(sale) &&
  lineItems
    .filter((item) => !isRepairDevicePlaceholderLineItem(sale, item))
    .some(
      (item) =>
        item.kind === 'product' &&
        (item.serialNumbers ?? []).some((serial) => serial.trim()),
    );

export const isRepairStatusChangeLockedByStock = (
  sale: Sale,
  nextStatus: OrderStatus,
  lineItems?: OrderLineItem[],
) =>
  isRepairOrder(sale) &&
  normalizeOrderStatus(sale.status) !== nextStatus &&
  stockLockedRepairStatuses.has(nextStatus as RepairStatus) &&
  hasShippedStockProducts(sale, lineItems);

export const getRemainingPayment = (
  sale: Sale,
  paidAmount: number,
  lineItems: OrderLineItem[] = sale.lineItems?.length
    ? sale.lineItems
    : getDefaultLineItems(sale),
) => Math.max(getOrderTotal(sale, lineItems) - paidAmount, 0);

export const isIssueWithoutPaymentBlockedForSale = (
  sale: Sale,
  paymentTargetStatus: PaymentTargetStatus,
  lineItems: OrderLineItem[],
  currentPaymentRemaining: number,
) => {
  const hasProductLineItems = lineItems.some(
    (item) => item.kind === 'product' && item.quantity > 0,
  );
  return (
    isRepairStatusChangeLockedByStock(
      sale,
      paymentTargetStatus,
      lineItems,
    ) ||
    (!isRepairOrder(sale) &&
      paymentTargetStatus === 'issued' &&
      currentPaymentRemaining > 0) ||
    (isRepairOrder(sale) &&
      paymentTargetStatus !== 'paid' &&
      hasProductLineItems &&
      currentPaymentRemaining > 0)
  );
};

export const getLatestDepositPaymentMethod = (
  sale: Sale,
): PaymentMethod | null => {
  const entry = (sale.paymentHistory ?? []).find(
    (item) => item.type === 'deposit',
  );
  if (!entry) return null;
  return entry.paymentMethod === 'non-cash' ? 'non-cash' : 'cash';
};

export const hasNonCashPayment = (sale: Sale) =>
  (sale.paidAmount ?? 0) > 0 &&
  getLatestDepositPaymentMethod(sale) === 'non-cash';

export const isClosingStatus = (sale: Sale, status: OrderStatus) =>
  isRepairOrder(sale)
    ? status === 'issued' || status === 'issuedWithoutRepair'
    : status === 'paid';

export const shouldCaptureReceivedBy = (sale: Sale, status: OrderStatus) =>
  isRepairOrder(sale)
    ? finalRepairStatuses.includes(status as RepairStatus)
    : status === 'reserved' ||
      status === 'paid' ||
      status === 'returned';

export const getRepairCompletionDate = (sale: Sale) => {
  if (!isRepairOrder(sale)) return sale.saleDate;

  const completionLabels = new Set(
    finalRepairStatuses.map((status) => getStatusLabel(sale, status).toLowerCase()),
  );
  const completionEntry = (sale.timeline ?? []).find((entry) => {
    const text = entry.message.toLowerCase();
    if (!text.includes('changed status to')) return false;
    return Array.from(completionLabels).some((label) => text.includes(`"${label}"`));
  });

  return completionEntry?.createdAt ?? sale.saleDate;
};

export const isSalePaymentStatus = (status: OrderStatus) =>
  status === 'paid';
export const canRefundFromStatus = (sale: Sale, status: OrderStatus) =>
  isRepairOrder(sale)
    ? status !== 'issued' &&
      status !== 'clientRejected' &&
      status !== 'issuedWithoutRepair'
    : true;
export const getSalePaidAmount = (sale: Sale) => {
  const history = sale.paymentHistory ?? [];
  if (history.length > 0) {
    const historyPaidAmount = history.reduce((total, entry) => {
      const amount = Number(entry.amount);
      if (!Number.isFinite(amount)) return total;
      return entry.type === 'refund'
        ? total - amount
        : total + amount;
    }, 0);
    return Math.max(Math.round(historyPaidAmount * 100) / 100, 0);
  }
  return sale.paidAmount ?? 0;
};
export const hasSaleReturnObligations = (
  sale: Sale,
  lineItems: OrderLineItem[] = Array.isArray(sale.lineItems)
    ? sale.lineItems
    : getDefaultLineItems(sale),
) =>
  !isRepairOrder(sale) &&
  (lineItems.some((item) => item.kind === 'product') ||
    getSalePaidAmount(sale) > 0);
export const saleEditableStatuses = new Set<OrderStatus>([
  'new',
  'reserved',
  'paid',
]);

export const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export const renderLineItemsTable = (
  items: OrderLineItem[],
  emptyLabel: string,
) => {
  if (items.length === 0) {
    return `<p class="print-muted">${emptyLabel}</p>`;
  }

  const rows = items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(String(item.quantity))}</td>
          <td>${escapeHtml(formatCurrency(item.price))}</td>
          <td>${escapeHtml(formatCurrency(item.price * item.quantity))}</td>
        </tr>
      `,
    )
    .join('');

  return `
    <table class="print-line-table">
      <thead>
        <tr>
          <th>Назва</th>
          <th>К-сть</th>
          <th>Ціна</th>
          <th>Сума</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
};

export const formatInvoiceAmount = (value: number) =>
  new Intl.NumberFormat('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export const pluralizeUk = (
  value: number,
  one: string,
  few: string,
  many: string,
) => {
  const lastTwo = value % 100;
  const last = value % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
};

export const numberToUkrainianWords = (value: number) => {
  if (value === 0) return 'нуль';

  const units = [
    '',
    'один',
    'два',
    'три',
    'чотири',
    "п'ять",
    'шість',
    'сім',
    'вісім',
    "дев'ять",
  ];
  const femaleUnits = [
    '',
    'одна',
    'дві',
    'три',
    'чотири',
    "п'ять",
    'шість',
    'сім',
    'вісім',
    "дев'ять",
  ];
  const teens = [
    'десять',
    'одинадцять',
    'дванадцять',
    'тринадцять',
    'чотирнадцять',
    "п'ятнадцять",
    'шістнадцять',
    'сімнадцять',
    'вісімнадцять',
    "дев'ятнадцять",
  ];
  const tens = [
    '',
    '',
    'двадцять',
    'тридцять',
    'сорок',
    "п'ятдесят",
    'шістдесят',
    'сімдесят',
    'вісімдесят',
    "дев'яносто",
  ];
  const hundreds = [
    '',
    'сто',
    'двісті',
    'триста',
    'чотириста',
    "п'ятсот",
    'шістсот',
    'сімсот',
    'вісімсот',
    "дев'ятсот",
  ];

  const chunkToWords = (chunk: number, female = false) => {
    const parts: string[] = [];
    const unitWords = female ? femaleUnits : units;
    const hundred = Math.floor(chunk / 100);
    const ten = Math.floor((chunk % 100) / 10);
    const unit = chunk % 10;

    if (hundred) parts.push(hundreds[hundred]);
    if (ten === 1) {
      parts.push(teens[unit]);
    } else {
      if (ten > 1) parts.push(tens[ten]);
      if (unit) parts.push(unitWords[unit]);
    }

    return parts.filter(Boolean).join(' ');
  };

  const thousands = Math.floor(value / 1000);
  const rest = value % 1000;
  const words: string[] = [];
  if (thousands > 0) {
    words.push(
      chunkToWords(thousands, true),
      pluralizeUk(thousands, 'тисяча', 'тисячі', 'тисяч'),
    );
  }
  if (rest > 0) words.push(chunkToWords(rest));

  return words.filter(Boolean).join(' ');
};

export const formatAmountInWords = (value: number) => {
  const hryvnias = Math.floor(value);
  const kopiyky = Math.round((value - hryvnias) * 100);
  return `${numberToUkrainianWords(hryvnias)} ${pluralizeUk(
    hryvnias,
    'гривня',
    'гривні',
    'гривень',
  )} ${String(kopiyky).padStart(2, '0')} ${pluralizeUk(
    kopiyky,
    'копійка',
    'копійки',
    'копійок',
  )}`;
};

export const renderInvoiceItemsTable = (sale: Sale) => {
  const items = (sale.lineItems?.length ? sale.lineItems : getDefaultLineItems(sale))
    .filter((item) => item.quantity > 0)
    .map((item, index) => {
      const amount = item.price * item.quantity;
      return `
        <tr>
          <td>${index + 1}.</td>
          <td>
            <strong>${escapeHtml(item.name)}</strong>
            <span class="invoice-item-description">${escapeHtml(
              item.serialNumbers?.length
                ? `Серійний №: ${item.serialNumbers.join(', ')}`
                : item.kind === 'service'
                  ? 'Послуга'
                  : 'Товар',
            )}</span>
          </td>
          <td>${formatInvoiceAmount(item.quantity)}</td>
          <td>${formatInvoiceAmount(item.price)}</td>
          <td>0%</td>
          <td>${formatInvoiceAmount(amount)}</td>
          <td>${formatInvoiceAmount(amount)}</td>
        </tr>
      `;
    });

  if (items.length === 0) {
    items.push(`
      <tr>
        <td>1.</td>
        <td><strong>${escapeHtml(getPrimaryDeviceName(sale))}</strong></td>
        <td>${formatInvoiceAmount(1)}</td>
        <td>${formatInvoiceAmount(sale.salePrice)}</td>
        <td>0%</td>
        <td>${formatInvoiceAmount(sale.salePrice)}</td>
        <td>${formatInvoiceAmount(sale.salePrice)}</td>
      </tr>
    `);
  }

  return `
    <table class="invoice-items-table">
      <thead>
        <tr>
          <th style="width: 34px;">№</th>
          <th>Назва</th>
          <th style="width: 74px;">Кількість</th>
          <th style="width: 72px;">Ціна без ПДВ</th>
          <th style="width: 64px;">Ставка ПДВ</th>
          <th style="width: 82px;">Сума без ПДВ</th>
          <th style="width: 82px;">Сума з ПДВ</th>
        </tr>
      </thead>
      <tbody>${items.join('')}</tbody>
    </table>
  `;
};

export const getPrintTemplateData = (
  sale: Sale,
  lineItems: OrderLineItem[],
  paidAmount: number,
  orderNumber: string,
  companySettings: PrintCompanySettings,
): PrintTemplateData => {
  const total = getOrderTotal(sale, lineItems);
  const totalAmount = Math.round(total * 100) / 100;
  const productItems = lineItems.filter(
    (item) => item.kind === 'product',
  );
  const serviceItems = lineItems.filter(
    (item) => item.kind === 'service',
  );
  const createdAt = formatDateTime(sale.createdAt);
  const isRepair = isRepairOrder(sale);
  return {
    id: sale.id,
    orderNumber,
    date: createdAt.split(',')[0] ?? createdAt,
    status: getStatusLabel(sale, normalizeOrderStatus(sale.status)),
    clientName: sale.client.name,
    clientPhone: sale.client.phone,
    deviceName: isRepair ? sale.product.name : '',
    serialNumber: isRepair ? sale.product.serialNumber : '',
    article: isRepair ? sale.product.article : '',
    defect: sale.note || '-',
    comment: sale.note || '-',
    total: formatCurrency(total),
    paid: formatCurrency(paidAmount),
    toPay: formatCurrency(getRemainingPayment(sale, paidAmount, lineItems)),
    currency: 'UAH',
    discount:
      getDiscount(sale).value > 0
        ? `${getDiscount(sale).value}${getDiscount(sale).mode === 'percent' ? '%' : ' UAH'}`
        : '0 UAH',
    note: sale.note || '-',
    managerName: sale.manager?.name ?? '-',
    masterName: sale.master?.name ?? '-',
    company: companySettings.serviceName || companySettings.company || '-',
    company_address: companySettings.companyAddress || '-',
    company_id: companySettings.companyId || '-',
    company_iban: companySettings.companyIban || '-',
    company_email: companySettings.companyEmail || '',
    company_site: companySettings.companySite || '',
    customer_reg_id: sale.client.registrationId || '',
    customer_address: sale.client.address || '',
    customer_iban: sale.client.iban || '',
    due_date: createdAt.split(',')[0] ?? createdAt,
    warehouse: getWarehouseLabel(sale),
    warehouse_address: '-',
    warehouse_phone: '-',
    net_amount: `${formatInvoiceAmount(totalAmount)} грн`,
    vat_amount: '0,00 грн',
    total_amount: `${formatInvoiceAmount(totalAmount)} грн`,
    total_written: formatAmountInWords(totalAmount),
    seller_occupation: 'Директор',
    seller_name: sale.manager?.name ?? '-',
    note_label: 'Примітка',
    products_table: renderLineItemsTable(productItems, 'Товари відсутні'),
    services_table: renderLineItemsTable(serviceItems, 'Послуги відсутні'),
    invoice_items_table: renderInvoiceItemsTable({ ...sale, lineItems }),
    barcode: orderNumber,
    createdAt,
  };
};

export const buildOrderNumber = (sale: Sale) =>
  sale.recordNumber ?? 'r------';

export const formatReadyDate = (value: string) =>
  new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(value));

export const getWarehouseLabel = (sale: Sale) => {
  void sale;
  return 'Service center';
};

export const PrinterIcon = () => (
  <svg
    className='print-button-icon'
    viewBox='0 0 24 24'
    aria-hidden='true'
    focusable='false'
  >
    <path
      d='M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v4a2 2 0 0 1-2 2h-2M7 14h10v7H7zM17 12h.01'
      fill='none'
      stroke='currentColor'
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='2'
    />
  </svg>
);

export const renderOrderPrintCodes = async (
  root: HTMLElement | Document,
  fallbackValue: string,
) => {
  root.querySelectorAll<SVGSVGElement>('svg[data-barcode-value]').forEach((node) => {
    if (node.ownerDocument.defaultView?.navigator.userAgent.includes('jsdom')) {
      return;
    }
    const value = node.dataset.barcodeValue || fallbackValue;
    const isLabelBarcode = Boolean(node.closest('.print-label'));
    try {
      JsBarcode(node, value, {
        format: 'CODE128',
        displayValue: !isLabelBarcode,
        fontSize: isLabelBarcode ? 18 : 12,
        textMargin: isLabelBarcode ? 1 : 2,
        height: isLabelBarcode ? 38 : 44,
        margin: 0,
      });
    } catch {
      node.replaceWith(node.ownerDocument.createTextNode(value));
    }
  });
};

export const buildOrderPrintBody = (
  forms: PrintForm[],
  templateData: PrintTemplateData,
  copies: number,
  pageSize: PrintForm['pageSize'],
  activeLabelSize: NonNullable<PrintForm['labelSize']>,
) =>
  Array.from({ length: Math.max(1, copies) })
    .flatMap(() => forms)
    .map(
      (form) => {
        const isLabel = pageSize === 'label' || form.pageSize === 'label';
        const labelSize = pageSize === 'label'
          ? activeLabelSize
          : normalizeLabelSize(form.labelSize);
        const labelStyle =
          isLabel
            ? ` style="--label-width: ${labelSize.widthMm}mm; --label-height: ${labelSize.heightMm}mm;"`
            : '';

        return `
        <section class="print-form ${isLabel ? 'print-form-label' : ''}"${labelStyle}>
          ${renderSettingsPrintTemplate(form.content, templateData, form.contentFormat)}
        </section>
      `;
      },
    )
    .join('');

export const buildOrderPrintHtml = ({
  title,
  body,
  pageSize,
  labelSize,
  orientation,
}: {
  title: string;
  body: string;
  pageSize: PrintForm['pageSize'];
  labelSize: NonNullable<PrintForm['labelSize']>;
  orientation: PrintForm['orientation'];
}) => `
  <!doctype html>
  <html>
    <head>
      <title>${title}</title>
      <style>
        @page { size: ${pageSize === 'label' ? `${labelSize.widthMm}mm ${labelSize.heightMm}mm` : `A4 ${orientation}`}; margin: 0; }
        ${printDocumentStyles}
      </style>
    </head>
    <body class="${pageSize === 'label' ? 'print-body-label' : ''}">${body}</body>
  </html>
`;

export const openOrderPrintWindow = async ({
  title,
  body,
  pageSize,
  labelSize,
  orientation,
  orderNumber,
  shouldPrint,
  autoClose,
}: {
  title: string;
  body: string;
  pageSize: PrintForm['pageSize'];
  labelSize: NonNullable<PrintForm['labelSize']>;
  orientation: PrintForm['orientation'];
  orderNumber: string;
  shouldPrint: boolean;
  autoClose: boolean;
}) => {
  const printWindow = window.open('', '_blank', 'width=980,height=760');
  if (!printWindow) return;

  printWindow.document.write(
    buildOrderPrintHtml({ title, body, pageSize, labelSize, orientation }),
  );
  printWindow.document.close();
  await renderOrderPrintCodes(printWindow.document, orderNumber);
  printWindow.focus();
  if (shouldPrint) {
    if (autoClose) {
      printWindow.addEventListener('afterprint', () => printWindow.close(), {
        once: true,
      });
    }
    printWindow.print();
  }
};

export const OrderPrintPreview = ({
  html,
  orderNumber,
  pageSize,
  labelSize,
}: {
  html: string;
  orderNumber: string;
  pageSize: PrintForm['pageSize'];
  labelSize: NonNullable<PrintForm['labelSize']>;
}) => {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const previewStyle =
    pageSize === 'label'
      ? ({
          '--label-width': `${labelSize.widthMm}mm`,
          '--label-height': `${labelSize.heightMm}mm`,
          width: `${labelSize.widthMm}mm`,
          minHeight: `${labelSize.heightMm}mm`,
        } as CSSProperties)
      : undefined;

  useEffect(() => {
    if (previewRef.current) {
      void renderOrderPrintCodes(previewRef.current, orderNumber);
    }
  }, [html, orderNumber]);

  return (
    <div
      ref={previewRef}
      className={
        pageSize === 'label'
          ? 'order-print-preview-page settings-print-preview-page settings-print-preview-page-label'
          : 'order-print-preview-page settings-print-preview-page'
      }
      style={previewStyle}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export type OrderPrintDialogProps = {
  request: OrderPrintRequest;
  printForms: PrintForm[];
  companySettings: PrintCompanySettings;
  onClose: () => void;
};

export const OrderPrintDialog = ({
  request,
  printForms,
  companySettings,
  onClose,
}: OrderPrintDialogProps) => {
  const availablePrintForms = normalizePrintFormsForView(
    printForms.length > 0 ? printForms : defaultPrintForms,
  ).filter((form) => form.isActive);
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>([]);
  const selectedForms = availablePrintForms.filter((form) =>
    selectedFormIds.includes(form.id),
  );
  const firstSelectedForm = selectedForms[0] ?? availablePrintForms[0];
  const [pageSize, setPageSize] = useState<PrintForm['pageSize']>(
    firstSelectedForm?.pageSize ?? 'A4',
  );
  const [labelSize, setLabelSize] = useState<NonNullable<PrintForm['labelSize']>>(
    normalizeLabelSize(firstSelectedForm?.labelSize),
  );
  const [orientation, setOrientation] = useState<PrintForm['orientation']>(
    firstSelectedForm?.orientation ?? 'portrait',
  );
  const [copies, setCopies] = useState(1);
  const [autoClose, setAutoClose] = useState(true);
  const templateData = getPrintTemplateData(
    request.sale,
    request.lineItems,
    request.paidAmount,
    request.orderNumber,
    companySettings,
  );
  const previewBody = buildOrderPrintBody(
    selectedForms,
    templateData,
    copies,
    pageSize,
    labelSize,
  );
  const canPrint = selectedForms.length > 0;

  useEffect(() => {
    if (!firstSelectedForm) return;
    setPageSize(firstSelectedForm.pageSize);
    setLabelSize(normalizeLabelSize(firstSelectedForm.labelSize));
    setOrientation(firstSelectedForm.orientation);
  }, [firstSelectedForm?.id]);

  const togglePrintForm = (formId: string) => {
    setSelectedFormIds((current) =>
      current.includes(formId) ? [] : [formId],
    );
  };

  const updateLabelPreset = (presetId: string) => {
    const preset = labelSizePresets.find((item) => item.id === presetId);
    setLabelSize(
      preset
        ? {
            presetId: preset.id,
            widthMm: preset.widthMm,
            heightMm: preset.heightMm,
          }
        : {
            ...labelSize,
            presetId: customLabelSizePresetId,
          },
    );
  };

  const updateLabelSize = (field: 'widthMm' | 'heightMm', value: number) => {
    setLabelSize((current) => ({
      ...current,
      presetId: customLabelSizePresetId,
      [field]: value,
    }));
  };

  const openPreviewWindow = () =>
    openOrderPrintWindow({
      title: `Preview ${request.orderNumber}`,
      body: previewBody,
      pageSize,
      labelSize,
      orientation,
      orderNumber: request.orderNumber,
      shouldPrint: false,
      autoClose: false,
    });

  const printSelectedForms = () =>
    openOrderPrintWindow({
      title: `Print forms ${request.orderNumber}`,
      body: previewBody,
      pageSize,
      labelSize,
      orientation,
      orderNumber: request.orderNumber,
      shouldPrint: true,
      autoClose,
    });

  return (
    <div className='modal-backdrop' role='presentation'>
      <section
        className='order-print-dialog'
        role='dialog'
        aria-modal='true'
        aria-label='Print order'
      >
        <header className='order-print-dialog-header'>
          <div>
            <p className='section-label'>Print preview</p>
            <h2>{request.orderNumber}</h2>
          </div>
          <button
            type='button'
            className='create-order-close'
            onClick={onClose}
            aria-label='Close print preview'
          >
            &times;
          </button>
        </header>

        <div className='order-print-dialog-grid'>
          <aside className='order-print-settings'>
            <h3>Forms</h3>
            <div className='order-print-form-list'>
              {availablePrintForms.map((form) => (
                <label key={form.id} className='payment-print-option'>
                  <input
                    type='checkbox'
                    checked={selectedFormIds.includes(form.id)}
                    onChange={() => togglePrintForm(form.id)}
                  />
                  <span>{form.title}</span>
                </label>
              ))}
            </div>

            <h3>Print settings</h3>
            <label className='field'>
              <span>Page size</span>
              <select
                value={pageSize}
                onChange={(event) =>
                  setPageSize(event.target.value === 'label' ? 'label' : 'A4')
                }
              >
                <option value='A4'>A4</option>
                <option value='label'>Label</option>
              </select>
            </label>
            {pageSize === 'label' ? (
              <>
                <label className='field'>
                  <span>Label size</span>
                  <select
                    value={labelSize.presetId}
                    onChange={(event) => updateLabelPreset(event.target.value)}
                  >
                    {labelSizePresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                    <option value={customLabelSizePresetId}>Custom</option>
                  </select>
                </label>
                <label className='field'>
                  <span>Width, mm</span>
                  <input
                    type='number'
                    min={10}
                    max={120}
                    step={1}
                    value={labelSize.widthMm}
                    disabled={labelSize.presetId !== customLabelSizePresetId}
                    onChange={(event) =>
                      updateLabelSize('widthMm', Number(event.target.value))
                    }
                  />
                </label>
                <label className='field'>
                  <span>Height, mm</span>
                  <input
                    type='number'
                    min={10}
                    max={120}
                    step={1}
                    value={labelSize.heightMm}
                    disabled={labelSize.presetId !== customLabelSizePresetId}
                    onChange={(event) =>
                      updateLabelSize('heightMm', Number(event.target.value))
                    }
                  />
                </label>
              </>
            ) : null}
            <label className='field'>
              <span>Orientation</span>
              <select
                value={orientation}
                onChange={(event) =>
                  setOrientation(
                    event.target.value === 'landscape' ? 'landscape' : 'portrait',
                  )
                }
              >
                <option value='portrait'>Portrait</option>
                <option value='landscape'>Landscape</option>
              </select>
            </label>
            <label className='field'>
              <span>Copies</span>
              <input
                type='number'
                min={1}
                max={10}
                value={copies}
                onChange={(event) =>
                  setCopies(Math.min(Math.max(Number(event.target.value) || 1, 1), 10))
                }
              />
            </label>
            <label className='settings-check'>
              <input
                type='checkbox'
                checked={autoClose}
                onChange={(event) => setAutoClose(event.target.checked)}
              />
              <span>Close print window after print</span>
            </label>
          </aside>

          <main className='order-print-preview'>
            {canPrint ? (
              <OrderPrintPreview
                html={previewBody}
                orderNumber={request.orderNumber}
                pageSize={pageSize}
                labelSize={labelSize}
              />
            ) : (
              <p className='empty-state'>Select at least one print form.</p>
            )}
          </main>
        </div>

        <footer className='order-print-dialog-footer'>
          <button type='button' className='secondary-button' onClick={onClose}>
            Cancel
          </button>
          <button
            type='button'
            className='secondary-button'
            onClick={() => void openPreviewWindow()}
            disabled={!canPrint}
          >
            Preview
          </button>
          <button
            type='button'
            className='primary-button print-action-button'
            onClick={() => void printSelectedForms()}
            disabled={!canPrint}
          >
            <PrinterIcon />
            Print
          </button>
        </footer>
      </section>
    </div>
  );
};

export const getIsoDatePart = (value: string) => value.slice(0, 10);
export const isIsoDateWithinRange = (
  isoDate: string,
  dateFrom: string,
  dateTo: string,
) => {
  if (!dateFrom && !dateTo) return true;
  if (dateFrom && isoDate < dateFrom) return false;
  if (dateTo && isoDate > dateTo) return false;
  return true;
};

export const formatPhoneNumber = (value: string) => {
  const groups = getPhoneNumberGroups(value);

  return groups.length > 0
    ? groups.join(' ')
    : value.replace(/^\+?38\s*/, '');
};

export const getPhoneNumberGroups = (value: string) => {
  const digits = value.replace(/\D/g, '');
  const localDigits = digits.startsWith('38')
    ? digits.slice(2)
    : digits;
  const tenDigitMatch = localDigits.match(
    /^(\d{3})(\d{3})(\d{2})(\d{2})$/,
  );
  const elevenDigitMatch = localDigits.match(
    /^(\d{3})(\d{4})(\d{2})(\d{2})$/,
  );

  if (tenDigitMatch) {
    return tenDigitMatch.slice(1);
  }

  if (elevenDigitMatch) {
    return elevenDigitMatch.slice(1);
  }

  return [];
};

export const getCreatedTime = (sale: Sale) =>
  new Date(sale.createdAt).getTime();

export const getOrdersSearchPlaceholder = (activeTab: OrdersTab) =>
  activeTab === 'orders'
    ? 'Search by order, client or device'
    : 'Search by order, client or manager';

export const ORDERS_CELL_MAX_LENGTH = 15;

export const truncateOrdersCellText = (
  value: string,
  maxLength: number = ORDERS_CELL_MAX_LENGTH,
) => {
  const normalizedValue = value.trim();
  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }
  return `${normalizedValue.slice(0, maxLength)}...`;
};

export const getOrdersColumnClassName = (columnKey: OrdersColumnKey) => {
  switch (columnKey) {
    case 'orderNumber':
      return 'orders-col-order-number';
    case 'client':
      return 'orders-col-client';
    case 'status':
      return 'orders-col-status';
    case 'primaryItem':
      return 'orders-col-primary-item';
    default:
      return '';
  }
};

export const getPrimaryItemColumnLabel = (activeTab: OrdersTab) =>
  activeTab === 'orders' ? 'Device' : 'Service center';

export const getDeviceLineItem = (sale: Sale) =>
  (sale.lineItems ?? []).find((item) => item.kind === 'product') ?? null;

export const getPrimaryDeviceName = (sale: Sale) => {
  const snapshotName = sale.product.name?.trim();
  if (snapshotName && snapshotName.toUpperCase() !== 'REPAIR PLACEHOLDER') {
    return snapshotName;
  }
  const deviceItem = getDeviceLineItem(sale);
  if (deviceItem?.name?.trim()) return deviceItem.name.trim();
  return sale.product.name;
};

export const getPrimaryDeviceSerial = (sale: Sale) => {
  const serial = sale.product.serialNumber?.trim();
  if (!serial || serial.toUpperCase() === 'REPAIR-PLACEHOLDER') return '';
  return serial;
};

export const getPrimaryItemCellContent = (
  sale: Sale,
  activeTab: OrdersTab,
) => (activeTab === 'orders' ? getPrimaryDeviceName(sale) : 'Service center');

export const isUrgentRepairOrder = (sale: Sale) =>
  isRepairOrder(sale) &&
  sale.note.toLowerCase().includes('urgent repair');

export const getColumnLabel = (
  columnKey: OrdersColumnKey,
  activeTab: OrdersTab,
) => {
  switch (columnKey) {
    case 'orderNumber':
      return 'Order #';
    case 'manager':
      return 'Manager';
    case 'received':
      return 'Issued';
    case 'master':
      return 'Master';
    case 'status':
      return 'Status';
    case 'primaryItem':
      return getPrimaryItemColumnLabel(activeTab);
    case 'price':
      return 'Price';
    case 'paid':
      return 'Paid';
    case 'client':
      return 'Client';
    case 'term':
      return 'Term';
    case 'warehouse':
      return 'Warehouse';
    case 'createdAt':
      return 'Add';
    case 'readyDate':
      return 'Ready date';
    default:
      return '';
  }
};

export const readVisibleColumns = (): OrdersColumnVisibility => {
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(ordersColumnsStorageKey) ?? '{}',
    ) as Partial<OrdersColumnVisibility>;
    const sanitizeColumns = (
      columns: OrdersColumnKey[] | undefined,
      tab: OrdersTab,
    ) => {
      const safeColumns =
        columns?.filter((columnKey) =>
          availableColumnsByTab[tab].includes(columnKey),
        ) ?? [];
      const orderedColumns = availableColumnsByTab[tab].filter(
        (columnKey) => safeColumns.includes(columnKey),
      );

      return orderedColumns.length > 0
        ? orderedColumns
        : defaultVisibleColumns[tab];
    };

    return {
      orders: sanitizeColumns(saved.orders, 'orders'),
      sales: sanitizeColumns(saved.sales, 'sales'),
      supplierOrders: defaultVisibleColumns.orders,
      supplierInformation: defaultVisibleColumns.orders,
    };
  } catch {
    return defaultVisibleColumns;
  }
};

export const PhoneNumber = ({ value }: { value: string }) => {
  const groups = getPhoneNumberGroups(value);

  if (groups.length === 0) {
    return <>{value.replace(/^\+?38\s*/, '')}</>;
  }

  return (
    <span className='orders-client-phone'>
      {groups.map((group, index) => (
        <span key={`${group}-${index}`}>{group}</span>
      ))}
    </span>
  );
};

export const isSystemTimelineMessage = (message: string) => {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.includes('changed status to "') ||
    normalized.includes('updated order main information') ||
    normalized.includes('created order with status "') ||
    normalized.includes('returned "') ||
    normalized.includes('returned sale to ')
  );
};

export const getClientStatusClass = (status: string) => {
  switch (status) {
    case 'new':
      return 'status-new';
    case 'vip':
      return 'status-vip';
    case 'opt':
      return 'status-opt';
    case 'blacklist':
      return 'status-blacklist';
    case 'ok':
      return 'status-ok';
    default:
      return 'status-gray';
  }
};
