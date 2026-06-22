import type { MouseEvent as ReactMouseEvent } from 'react';
import JsBarcode from 'jsbarcode';
import type { Employee } from '../../../entities/employee/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import { isRepairOrder } from '../../../entities/sale/lib/sale-kind';
import {
  getSaleProductArticle,
  getSaleProductId,
  getSaleProductName,
  getSaleProductSerialNumber,
} from '../../../entities/sale/lib/sale-product';
import { formatCurrency, formatDateTime } from '../../../shared/lib/format';
import i18n from '../../../shared/i18n/config';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
import type { Product, ProductModelUpdatePayload } from '../../../entities/product/model/types';
import type { CatalogProduct } from '../../../entities/catalog-product/model/types';
import type { ClientDevice, ClientDeviceFormValues } from '../../../entities/client-device/model/types';
import type { PrintForm } from '../../../entities/settings/model/types';
import {
  getOrientedLabelSize,
  normalizeLabelSize,
  printDocumentStyles,
  printLabelDocumentStyles,
  renderPrintTemplate as renderSettingsPrintTemplate,
  type PrintTemplateData,
} from '../../../entities/settings/model/printForms';

export type OrdersWorkspaceProps = {
  sales: Sale[];
  employees: Employee[];
  isLoading: boolean;
  activeTab: OrdersTab;
  visibleTabs: OrdersTab[];
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
  onSelectedSaleIdChange?: (saleId: string | null) => void;
  onOpenClientCard: (clientId: string) => void;
  products: Product[];
  clientDevices: ClientDevice[];
  catalogProducts: CatalogProduct[];
  printForms: PrintForm[];
  printCompanySettings: PrintCompanySettings;
  onCreateClientDevice: (payload: ClientDeviceFormValues) => Promise<boolean>;
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
  kind?: 'manual' | 'system';
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
  catalogProductId?: string;
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
  favoritesOnly: boolean;
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

export const orderTabs: Array<{ key: OrdersTab; labelKey: string }> = [
  { key: 'orders', labelKey: 'orders.tabs.orders' },
  { key: 'sales', labelKey: 'orders.tabs.sales' },
  { key: 'supplierOrders', labelKey: 'orders.tabs.supplierOrders' },
  { key: 'supplierInformation', labelKey: 'orders.tabs.supplierInformation' },
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
  const labelKey = `orders.supplier.orderStatuses.${status}`;
  const translated = i18n.t(labelKey);
  return translated === labelKey ? status : translated;
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

export const repairStatuses: Array<{ key: RepairStatus; labelKey: string }> = [
  { key: 'ready', labelKey: 'orders.status.repair.ready' },
  { key: 'issued', labelKey: 'orders.status.repair.issued' },
  { key: 'paid', labelKey: 'orders.status.repair.paid' },
  { key: 'new', labelKey: 'orders.status.repair.new' },
  { key: 'diagnostics', labelKey: 'orders.status.repair.diagnostics' },
  { key: 'inRepair', labelKey: 'orders.status.repair.inRepair' },
  { key: 'waitingParts', labelKey: 'orders.status.repair.waitingParts' },
  { key: 'clientApproved', labelKey: 'orders.status.repair.clientApproved' },
  { key: 'clientRejected', labelKey: 'orders.status.repair.clientRejected' },
  { key: 'issuedWithoutRepair', labelKey: 'orders.status.repair.issuedWithoutRepair' },
];
export const saleStatuses: Array<{ key: SaleStatus; labelKey: string }> = [
  { key: 'new', labelKey: 'orders.status.sale.new' },
  { key: 'reserved', labelKey: 'orders.status.sale.reserved' },
  { key: 'paid', labelKey: 'orders.status.sale.paid' },
  { key: 'issued', labelKey: 'orders.status.sale.issued' },
  { key: 'returned', labelKey: 'orders.status.sale.returned' },
];
export const finalRepairStatuses: RepairStatus[] = [
  'issued',
  'clientRejected',
  'issuedWithoutRepair',
];
export const stockLockedRepairStatuses = new Set<RepairStatus>([
  'clientRejected',
  'issuedWithoutRepair',
]);
export const getStockLockedRepairStatusMessage = () =>
  i18n.t('orders.payment.stockLocked');
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
  favoritesOnly: false,
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
        favoritesOnly: value.favoritesOnly === true,
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

const timelineDetectionMarkers = [
  'changed status to "',
  'змінив статус на "',
  'updated order main information',
  'оновив основну інформацію замовлення',
  'created order with status "',
  'створив замовлення зі статусом "',
  'returned "',
  'returned sale to ',
];

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

export const getStatusLabel = (sale: Sale, status: OrderStatus) => {
  const option = getStatusOptionsForSale(sale).find(
    (option) => option.key === status,
  );
  return option ? i18n.t(option.labelKey) : status;
};

export const buildChangedStatusTimelineMessage = (
  author: string,
  sale: Sale,
  status: OrderStatus,
) =>
  i18n.t('orders.timeline.changedStatus', {
    author,
    status: getStatusLabel(sale, status),
  });

export const buildCreatedOrderTimelineMessage = (
  sale: Sale,
  status: OrderStatus,
) =>
  i18n.t('orders.timeline.createdOrder', {
    status: getStatusLabel(sale, status),
  });

export const buildAddedItemTimelineMessage = (
  author: string,
  kind: string,
  name: string,
) => i18n.t('orders.timeline.addedItem', { author, kind, name });

export const buildRemovedProductTimelineMessage = (author: string, name: string) =>
  i18n.t('orders.timeline.removedProduct', { author, name });

export const buildRemovedServiceTimelineMessage = (author: string, name: string) =>
  i18n.t('orders.timeline.removedService', { author, name });

export const buildBoundSerialsTimelineMessage = (author: string, name: string) =>
  i18n.t('orders.timeline.boundSerials', { author, name });

export const buildUpdatedMainInfoTimelineMessage = (author: string) =>
  i18n.t('orders.timeline.updatedMainInfo', { author });

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
  productId: kind === 'product' ? getSaleProductId(sale) : undefined,
  serviceId: undefined,
  name:
    kind === 'product'
      ? getSaleProductName(sale, i18n.t('orders.fallbacks.product'))
      : i18n.t('orders.fallbacks.repair'),
  price: sale.salePrice,
  quantity: sale.quantity,
  warrantyPeriod: kind === 'service' ? 1 : 0,
});

export const getWarrantyOptions = () => [
  { labelKey: 'orders.warranty.none', value: 0 },
  { labelKey: 'orders.warranty.day30', value: 1 },
  { labelKey: 'orders.warranty.month3', value: 3 },
  { labelKey: 'orders.warranty.month6', value: 6 },
  { labelKey: 'orders.warranty.year1', value: 12 },
  { labelKey: 'orders.warranty.year2', value: 24 },
  { labelKey: 'orders.warranty.year3', value: 36 },
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
    if (
      !text.includes('changed status to') &&
      !text.includes('змінив статус на')
    ) {
      return false;
    }
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

export const repairEditableStatuses = new Set<RepairStatus>([
  'new',
  'paid',
  'diagnostics',
  'inRepair',
  'waitingParts',
  'clientApproved',
  'ready',
]);

export const isOrderEditableStatus = (
  sale: Sale,
  status: OrderStatus,
) =>
  isRepairOrder(sale)
    ? repairEditableStatuses.has(status as RepairStatus)
    : saleEditableStatuses.has(status);

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
          <th>${i18n.t('orders.print.table.name')}</th>
          <th>${i18n.t('orders.print.table.quantityShort')}</th>
          <th>${i18n.t('orders.print.table.price')}</th>
          <th>${i18n.t('orders.print.table.sum')}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
};

export const formatInvoiceAmount = (value: number) =>
  new Intl.NumberFormat(i18n.language.startsWith('uk') ? 'uk-UA' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

type AmountPluralForms = {
  one: string;
  few: string;
  many: string;
};

const getAmountWordArrays = () => ({
  zero: i18n.t('orders.print.amountInWords.zero'),
  units: i18n.t('orders.print.amountInWords.units', {
    returnObjects: true,
  }) as string[],
  femaleUnits: i18n.t('orders.print.amountInWords.femaleUnits', {
    returnObjects: true,
  }) as string[],
  teens: i18n.t('orders.print.amountInWords.teens', {
    returnObjects: true,
  }) as string[],
  tens: i18n.t('orders.print.amountInWords.tens', {
    returnObjects: true,
  }) as string[],
  hundreds: i18n.t('orders.print.amountInWords.hundreds', {
    returnObjects: true,
  }) as string[],
  thousand: i18n.t('orders.print.amountInWords.thousand', {
    returnObjects: true,
  }) as AmountPluralForms,
  hryvnia: i18n.t('orders.print.amountInWords.hryvnia', {
    returnObjects: true,
  }) as AmountPluralForms,
  kopiyka: i18n.t('orders.print.amountInWords.kopiyka', {
    returnObjects: true,
  }) as AmountPluralForms,
});

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

const pluralizeAmountWord = (value: number, forms: AmountPluralForms) => {
  if (i18n.language.startsWith('uk')) {
    return pluralizeUk(value, forms.one, forms.few, forms.many);
  }
  return value === 1 ? forms.one : forms.many;
};

export const numberToUkrainianWords = (value: number) => {
  const { zero, units, femaleUnits, teens, tens, hundreds, thousand } =
    getAmountWordArrays();
  if (value === 0) return zero;

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
      chunkToWords(thousands, i18n.language.startsWith('uk')),
      pluralizeAmountWord(thousands, thousand),
    );
  }
  if (rest > 0) words.push(chunkToWords(rest));

  return words.filter(Boolean).join(' ');
};

export const formatAmountInWords = (value: number) => {
  const { hryvnia, kopiyka } = getAmountWordArrays();
  const hryvnias = Math.floor(value);
  const kopiyky = Math.round((value - hryvnias) * 100);
  return `${numberToUkrainianWords(hryvnias)} ${pluralizeAmountWord(
    hryvnias,
    hryvnia,
  )} ${String(kopiyky).padStart(2, '0')} ${pluralizeAmountWord(
    kopiyky,
    kopiyka,
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
                ? i18n.t('orders.print.invoice.serialNumber', {
                    serials: item.serialNumbers.join(', '),
                  })
                : item.kind === 'service'
                  ? i18n.t('orders.print.invoice.itemTypeService')
                  : i18n.t('orders.print.invoice.itemTypeProduct'),
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
          <th style="width: 34px;">${i18n.t('orders.print.table.number')}</th>
          <th>${i18n.t('orders.print.table.name')}</th>
          <th style="width: 74px;">${i18n.t('orders.print.table.quantity')}</th>
          <th style="width: 72px;">${i18n.t('orders.print.table.priceWithoutVat')}</th>
          <th style="width: 64px;">${i18n.t('orders.print.table.vatRate')}</th>
          <th style="width: 82px;">${i18n.t('orders.print.table.sumWithoutVat')}</th>
          <th style="width: 82px;">${i18n.t('orders.print.table.sumWithVat')}</th>
        </tr>
      </thead>
      <tbody>${items.join('')}</tbody>
    </table>
  `;
};

const getLabelProductData = (
  lineItems: OrderLineItem[],
  orderNumber: string,
) => {
  const productItem =
    lineItems.find(
      (item) =>
        item.kind === 'product' &&
        (item.serialNumbers ?? []).some((serial) => serial.trim()),
    ) ?? lineItems.find((item) => item.kind === 'product');
  const serialNumber =
    productItem?.serialNumbers?.find((serial) => serial.trim())?.trim() ?? '';

  return {
    labelCode: serialNumber || orderNumber,
    labelTitle: productItem?.name ?? '',
    labelContact: '',
  };
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
  const isRepairLabel = isRepair || orderNumber.trim().toLowerCase().startsWith('r');
  const repairLabelData = {
    labelCode: orderNumber,
    labelTitle: getSaleProductName(sale),
    labelContact: sale.client.phone,
  };
  const saleLabelData = getLabelProductData(lineItems, orderNumber);
  const labelData = isRepairLabel ? repairLabelData : saleLabelData;
  return {
    id: sale.id,
    orderNumber,
    date: createdAt.split(',')[0] ?? createdAt,
    status: getStatusLabel(sale, normalizeOrderStatus(sale.status)),
    clientName: sale.client.name,
    clientPhone: sale.client.phone,
    deviceName: isRepair ? getSaleProductName(sale) : '',
    serialNumber: isRepair ? getSaleProductSerialNumber(sale) : '',
    article: isRepair ? getSaleProductArticle(sale) : '',
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
    net_amount: `${formatInvoiceAmount(totalAmount)} ${i18n.t('orders.print.currency.short')}`,
    vat_amount: i18n.t('orders.print.currency.zeroVat'),
    total_amount: `${formatInvoiceAmount(totalAmount)} ${i18n.t('orders.print.currency.short')}`,
    total_written: formatAmountInWords(totalAmount),
    seller_occupation: i18n.t('orders.print.invoice.director'),
    seller_name: sale.manager?.name ?? '-',
    note_label: i18n.t('orders.print.invoice.noteLabel'),
    products_table: renderLineItemsTable(
      productItems,
      i18n.t('orders.print.invoice.noProducts'),
    ),
    services_table: renderLineItemsTable(
      serviceItems,
      i18n.t('orders.print.invoice.noServices'),
    ),
    invoice_items_table: renderInvoiceItemsTable({ ...sale, lineItems }),
    barcode: labelData.labelCode,
    labelCode: labelData.labelCode,
    labelTitle: labelData.labelTitle,
    labelContact: labelData.labelContact,
    createdAt,
  };
};

export const buildOrderNumber = (sale: Sale) =>
  sale.recordNumber ?? i18n.t('orders.fallbacks.recordNumber');

export const formatReadyDate = (value: string) =>
  new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(value));

export const getWarehouseLabel = (sale: Sale) => {
  void sale;
  return i18n.t('orders.columns.serviceCenter');
};

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
        height: isLabelBarcode ? 52 : 44,
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
  orientation: PrintForm['orientation'],
) =>
  Array.from({ length: Math.max(1, copies) })
    .flatMap(() => forms)
    .map(
      (form) => {
        const isLabel = pageSize === 'label' || form.pageSize === 'label';
        const labelSize = getOrientedLabelSize(
          pageSize === 'label'
            ? activeLabelSize
            : normalizeLabelSize(form.labelSize),
          pageSize === 'label' ? orientation : form.orientation,
        );
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
  screenPreview = false,
}: {
  title: string;
  body: string;
  pageSize: PrintForm['pageSize'];
  labelSize: NonNullable<PrintForm['labelSize']>;
  orientation: PrintForm['orientation'];
  screenPreview?: boolean;
}) => {
  const orientedLabelSize = getOrientedLabelSize(labelSize, orientation);
  const isLabel = pageSize === 'label';
  const pageRule = isLabel
    ? `@page { size: ${orientedLabelSize.widthMm}mm ${orientedLabelSize.heightMm}mm; margin: 0; }`
    : `@page { size: A4 ${orientation}; margin: 12mm; }`;
  const labelStyle = isLabel
    ? ` style="--label-width: ${orientedLabelSize.widthMm}mm; --label-height: ${orientedLabelSize.heightMm}mm;"`
    : '';
  const htmlClasses = [
    isLabel ? 'print-html-label' : '',
    screenPreview ? 'print-screen-preview' : '',
  ].filter(Boolean);
  const bodyClasses = [
    isLabel ? 'print-body-label' : '',
    screenPreview ? 'print-screen-preview' : '',
  ].filter(Boolean);
  const htmlClass = htmlClasses.length ? ` class="${htmlClasses.join(' ')}"` : '';
  const bodyClass = bodyClasses.length ? ` class="${bodyClasses.join(' ')}"` : '';

  return `
    <!doctype html>
    <html${htmlClass}${labelStyle}>
      <head>
        <title>${title}</title>
        <style>
          ${pageRule}
          ${printDocumentStyles}
          ${isLabel ? printLabelDocumentStyles : ''}
        </style>
      </head>
      <body${bodyClass}${labelStyle}>${body}</body>
    </html>
  `;
};

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
    buildOrderPrintHtml({
      title,
      body,
      pageSize,
      labelSize,
      orientation,
      screenPreview: !shouldPrint,
    }),
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
    const triggerPrint = () => printWindow.print();
    if (pageSize === 'label') {
      // wait a frame (or two) to ensure layout and JsBarcode SVG are ready for label physical size
      requestAnimationFrame(() => requestAnimationFrame(triggerPrint));
    } else {
      triggerPrint();
    }
  }
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
    ? i18n.t('orders.toolbar.searchPlaceholder.orders')
    : i18n.t('orders.toolbar.searchPlaceholder.sales');

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
  activeTab === 'orders'
    ? i18n.t('orders.columns.device')
    : i18n.t('orders.columns.serviceCenter');

export const getDeviceLineItem = (sale: Sale) =>
  (sale.lineItems ?? []).find((item) => item.kind === 'product') ?? null;

export const getPrimaryDeviceName = (sale: Sale) => {
  const snapshotName = sale.product?.name?.trim();
  if (snapshotName && snapshotName.toUpperCase() !== 'REPAIR PLACEHOLDER') {
    return snapshotName;
  }
  const deviceItem = getDeviceLineItem(sale);
  if (deviceItem?.name?.trim()) return deviceItem.name.trim();
  return getSaleProductName(sale, i18n.t('orders.fallbacks.device'));
};

export const getPrimaryDeviceSerial = (sale: Sale) => {
  return getSaleProductSerialNumber(sale);
};

export const getPrimaryItemCellContent = (
  sale: Sale,
  activeTab: OrdersTab,
) =>
  activeTab === 'orders'
    ? getPrimaryDeviceName(sale)
    : i18n.t('orders.columns.serviceCenter');

export const isUrgentRepairOrder = (sale: Sale) => {
  if (!isRepairOrder(sale)) return false;
  const normalizedNote = sale.note.toLowerCase();
  return (
    normalizedNote.includes('urgent repair') ||
    normalizedNote.includes('urgentrepair') ||
    normalizedNote.includes('терміновий ремонт')
  );
};

export const getColumnLabel = (
  columnKey: OrdersColumnKey,
  activeTab: OrdersTab,
) => {
  switch (columnKey) {
    case 'orderNumber':
      return i18n.t('orders.columns.orderNumber');
    case 'manager':
      return i18n.t('orders.columns.manager');
    case 'received':
      return i18n.t('orders.columns.received');
    case 'master':
      return i18n.t('orders.columns.master');
    case 'status':
      return i18n.t('orders.columns.status');
    case 'primaryItem':
      return getPrimaryItemColumnLabel(activeTab);
    case 'price':
      return i18n.t('orders.columns.price');
    case 'paid':
      return i18n.t('orders.columns.paid');
    case 'client':
      return i18n.t('orders.columns.client');
    case 'term':
      return i18n.t('orders.columns.term');
    case 'warehouse':
      return i18n.t('orders.columns.warehouse');
    case 'createdAt':
      return i18n.t('orders.columns.createdAt');
    case 'readyDate':
      return i18n.t('orders.columns.readyDate');
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

export const isSystemTimelineMessage = (message: string) => {
  const normalized = message.trim().toLowerCase();
  return timelineDetectionMarkers.some((marker) =>
    normalized.includes(marker.toLowerCase()),
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
