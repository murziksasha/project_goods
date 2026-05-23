import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { Employee } from '../../../entities/employee/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import { isRepairOrder } from '../../../entities/sale/lib/sale-kind';
import {
  formatCurrency,
  formatDateTime,
} from '../../../shared/lib/format';
import {
  createFinanceTransaction,
  getCashboxes,
} from '../../../entities/finance/api/financeApi';
import {
  returnSale as returnSaleRequest,
  returnSaleLineItemToStock,
  updateSaleWorkspace,
} from '../../../entities/sale/api/saleApi';
import {
  createClientDevice,
  getClientDevices,
  updateClientDevice,
} from '../../../entities/client-device/api/clientDeviceApi';
import {
  createServiceCatalogItem,
  getServiceCatalogItems,
  updateServiceCatalogItem,
} from '../../../entities/service-catalog/api/serviceCatalogApi';
import type { ServiceCatalogItem } from '../../../entities/service-catalog/model/types';
import {
  initialServiceCatalogForm,
  toServiceCatalogForm,
} from '../../../entities/service-catalog/model/forms';
import {
  getProducts,
  updateProduct,
} from '../../../entities/product/api/productApi';
import {
  cancelSupplierOrder,
  getSupplierOrders,
  createSupplierOrder,
  takeOnChargeSupplierOrder,
  updateSupplierOrder,
} from '../../../entities/supplier-order/api/supplierOrderApi';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
import { getWarehouseSettings } from '../../../entities/warehouse-settings/api/warehouseSettingsApi';
import {
  createSupplier,
  getSuppliers,
} from '../../../entities/supplier/api/supplierApi';
import type {
  Supplier,
  SupplierFormValues,
} from '../../../entities/supplier/model/types';
import type { SupplierOrderFormValues } from '../../../entities/supplier-order/model/types';
import type {
  Product,
  ProductFormValues,
} from '../../../entities/product/model/types';
import { toProductForm } from '../../../entities/product/model/forms';
import type { Cashbox } from '../../../entities/finance/model/types';
import { NumberStepper } from '../../../shared/ui/NumberStepper';
import { PaginationPanel } from '../../../shared/ui/PaginationPanel';
import {
  SupplierOrderModal,
  type SupplierOrderModalSubmitPayload,
} from './SupplierOrderModal';
import {
  buildMissingServicePayload,
  shouldCreateMissingServiceOnSubmit,
} from '../model/missingService';
import { mergeSupplierOrderItemUpdate } from '../model/supplier-order-utils';

type OrdersWorkspaceProps = {
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
};

type OrdersTab = 'orders' | 'sales' | 'supplierOrders';
type OrdersColumnKey =
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
type OrdersColumnVisibility = Record<OrdersTab, OrdersColumnKey[]>;
const isPlainLeftClick = (
  event: ReactMouseEvent<HTMLAnchorElement>,
) =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

type RepairStatus =
  | 'issued'
  | 'ready'
  | 'new'
  | 'diagnostics'
  | 'inRepair'
  | 'waitingParts'
  | 'clientApproved'
  | 'clientRejected'
  | 'issuedWithoutRepair'
  | 'ready';
type SaleStatus =
  | 'new'
  | 'reserved'
  | 'paid'
  | 'issued'
  | 'returned';
type OrderStatus = RepairStatus | SaleStatus;
type PaymentAction =
  | 'deposit'
  | 'depositAndIssue'
  | 'issueWithoutPayment';
type PaymentTargetStatus =
  | 'issued'
  | 'issuedWithoutRepair'
  | 'paid';
type PrintForm = {
  id: string;
  title: string;
  content: string;
};
type TimelineEntry = {
  id: string;
  author: string;
  message: string;
  createdAt: string;
};
type PaymentEntry = {
  id: string;
  type: 'deposit' | 'refund';
  paymentMethod: 'cash' | 'non-cash';
  amount: number;
  cashboxId: string;
  cashboxName: string;
  createdAt: string;
  author: string;
};
type PaymentMethod = 'cash' | 'non-cash';
type OrderLineItemKind = 'product' | 'service';
type OrderLineItem = {
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
type RepairTypeFilter = 'all' | 'paid' | 'warranty';
type OrdersFilters = {
  statuses: OrderStatus[];
  orderNumber: string;
  client: string;
  assigneeId: string;
  warehouse: string;
  repairType: RepairTypeFilter;
  paymentMethod: '' | PaymentMethod;
  date: string;
  product: string;
  service: string;
};
type SavedOrdersFilter = {
  id: string;
  employeeId: string;
  name: string;
  icon: string;
  tab: OrdersTab;
  filters: OrdersFilters;
  createdAt: string;
};

const orderTabs: Array<{ key: OrdersTab; label: string }> = [
  { key: 'orders', label: 'Orders' },
  { key: 'sales', label: 'Sales' },
  { key: 'supplierOrders', label: 'Supplier Order' },
];

const supplierOrderSaleLinkPrefix = '[LINKED_SALE_ID:';
const supplierOrderClientLinkPrefix = '[LINKED_CLIENT_ID:';

const buildSupplierOrderLinkNote = (
  saleId: string,
  clientId: string,
) =>
  `${supplierOrderSaleLinkPrefix}${saleId}] ${supplierOrderClientLinkPrefix}${clientId}]`;

const withSupplierOrderLinkNote = (
  note: string,
  saleId: string,
  clientId: string,
) => {
  const linkNote = buildSupplierOrderLinkNote(saleId, clientId);
  const normalizedNote = note.trim();
  const withoutExistingMarkers = normalizedNote
    .replace(/\[LINKED_SALE_ID:[^\]]+\]/gi, '')
    .replace(/\[LINKED_CLIENT_ID:[^\]]+\]/gi, '')
    .trim();
  return withoutExistingMarkers
    ? `${withoutExistingMarkers}\n${linkNote}`
    : linkNote;
};

const extractLinkedValueFromNote = (
  note: string,
  prefix: string,
) => {
  const pattern = new RegExp(
    `${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\]]+)\\]`,
    'i',
  );
  return note.match(pattern)?.[1]?.trim() ?? '';
};

const extractLinkedSaleIdFromSupplierOrder = (order: SupplierOrder) =>
  extractLinkedValueFromNote(order.note ?? '', supplierOrderSaleLinkPrefix);

const extractLinkedClientIdFromSupplierOrder = (
  order: SupplierOrder,
) =>
  extractLinkedValueFromNote(
    order.note ?? '',
    supplierOrderClientLinkPrefix,
  );

const getSupplierOrderStatusLabel = (
  status: SupplierOrder['status'],
) => {
  switch (status) {
    case 'request':
      return 'Запит на закупівлю';
    case 'ordered':
      return 'Товар замовлений';
    case 'approved':
      return 'Затверджено';
    case 'stocked':
      return 'Оприбутковано';
    case 'overdue':
      return 'Протермінований';
    case 'cancelled':
      return 'Скасований';
    case 'unavailable':
      return 'Недоступний';
    default:
      return status;
  }
};

const printFormsStorageKey = 'project-goods.print-forms';
const ordersColumnsStorageKey = 'project-goods.orders-columns';
const savedOrdersFiltersStorageKey =
  'project-goods.saved-orders-filters';
const activeOrdersFiltersStorageKey = 'project-goods.orders-active-filters';
const filterIconOptions = [
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
const allOrdersColumnKeys: OrdersColumnKey[] = [
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
const defaultVisibleColumns: OrdersColumnVisibility = {
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
};
const availableColumnsByTab: Record<OrdersTab, OrdersColumnKey[]> = {
  orders: allOrdersColumnKeys,
  sales: defaultVisibleColumns.sales,
  supplierOrders: allOrdersColumnKeys,
};
const lockedColumnsByTab: Record<OrdersTab, OrdersColumnKey[]> = {
  orders: ['orderNumber'],
  sales: ['orderNumber'],
  supplierOrders: ['orderNumber'],
};

const repairStatuses: Array<{ key: RepairStatus; label: string }> = [
  { key: 'ready', label: 'Ready' },
  { key: 'issued', label: 'Issued' },
  { key: 'new', label: 'New repair' },
  { key: 'diagnostics', label: 'Diagnostics' },
  { key: 'inRepair', label: 'In repair' },
  { key: 'waitingParts', label: 'Waiting parts' },
  { key: 'clientApproved', label: 'Client approved' },
  { key: 'clientRejected', label: 'Client rejected' },
  { key: 'issuedWithoutRepair', label: 'Issued without repair' },
];
const saleStatuses: Array<{ key: SaleStatus; label: string }> = [
  { key: 'new', label: 'New sale' },
  { key: 'reserved', label: 'Reserved' },
  { key: 'paid', label: 'Paid' },
  { key: 'issued', label: 'Issued' },
  { key: 'returned', label: 'Returned' },
];
const finalRepairStatuses: RepairStatus[] = [
  'issued',
  'clientRejected',
  'issuedWithoutRepair',
];
const emptyOrdersFilters: OrdersFilters = {
  statuses: [],
  orderNumber: '',
  client: '',
  assigneeId: '',
  warehouse: '',
  repairType: 'all',
  paymentMethod: '',
  date: '',
  product: '',
  service: '',
};

const readActiveOrderFilters = () => {
  try {
    const raw = JSON.parse(
      window.localStorage.getItem(activeOrdersFiltersStorageKey) ?? '{}',
    ) as Partial<Record<OrdersTab, OrdersFilters>>;

    const normalizeOne = (
      value: OrdersFilters | undefined,
    ): OrdersFilters => {
      if (!value) return emptyOrdersFilters;
      return {
        ...emptyOrdersFilters,
        ...value,
        statuses: Array.isArray(value.statuses) ? value.statuses : [],
      };
    };

    return {
      orders: normalizeOne(raw.orders),
      sales: normalizeOne(raw.sales),
      supplierOrders: normalizeOne(raw.supplierOrders),
    } as Record<OrdersTab, OrdersFilters>;
  } catch {
    return {
      orders: emptyOrdersFilters,
      sales: emptyOrdersFilters,
      supplierOrders: emptyOrdersFilters,
    } as Record<OrdersTab, OrdersFilters>;
  }
};

const defaultPrintForms: PrintForm[] = [
  {
    id: 'receipt',
    title: 'Receipt',
    content:
      'Receipt for order {{orderNumber}}\nClient: {{clientName}}\nDevice: {{deviceName}}\nAmount: {{total}}',
  },
  {
    id: 'check',
    title: 'Check',
    content:
      'Check\nOrder: {{orderNumber}}\nPaid: {{paid}}\nTo pay: {{toPay}}',
  },
  {
    id: 'warranty',
    title: 'Warranty',
    content:
      'Warranty document\nDevice: {{deviceName}}\nS/N: {{serialNumber}}\nClient: {{clientName}}',
  },
  {
    id: 'completion-act',
    title: 'Completion act',
    content:
      'Completion act\nOrder: {{orderNumber}}\nWork: {{note}}\nTotal: {{total}}',
  },
  {
    id: 'invoice',
    title: 'Invoice',
    content:
      'Invoice for payment\nOrder: {{orderNumber}}\nClient: {{clientName}}\nTotal: {{total}}',
  },
  {
    id: 'barcode',
    title: 'Barcode',
    content:
      'Barcode form\nOrder: {{orderNumber}}\nS/N: {{serialNumber}}',
  },
];

const statusLabels = repairStatuses.reduce(
  (acc, status) => ({ ...acc, [status.key]: status.label }),
  saleStatuses.reduce(
    (acc, status) => ({ ...acc, [status.key]: status.label }),
    {} as Record<OrderStatus, string>,
  ),
);

const normalizeOrderStatus = (
  status: string | null | undefined,
): OrderStatus => {
  const normalized = String(status ?? '')
    .trim()
    .toLowerCase();
  const aliasMap: Record<string, OrderStatus> = {
    issuedwithoutrepair: 'issuedWithoutRepair',
    issued_without_repair: 'issuedWithoutRepair',
    'issued without repair': 'issuedWithoutRepair',
  };
  const repairStatusMap: Record<string, RepairStatus> = {
    new: 'new',
    diagnostics: 'diagnostics',
    inrepair: 'inRepair',
    waitingparts: 'waitingParts',
    clientapproved: 'clientApproved',
    clientrejected: 'clientRejected',
    ready: 'ready',
    issued: 'issued',
    issuedwithoutrepair: 'issuedWithoutRepair',
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

const getStatusOptionsForSale = (sale: Sale) =>
  isRepairOrder(sale) ? repairStatuses : saleStatuses;

const getStatusLabel = (sale: Sale, status: OrderStatus) =>
  getStatusOptionsForSale(sale).find(
    (option) => option.key === status,
  )?.label ?? statusLabels[status];

const readPrintForms = () => {
  try {
    const forms = JSON.parse(
      window.localStorage.getItem(printFormsStorageKey) ?? '[]',
    ) as PrintForm[];
    return forms.length > 0 ? forms : defaultPrintForms;
  } catch {
    return defaultPrintForms;
  }
};

const readSavedOrderFilters = () => {
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
        (item?.tab === 'orders' || item?.tab === 'sales' || item?.tab === 'supplierOrders') &&
        item?.filters,
    );
  } catch {
    return [];
  }
};

const createOrderLineItem = (
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

const warrantyOptions = [
  { label: 'None', value: 0 },
  { label: '30 day', value: 1 },
  { label: '3 month', value: 3 },
  { label: '6 month', value: 6 },
  { label: '1 year', value: 12 },
  { label: '2 year', value: 24 },
  { label: '3 year', value: 36 },
];

const getDefaultLineItems = (sale: Sale) =>
  isRepairOrder(sale)
    ? []
    : [createOrderLineItem(sale, 'product')];

const getDiscount = (sale: Sale) => ({
  mode: sale.discount?.mode === 'percent' ? 'percent' : 'amount',
  value:
    Number.isFinite(sale.discount?.value) && (sale.discount?.value ?? 0) > 0
      ? Number(sale.discount?.value)
      : 0,
} as const);

const getDiscountAmount = (
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

const getOrderBaseTotal = (
  sale: Sale,
  lineItems: OrderLineItem[] = sale.lineItems?.length
    ? sale.lineItems
    : getDefaultLineItems(sale),
) =>
  lineItems.length > 0
    ? lineItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0,
      )
    : sale.salePrice;

const getOrderTotal = (
  sale: Sale,
  lineItems: OrderLineItem[] = sale.lineItems?.length
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

const getLineItemsTotal = (lineItems: OrderLineItem[]) =>
  lineItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
const getLineItemRefundableAmount = (
  sale: Sale,
  lineItem: OrderLineItem,
  lineItems: OrderLineItem[] = sale.lineItems?.length
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
const normalizeProductLookupValue = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const getRemainingPayment = (
  sale: Sale,
  paidAmount: number,
  lineItems: OrderLineItem[] = sale.lineItems?.length
    ? sale.lineItems
    : getDefaultLineItems(sale),
) => Math.max(getOrderTotal(sale, lineItems) - paidAmount, 0);

const getLatestDepositPaymentMethod = (
  sale: Sale,
): PaymentMethod | null => {
  const entry = (sale.paymentHistory ?? []).find(
    (item) => item.type === 'deposit',
  );
  if (!entry) return null;
  return entry.paymentMethod === 'non-cash' ? 'non-cash' : 'cash';
};

const hasNonCashPayment = (sale: Sale) =>
  (sale.paidAmount ?? 0) > 0 &&
  getLatestDepositPaymentMethod(sale) === 'non-cash';

const isClosingStatus = (sale: Sale, status: OrderStatus) =>
  isRepairOrder(sale)
    ? status === 'issued' || status === 'issuedWithoutRepair'
    : status === 'paid';

const shouldCaptureReceivedBy = (sale: Sale, status: OrderStatus) =>
  isRepairOrder(sale)
    ? finalRepairStatuses.includes(status as RepairStatus)
    : status === 'reserved' ||
      status === 'paid' ||
      status === 'returned';

const getRepairCompletionDate = (sale: Sale) => {
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

const isSalePaymentStatus = (status: OrderStatus) =>
  status === 'paid';
const saleEditableStatuses = new Set<OrderStatus>([
  'new',
  'reserved',
  'paid',
]);

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const renderPrintTemplate = (
  template: string,
  sale: Sale,
  paidAmount: number,
  orderNumber: string,
) => {
  const total = getOrderTotal(sale);
  const replacements: Record<string, string> = {
    orderNumber,
    clientName: sale.client.name,
    clientPhone: sale.client.phone,
    deviceName: sale.product.name,
    serialNumber: sale.product.serialNumber,
    article: sale.product.article,
    total: formatCurrency(total),
    paid: formatCurrency(paidAmount),
    toPay: formatCurrency(getRemainingPayment(sale, paidAmount)),
    note: sale.note || '-',
  };

  return Object.entries(replacements).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template,
  );
};

const buildOrderNumber = (sale: Sale) =>
  sale.recordNumber ?? 'r------';

const formatReadyDate = (value: string) =>
  new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(value));

const getWarehouseLabel = (_sale: Sale) => 'Service center';

const getIsoDatePart = (value: string) => value.slice(0, 10);

const formatPhoneNumber = (value: string) => {
  const groups = getPhoneNumberGroups(value);

  return groups.length > 0
    ? groups.join(' ')
    : value.replace(/^\+?38\s*/, '');
};

const getPhoneNumberGroups = (value: string) => {
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

const getCreatedTime = (sale: Sale) =>
  new Date(sale.createdAt).getTime();

const getOrdersSearchPlaceholder = (activeTab: OrdersTab) =>
  activeTab === 'orders'
    ? 'Search by order, client or device'
    : 'Search by order, client or manager';

const ORDERS_CELL_MAX_LENGTH = 15;

const truncateOrdersCellText = (
  value: string,
  maxLength: number = ORDERS_CELL_MAX_LENGTH,
) => {
  const normalizedValue = value.trim();
  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }
  return `${normalizedValue.slice(0, maxLength)}...`;
};

const getOrdersColumnClassName = (columnKey: OrdersColumnKey) => {
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

const getPrimaryItemColumnLabel = (activeTab: OrdersTab) =>
  activeTab === 'orders' ? 'Device' : 'Service center';

const getDeviceLineItem = (sale: Sale) =>
  (sale.lineItems ?? []).find((item) => item.kind === 'product') ?? null;

const getPrimaryDeviceName = (sale: Sale) => {
  const snapshotName = sale.product.name?.trim();
  if (snapshotName && snapshotName.toUpperCase() !== 'REPAIR PLACEHOLDER') {
    return snapshotName;
  }
  const deviceItem = getDeviceLineItem(sale);
  if (deviceItem?.name?.trim()) return deviceItem.name.trim();
  return sale.product.name;
};

const getPrimaryDeviceSerial = (sale: Sale) => {
  const serial = sale.product.serialNumber?.trim();
  if (!serial || serial.toUpperCase() === 'REPAIR-PLACEHOLDER') return '';
  return serial;
};

const getPrimaryItemCellContent = (
  sale: Sale,
  activeTab: OrdersTab,
) => (activeTab === 'orders' ? getPrimaryDeviceName(sale) : 'Service center');

const isUrgentRepairOrder = (sale: Sale) =>
  isRepairOrder(sale) &&
  sale.note.toLowerCase().includes('urgent repair');

const getColumnLabel = (
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

const readVisibleColumns = (): OrdersColumnVisibility => {
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
    };
  } catch {
    return defaultVisibleColumns;
  }
};

const PhoneNumber = ({ value }: { value: string }) => {
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

const isSystemTimelineMessage = (message: string) => {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.includes('changed status to "') ||
    normalized.includes('updated order main information') ||
    normalized.includes('created order with status "') ||
    normalized.includes('returned "') ||
    normalized.includes('returned sale to ')
  );
};

const getClientStatusClass = (status: string) => {
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

export const OrdersWorkspace = ({
  sales,
  employees,
  isLoading,
  activeTab,
  searchValue,
  currentEmployee,
  canCreateOrders,
  onActiveTabChange,
  onSearchChange,
  onCreateOrder,
  createOrderHref,
  onSaleUpdate,
  onError,
  onSuccess,
  externalSelectedSaleId = null,
  onExternalSaleOpenHandled,
  onOpenClientCard,
}: OrdersWorkspaceProps) => {
  const currentEmployeeName =
    currentEmployee?.name ?? 'Unknown employee';
  const [visibleColumns, setVisibleColumns] =
    useState<OrdersColumnVisibility>(readVisibleColumns);
  const [isColumnsMenuOpen, setIsColumnsMenuOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(
    null,
  );
  const [openStatusSaleId, setOpenStatusSaleId] = useState<
    string | null
  >(null);
  const [statusMenuPosition, setStatusMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [paymentSale, setPaymentSale] = useState<Sale | null>(null);
  const [refundSale, setRefundSale] = useState<Sale | null>(null);
  const [returnSale, setReturnSale] = useState<Sale | null>(null);
  const [fullReturnSale, setFullReturnSale] = useState<Sale | null>(
    null,
  );
  const [returnLineItem, setReturnLineItem] =
    useState<OrderLineItem | null>(null);
  const [paymentTargetStatus, setPaymentTargetStatus] =
    useState<PaymentTargetStatus>('issued');
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [selectedCashboxId, setSelectedCashboxId] = useState('');
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedRefundCashboxId, setSelectedRefundCashboxId] =
    useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [returnRefundAmount, setReturnRefundAmount] = useState('');
  const [returnWarehouse, setReturnWarehouse] =
    useState('Service center');
  const [isPaymentModalLoading, setIsPaymentModalLoading] =
    useState(false);
  const [isPaymentSaving, setIsPaymentSaving] = useState(false);
  const [isRefundModalLoading, setIsRefundModalLoading] =
    useState(false);
  const [isRefundSaving, setIsRefundSaving] = useState(false);
  const [isReturnModalLoading, setIsReturnModalLoading] =
    useState(false);
  const [isReturnSaving, setIsReturnSaving] = useState(false);
  const [isFullReturnModalLoading, setIsFullReturnModalLoading] =
    useState(false);
  const [isFullReturnSaving, setIsFullReturnSaving] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const [isSaveFilterDrawerOpen, setIsSaveFilterDrawerOpen] =
    useState(false);
  const [savedFilters, setSavedFilters] = useState<
    SavedOrdersFilter[]
  >(readSavedOrderFilters);
  const [newFilterName, setNewFilterName] = useState('');
  const [newFilterIcon, setNewFilterIcon] = useState(
    filterIconOptions[0],
  );
  const [storedActiveFilters, setStoredActiveFilters] = useState<
    Record<OrdersTab, OrdersFilters>
  >(readActiveOrderFilters);
  const [draftFilters, setDraftFilters] = useState<OrdersFilters>(
    () => readActiveOrderFilters()[activeTab],
  );
  const [appliedFilters, setAppliedFilters] = useState<OrdersFilters>(
    () => readActiveOrderFilters()[activeTab],
  );
  const [pageByTab, setPageByTab] = useState<
    Record<OrdersTab, number>
  >({ orders: 1, sales: 1, supplierOrders: 1 });
  const [pageSizeByTab, setPageSizeByTab] = useState<
    Record<OrdersTab, number>
  >({ orders: 10, sales: 10, supplierOrders: 10 });
  const [warningMessage, setWarningMessage] = useState<string | null>(
    null,
  );
  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>(
    [],
  );
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);
  const statusFilterRef = useRef<HTMLDivElement | null>(null);
  const canManageSavedFilters = Boolean(currentEmployee?.id);
  const employeeSavedFilters = useMemo(() => {
    if (!currentEmployee?.id) return [];
    return savedFilters
      .filter((item) => item.employeeId === currentEmployee.id)
      .sort(
        (first, second) =>
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime(),
      );
  }, [currentEmployee?.id, savedFilters]);
  const visibleSavedFilters = useMemo(
    () =>
      employeeSavedFilters.filter((item) => item.tab === activeTab),
    [activeTab, employeeSavedFilters],
  );
  const visibleColumnKeys = visibleColumns[activeTab];
  const tableMinWidth = Math.max(720, visibleColumnKeys.length * 104);
  const tabSales = useMemo(
    () =>
      sales.filter((sale) =>
        activeTab === 'orders'
          ? isRepairOrder(sale)
          : !isRepairOrder(sale),
      ),
    [activeTab, sales],
  );
  const statusOptionsForActiveTab = useMemo(
    () => (activeTab === 'orders' ? repairStatuses : saleStatuses),
    [activeTab],
  );
  const statusKeysForActiveTab = useMemo(
    () =>
      new Set(statusOptionsForActiveTab.map((option) => option.key)),
    [statusOptionsForActiveTab],
  );
  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    tabSales.forEach((sale) => {
      if (sale.master) {
        map.set(sale.master.id, `${sale.master.name} (Master)`);
      }
      if (sale.manager) {
        map.set(sale.manager.id, `${sale.manager.name} (Manager)`);
      }
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((first, second) =>
        first.label.localeCompare(second.label),
      );
  }, [tabSales]);
  const warehouseOptions = useMemo(() => {
    const values = new Set(
      tabSales.map((sale) => getWarehouseLabel(sale)),
    );
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [tabSales]);
  const activeFiltersCount = useMemo(
    () =>
      appliedFilters.statuses.length +
      (appliedFilters.orderNumber.trim() ? 1 : 0) +
      (appliedFilters.client.trim() ? 1 : 0) +
      (appliedFilters.assigneeId ? 1 : 0) +
      (appliedFilters.warehouse ? 1 : 0) +
      (appliedFilters.repairType !== 'all' ? 1 : 0) +
      (appliedFilters.paymentMethod ? 1 : 0) +
      (appliedFilters.date ? 1 : 0) +
      (appliedFilters.product.trim() ? 1 : 0) +
      (appliedFilters.service.trim() ? 1 : 0),
    [appliedFilters],
  );

  const filteredOrders = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    const sortedTabSales = [...tabSales].sort(
      (firstSale, secondSale) =>
        getCreatedTime(secondSale) - getCreatedTime(firstSale),
    );
    const orderNumberValue = appliedFilters.orderNumber
      .trim()
      .toLowerCase();
    const clientValue = appliedFilters.client.trim().toLowerCase();
    const productValue = appliedFilters.product.trim().toLowerCase();
    const serviceValue = appliedFilters.service.trim().toLowerCase();

    return sortedTabSales.filter((sale) => {
      const orderNumber = buildOrderNumber(sale);
      const status = normalizeOrderStatus(sale.status);
      const lineItems = sale.lineItems?.length
        ? sale.lineItems
        : getDefaultLineItems(sale);
      const hasWarrantyService = lineItems.some(
        (item) => item.kind === 'service' && item.warrantyPeriod > 0,
      );
      const searchValues =
        activeTab === 'orders'
          ? [sale.product.name, sale.client.name, sale.client.phone]
          : [
              sale.client.name,
              sale.client.phone,
              sale.manager?.name ?? '',
              sale.issuedBy?.name ?? '',
            ];

      if (
        query &&
        !(
          String(orderNumber).includes(query) ||
          searchValues.some((value) =>
            value.toLowerCase().includes(query),
          )
        )
      ) {
        return false;
      }
      if (
        orderNumberValue &&
        !String(orderNumber).toLowerCase().includes(orderNumberValue)
      ) {
        return false;
      }
      if (
        clientValue &&
        ![
          sale.client.name,
          sale.client.phone,
          String(orderNumber),
        ].some((value) => value.toLowerCase().includes(clientValue))
      ) {
        return false;
      }
      if (
        appliedFilters.statuses.length > 0 &&
        !appliedFilters.statuses.includes(status)
      ) {
        return false;
      }
      if (
        appliedFilters.assigneeId &&
        sale.master?.id !== appliedFilters.assigneeId &&
        sale.manager?.id !== appliedFilters.assigneeId
      ) {
        return false;
      }
      if (
        appliedFilters.warehouse &&
        getWarehouseLabel(sale) !== appliedFilters.warehouse
      ) {
        return false;
      }
      if (appliedFilters.repairType === 'warranty') {
        if (!hasWarrantyService) return false;
      }
      if (appliedFilters.repairType === 'paid') {
        if (hasWarrantyService) return false;
      }
      if (
        appliedFilters.paymentMethod &&
        getLatestDepositPaymentMethod(sale) !==
          appliedFilters.paymentMethod
      ) {
        return false;
      }
      if (
        appliedFilters.date &&
        getIsoDatePart(sale.saleDate) !== appliedFilters.date
      ) {
        return false;
      }
      if (
        productValue &&
        ![
          sale.product.name,
          ...lineItems
            .filter((item) => item.kind === 'product')
            .map((item) => item.name),
        ].some((value) => value.toLowerCase().includes(productValue))
      ) {
        return false;
      }
      if (
        serviceValue &&
        !lineItems
          .filter((item) => item.kind === 'service')
          .some((item) =>
            item.name.toLowerCase().includes(serviceValue),
          )
      ) {
        return false;
      }
      return true;
    });
  }, [activeTab, appliedFilters, searchValue, tabSales]);

  const currentPage = pageByTab[activeTab];
  const currentPageSize = pageSizeByTab[activeTab];
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * currentPageSize;
    return filteredOrders.slice(start, start + currentPageSize);
  }, [currentPage, currentPageSize, filteredOrders]);

  const loadSupplierOrders = useCallback(async () => {
    try {
      setSupplierOrders(await getSupplierOrders(''));
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to load supplier orders.',
      );
    }
  }, [onError]);

  useEffect(() => {
    void loadSupplierOrders();
  }, [loadSupplierOrders]);

  useEffect(() => {
    const sanitizeFilters = (current: OrdersFilters) => {
      const nextStatuses = current.statuses.filter((status) =>
        statusKeysForActiveTab.has(status),
      );
      if (nextStatuses.length === current.statuses.length) {
        return current;
      }
      return { ...current, statuses: nextStatuses };
    };
    setDraftFilters((current) => sanitizeFilters(current));
    setAppliedFilters((current) => sanitizeFilters(current));
  }, [statusKeysForActiveTab]);

  useEffect(() => {
    setDraftFilters(storedActiveFilters[activeTab] ?? emptyOrdersFilters);
    setAppliedFilters(storedActiveFilters[activeTab] ?? emptyOrdersFilters);
  }, [activeTab, storedActiveFilters]);

  useEffect(() => {
    setPageByTab((current) => ({ ...current, [activeTab]: 1 }));
  }, [activeTab, searchValue]);

  useEffect(() => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredOrders.length / currentPageSize),
    );

    if (currentPage > pageCount) {
      setPageByTab((current) => ({
        ...current,
        [activeTab]: pageCount,
      }));
    }
  }, [
    activeTab,
    currentPage,
    currentPageSize,
    filteredOrders.length,
  ]);

  const toggleStatusFilter = (status: OrderStatus) => {
    setDraftFilters((current) => {
      const hasStatus = current.statuses.includes(status);
      return {
        ...current,
        statuses: hasStatus
          ? current.statuses.filter((key) => key !== status)
          : [...current.statuses, status],
      };
    });
  };
  const toggleAllStatuses = () => {
    setDraftFilters((current) => {
      const isAllSelected =
        current.statuses.length === statusOptionsForActiveTab.length;
      return {
        ...current,
        statuses: isAllSelected
          ? []
          : statusOptionsForActiveTab.map((item) => item.key),
      };
    });
  };
  const toggleFilterPanel = () => {
    setIsFilterPanelOpen((current) => !current);
  };

  const applyFilters = () => {
    const nextFilters = {
      ...draftFilters,
      orderNumber: draftFilters.orderNumber.trim(),
      client: draftFilters.client.trim(),
      product: draftFilters.product.trim(),
      service: draftFilters.service.trim(),
    };
    setAppliedFilters(nextFilters);
    setStoredActiveFilters((current) => ({
      ...current,
      [activeTab]: nextFilters,
    }));
    setPageByTab((current) => ({ ...current, [activeTab]: 1 }));
    setIsStatusFilterOpen(false);
    if (isFilterPanelOpen) {
      toggleFilterPanel();
    }
  };

  const resetFilters = () => {
    setDraftFilters(emptyOrdersFilters);
    setAppliedFilters(emptyOrdersFilters);
    setStoredActiveFilters((current) => ({
      ...current,
      [activeTab]: emptyOrdersFilters,
    }));
    setPageByTab((current) => ({ ...current, [activeTab]: 1 }));
    setIsStatusFilterOpen(false);
  };
  const saveCurrentFilter = () => {
    if (!currentEmployee?.id) {
      onError('Current employee is required to save filters.');
      return;
    }
    const name = newFilterName.trim();
    if (!name) {
      onError('Enter a filter name.');
      return;
    }
    const nextFilter: SavedOrdersFilter = {
      id: crypto.randomUUID(),
      employeeId: currentEmployee.id,
      name,
      icon: newFilterIcon,
      tab: activeTab,
      filters: {
        ...draftFilters,
        orderNumber: draftFilters.orderNumber.trim(),
        client: draftFilters.client.trim(),
        product: draftFilters.product.trim(),
        service: draftFilters.service.trim(),
      },
      createdAt: new Date().toISOString(),
    };
    setSavedFilters((current) => [nextFilter, ...current]);
    setIsSaveFilterDrawerOpen(false);
    setNewFilterName('');
    setNewFilterIcon(filterIconOptions[0]);
    onSuccess('Filter saved.');
  };
  const applySavedFilter = (savedFilter: SavedOrdersFilter) => {
    onActiveTabChange(savedFilter.tab);
    setDraftFilters(savedFilter.filters);
    setAppliedFilters(savedFilter.filters);
    setStoredActiveFilters((current) => ({
      ...current,
      [savedFilter.tab]: savedFilter.filters,
    }));
    setIsFilterPanelOpen(true);
    setIsStatusFilterOpen(false);
  };
  const removeSavedFilter = (filterId: string) => {
    setSavedFilters((current) =>
      current.filter((item) => item.id !== filterId),
    );
  };

  useEffect(() => {
    window.localStorage.setItem(
      savedOrdersFiltersStorageKey,
      JSON.stringify(savedFilters),
    );
  }, [savedFilters]);

  useEffect(() => {
    window.localStorage.setItem(
      activeOrdersFiltersStorageKey,
      JSON.stringify(storedActiveFilters),
    );
  }, [storedActiveFilters]);

  useEffect(() => {
    if (!isFilterPanelOpen && !isSaveFilterDrawerOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isSaveFilterDrawerOpen) {
          setIsSaveFilterDrawerOpen(false);
          return;
        }
        if (isStatusFilterOpen) {
          setIsStatusFilterOpen(false);
          return;
        }
        setIsFilterPanelOpen(false);
      }
    };

    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isFilterPanelOpen, isSaveFilterDrawerOpen, isStatusFilterOpen]);

  useEffect(() => {
    if (!isStatusFilterOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        statusFilterRef.current &&
        !statusFilterRef.current.contains(event.target as Node)
      ) {
        setIsStatusFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
    };
  }, [isStatusFilterOpen]);

  useEffect(() => {
    if (!isFilterPanelOpen) {
      setIsStatusFilterOpen(false);
    }
  }, [isFilterPanelOpen]);

  useEffect(() => {
    window.localStorage.setItem(
      ordersColumnsStorageKey,
      JSON.stringify(visibleColumns),
    );
  }, [visibleColumns]);

  useEffect(() => {
    if (!isColumnsMenuOpen) return;

    const closeMenuOnOutsideClick = (event: MouseEvent) => {
      if (
        columnsMenuRef.current &&
        !columnsMenuRef.current.contains(event.target as Node)
      ) {
        setIsColumnsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', closeMenuOnOutsideClick);

    return () => {
      document.removeEventListener(
        'mousedown',
        closeMenuOnOutsideClick,
      );
    };
  }, [isColumnsMenuOpen]);

  useEffect(() => {
    if (!openStatusSaleId) return;

    const closeStatusDropdownOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest('.order-status-menu') ||
        target?.closest('.order-status-options-portal')
      )
        return;
      setOpenStatusSaleId(null);
    };

    document.addEventListener(
      'mousedown',
      closeStatusDropdownOnOutsideClick,
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        closeStatusDropdownOnOutsideClick,
      );
    };
  }, [openStatusSaleId]);

  useEffect(() => {
    if (!openStatusSaleId) {
      setStatusMenuPosition(null);
      return;
    }

    const syncStatusMenuPosition = () => {
      const trigger = document.querySelector<HTMLElement>(
        `[data-status-trigger-id="${openStatusSaleId}"]`,
      );
      if (!trigger) {
        setStatusMenuPosition(null);
        return;
      }

      const rect = trigger.getBoundingClientRect();
      setStatusMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    };

    syncStatusMenuPosition();

    const handleResize = () => {
      setOpenStatusSaleId(null);
    };

    const handleScroll = () => {
      if (activeTab === 'orders') {
        syncStatusMenuPosition();
        return;
      }
      setOpenStatusSaleId(null);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [activeTab, openStatusSaleId]);

  const selectedSale = useMemo(
    () => sales.find((sale) => sale.id === selectedSaleId) ?? null,
    [sales, selectedSaleId],
  );
  const openStatusSale = useMemo(
    () =>
      openStatusSaleId
        ? sales.find((sale) => sale.id === openStatusSaleId) ?? null
        : null,
    [openStatusSaleId, sales],
  );

  useEffect(() => {
    if (!paymentSale) return;
    const refreshedSale = sales.find((item) => item.id === paymentSale.id);
    if (!refreshedSale) return;
    if (refreshedSale.updatedAt !== paymentSale.updatedAt) {
      setPaymentSale(refreshedSale);
    }
  }, [paymentSale, sales]);

  useEffect(() => {
    if (!paymentSale) return;
    const remainingPayment = getRemainingPayment(
      paymentSale,
      getPaidAmount(paymentSale),
      getLineItems(paymentSale),
    );
    const normalizedRemaining = Math.round(remainingPayment * 100) / 100;
    setPaymentAmount((current) => {
      const numericCurrent = Math.round(Number(current) * 100) / 100;
      if (!Number.isFinite(numericCurrent) || numericCurrent < 0) {
        return String(normalizedRemaining);
      }
      if (numericCurrent > normalizedRemaining) {
        return String(normalizedRemaining);
      }
      return current;
    });
  }, [paymentSale]);

  const selectedSaleStatusOptions = selectedSale
    ? isRepairOrder(selectedSale)
      ? repairStatuses
      : saleStatuses
    : repairStatuses;
  const selectedSaleStatus = selectedSale
    ? normalizeOrderStatus(selectedSale.status)
    : 'new';

  const getStatus = (sale: Sale): OrderStatus =>
    normalizeOrderStatus(sale.status);

  const getStatusOptions = getStatusOptionsForSale;

  const getLineItems = (sale: Sale) =>
    sale.lineItems?.length
      ? sale.lineItems
      : getDefaultLineItems(sale);

  const getPaidAmount = (sale: Sale) => sale.paidAmount ?? 0;

  const getOrderRemainingPayment = (sale: Sale) =>
    getRemainingPayment(
      sale,
      getPaidAmount(sale),
      getLineItems(sale),
    );

  const hasAttachedProducts = (sale: Sale) =>
    getLineItems(sale).some((item) => item.kind === 'product');

  const appendTimelineEntry = (
    message: string,
    author: string = currentEmployeeName,
  ): TimelineEntry => ({
    id: crypto.randomUUID(),
    author,
    message,
    createdAt: new Date().toISOString(),
  });

  const addPaymentHistoryEntry = (
    entry: Omit<PaymentEntry, 'id' | 'createdAt' | 'author'>,
  ): PaymentEntry => ({
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    author: currentEmployeeName,
  });

  const persistSaleWorkspace = async (
    sale: Sale,
    payload: {
      status?: OrderStatus;
      paidAmount?: number;
      masterId?: string;
      issuedById?: string;
      deviceName?: string;
      serialNumber?: string;
      discount?: Sale['discount'];
      timeline?: TimelineEntry[];
      paymentHistory?: PaymentEntry[];
      lineItems?: OrderLineItem[];
    },
  ) => {
    const updatedSale = await updateSaleWorkspace(sale.id, {
      kind: sale.kind,
      status: payload.status ?? normalizeOrderStatus(sale.status),
      paidAmount: payload.paidAmount ?? sale.paidAmount,
      masterId: payload.masterId,
      issuedById: payload.issuedById,
      deviceName: payload.deviceName,
      serialNumber: payload.serialNumber,
      discount: payload.discount ?? sale.discount,
      timeline: payload.timeline ?? sale.timeline,
      paymentHistory: payload.paymentHistory ?? sale.paymentHistory,
      lineItems: payload.lineItems ?? getLineItems(sale),
      expectedUpdatedAt: sale.updatedAt,
    });
    onSaleUpdate(updatedSale);
    return updatedSale;
  };

  const updateStatus = async (sale: Sale, status: OrderStatus) => {
    const remainingPayment = getOrderRemainingPayment(sale);
    const isZeroTotalSale =
      !isRepairOrder(sale) &&
      getOrderTotal(sale, getLineItems(sale)) <= 0;

    if (!isRepairOrder(sale) && status === 'returned') {
      setOpenStatusSaleId(null);
      await openReturnSaleModal(sale);
      return;
    }

    if (
      (isRepairOrder(sale) && status === 'issued') ||
      (!isRepairOrder(sale) &&
        (isSalePaymentStatus(status) || status === 'issued'))
    ) {
      setOpenStatusSaleId(null);
      if (remainingPayment <= 0) {
        await persistSaleWorkspace(sale, {
          status,
          issuedById: shouldCaptureReceivedBy(sale, status)
            ? currentEmployee?.id
            : '',
          timeline: [
            appendTimelineEntry(
              `${currentEmployeeName} changed status to "${getStatusLabel(sale, status)}".`,
            ),
            ...sale.timeline,
          ],
        });
        return;
      }

      if (!isRepairOrder(sale) && status === 'issued' && !isZeroTotalSale) {
        await openPaymentModal(sale, 'issued');
        return;
      }

      await openPaymentModal(
        sale,
        status as Extract<OrderStatus, PaymentTargetStatus>,
      );
      return;
    }

    if (
      isClosingStatus(sale, status) &&
      hasAttachedProducts(sale) &&
      remainingPayment > 0
    ) {
      setWarningMessage(
        'Product shipped but payment has not been received.',
      );
      setOpenStatusSaleId(null);
      return;
    }

    await persistSaleWorkspace(sale, {
      status,
      issuedById: shouldCaptureReceivedBy(sale, status)
        ? currentEmployee?.id
        : '',
      timeline: [
        appendTimelineEntry(
          `${currentEmployeeName} changed status to "${getStatusLabel(sale, status)}".`,
        ),
        ...sale.timeline,
      ],
    });
    setOpenStatusSaleId(null);
  };

  const openSaleCard = (sale: Sale) => {
    setSelectedSaleId(sale.id);
    setOpenStatusSaleId(null);
  };

  useEffect(() => {
    if (!externalSelectedSaleId) return;

    setSelectedSaleId(externalSelectedSaleId);
    setOpenStatusSaleId(null);
    onExternalSaleOpenHandled?.();
  }, [externalSelectedSaleId, onExternalSaleOpenHandled]);

  const syncReceivedBy = async (sale: Sale, status: OrderStatus) => {
    if (
      !currentEmployee?.id ||
      !shouldCaptureReceivedBy(sale, status)
    ) {
      return sale;
    }

    return persistSaleWorkspace(sale, {
      status,
      issuedById: currentEmployee.id,
    });
  };

  const toggleColumnVisibility = (columnKey: OrdersColumnKey) => {
    setVisibleColumns((current) => {
      const currentColumns = current[activeTab];
      const availableColumns = availableColumnsByTab[activeTab];
      const lockedColumns = lockedColumnsByTab[activeTab];

      if (
        !availableColumns.includes(columnKey) ||
        lockedColumns.includes(columnKey)
      ) {
        return current;
      }

      if (
        currentColumns.includes(columnKey) &&
        currentColumns.length === lockedColumns.length + 1
      ) {
        return current;
      }

      const nextColumns = currentColumns.includes(columnKey)
        ? currentColumns.filter((key) => key !== columnKey)
        : availableColumns.filter(
            (key) =>
              key === columnKey || currentColumns.includes(key),
          );

      return {
        ...current,
        [activeTab]: nextColumns,
      };
    });
  };

  const renderOrdersCell = (
    sale: Sale,
    columnKey: OrdersColumnKey,
  ): ReactNode => {
    const status = getStatus(sale);

    switch (columnKey) {
      case 'orderNumber':
        return (
          <button
            type='button'
            className='order-number-button'
            onClick={() => openSaleCard(sale)}
          >
            {buildOrderNumber(sale)}
          </button>
        );
      case 'manager':
        return (
          <span
            className='orders-table-cell-truncate'
            title={sale.manager?.name || '-'}
          >
            {truncateOrdersCellText(sale.manager?.name || '-')}
          </span>
        );
      case 'received':
        return (
          <span
            className='orders-table-cell-truncate'
            title={sale.issuedBy?.name || '-'}
          >
            {truncateOrdersCellText(sale.issuedBy?.name || '-')}
          </span>
        );
      case 'status':
        return (
          <div className='order-status-menu'>
            <button
              type='button'
              className={`order-status order-status-${status}`}
              data-status-trigger-id={sale.id}
              onClick={() =>
                setOpenStatusSaleId((currentId) =>
                  currentId === sale.id ? null : sale.id,
                )
              }
            >
              {getStatusLabel(sale, status)}
            </button>
          </div>
        );
      case 'primaryItem': {
        const primaryItemText = getPrimaryItemCellContent(
          sale,
          activeTab,
        );
        const primaryDeviceSerial = getPrimaryDeviceSerial(sale);
        return (
          <button
            type='button'
            className='order-device-button'
          onClick={() => openSaleCard(sale)}
          title={primaryItemText}
        >
            <span>{primaryItemText}</span>
            {activeTab === 'orders' ? (
              primaryDeviceSerial ? (
                <small title={primaryDeviceSerial}>
                  {`S/N: ${primaryDeviceSerial}`}
                </small>
              ) : null
            ) : (
              <small>Warehouse: Service center</small>
            )}
          </button>
        );
      }
      case 'price':
        return (
          <span
            className={
              hasNonCashPayment(sale) ? 'orders-money-non-cash' : ''
            }
          >
            {formatCurrency(getOrderTotal(sale, getLineItems(sale)))}
          </span>
        );
      case 'paid':
        return (
          <span
            className={
              hasNonCashPayment(sale) ? 'orders-money-non-cash' : ''
            }
          >
            {formatCurrency(getPaidAmount(sale))}
          </span>
        );
      case 'client':
        return (
          <div className='orders-client-cell'>
            <button
              type='button'
              className='orders-client-link'
              onClick={() => onOpenClientCard(sale.client.id)}
              title={sale.client.name}
            >
              {sale.client.name}
            </button>
            <small>
              <span title={sale.client.phone}>
                <PhoneNumber value={sale.client.phone} />
              </span>
              <span
                className={`client-status-badge ${getClientStatusClass(
                  String(sale.client.status || ''),
                )}`}
              >
                {sale.client.status || 'new'}
              </span>
            </small>
          </div>
        );
      case 'term':
        if (activeTab !== 'orders') return null;
        return isUrgentRepairOrder(sale) ? (
          <span className='orders-term-urgent'>Urgent</span>
        ) : (
          'Non-urgent'
        );
      case 'warehouse':
        return (
          <span
            className='orders-table-cell-truncate'
            title={getWarehouseLabel(sale)}
          >
            {truncateOrdersCellText(getWarehouseLabel(sale))}
          </span>
        );
      case 'master':
        return (
          <span
            className='orders-table-cell-truncate'
            title={sale.master?.name || '-'}
          >
            {truncateOrdersCellText(sale.master?.name || '-')}
          </span>
        );
      case 'createdAt':
        return formatReadyDate(sale.createdAt);
      case 'readyDate':
        return formatReadyDate(getRepairCompletionDate(sale));
      default:
        return null;
    }
  };

  const addComment = (sale: Sale, comment: string) => {
    const normalizedComment = comment.trim();
    if (!normalizedComment) return;
    void persistSaleWorkspace(sale, {
      timeline: [
        appendTimelineEntry(normalizedComment),
        ...sale.timeline,
      ],
    });
  };

  const updateDiscount = (
    sale: Sale,
    discount: { mode: 'percent' | 'amount'; value: number },
  ) => {
    const normalizedValue =
      Number.isFinite(discount.value) && discount.value > 0
        ? Math.round(discount.value * 100) / 100
        : 0;
    const currentDiscount = getDiscount(sale);
    if (
      currentDiscount.mode === discount.mode &&
      currentDiscount.value === normalizedValue
    ) {
      return;
    }

    // Optimistic UI update so the modal badge/mode flips immediately.
    setPaymentSale((current) =>
      current && current.id === sale.id
        ? {
            ...current,
            discount: {
              mode: discount.mode,
              value: normalizedValue,
            },
          }
        : current,
    );

    const lineItems = getLineItems(sale);
    const discountedTotal = Math.max(
      getOrderTotal(
        {
          ...sale,
          discount: {
            mode: discount.mode,
            value: normalizedValue,
          },
        },
        lineItems,
      ),
      0,
    );
    const nextPaidAmount = Math.min(getPaidAmount(sale), discountedTotal);
    void persistSaleWorkspace(sale, {
      paidAmount: nextPaidAmount,
      discount: {
        mode: discount.mode,
        value: normalizedValue,
      },
    });
  };

  const openPaymentModal = async (
    sale: Sale,
    targetStatus: PaymentTargetStatus = 'issued',
  ) => {
    const remainingPayment = getOrderRemainingPayment(sale);

    setPaymentSale(sale);
    setPaymentTargetStatus(targetStatus);
    setPaymentAmount(String(remainingPayment));
    setPaymentMethod(getLatestDepositPaymentMethod(sale) ?? 'cash');
    setIsPaymentModalLoading(true);

    try {
      const cashboxData = await getCashboxes();
      setCashboxes(cashboxData);
      setSelectedCashboxId(
        cashboxData.find((cashbox) => cashbox.isDefault)?.id ??
          cashboxData[0]?.id ??
          '',
      );
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to load cashboxes.',
      );
      setPaymentSale(null);
    } finally {
      setIsPaymentModalLoading(false);
    }
  };

  const openRefundModal = async (sale: Sale) => {
    if (getPaidAmount(sale) <= 0) {
      onError('No paid amount is available for refund.');
      return;
    }

    const paymentHistory = sale.paymentHistory ?? [];
    const lastDepositCashboxId =
      paymentHistory.find((entry) => entry.type === 'deposit')
        ?.cashboxId ?? '';

    setRefundSale(sale);
    setRefundAmount(String(getPaidAmount(sale)));
    setIsRefundModalLoading(true);

    try {
      const cashboxData = await getCashboxes();
      setCashboxes(cashboxData);
      setSelectedRefundCashboxId(
        lastDepositCashboxId ||
          cashboxData.find((cashbox) => cashbox.isDefault)?.id ||
          cashboxData[0]?.id ||
          '',
      );
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to load cashboxes.',
      );
      setRefundSale(null);
    } finally {
      setIsRefundModalLoading(false);
    }
  };

  const openReturnLineItemModal = async (
    sale: Sale,
    item: OrderLineItem,
  ) => {
    if (item.kind !== 'product') {
      onError('Only product items can be received back to warehouse.');
      return;
    }
    const saleStatus = normalizeOrderStatus(sale.status);
    const isIssuedStatus = saleStatus === 'issued';
    const canEditAndRemove =
      saleEditableStatuses.has(saleStatus) &&
      getPaidAmount(sale) <= 0 &&
      (item.serialNumbers ?? []).length === 0;

    if (!isIssuedStatus && !canEditAndRemove) {
      onError('This product cannot be returned to stock from current status.');
      return;
    }

    if (isIssuedStatus && (item.serialNumbers ?? []).length === 0) {
      onError(
        'Bind sold serial number before return to stock for issued sale.',
      );
      return;
    }

    const itemRefundableTotal = getLineItemRefundableAmount(
      sale,
      item,
      getLineItems(sale),
    );
    const currentPaidAmount = getPaidAmount(sale);
    const maxPaidAfterReturn = Math.max(
      getOrderTotal(sale, getLineItems(sale)) - itemRefundableTotal,
      0,
    );
    if (currentPaidAmount > maxPaidAfterReturn) {
      onError(
        `Refund ${formatCurrency(itemRefundableTotal)} to client first, then return "${item.name}" to stock.`,
      );
      return;
    }

    setReturnSale(sale);
    setReturnLineItem(item);
    setReturnWarehouse('Service center');
    setIsReturnModalLoading(false);
  };

  const openReturnSaleModal = async (sale: Sale) => {
    const lastDepositCashboxId =
      (sale.paymentHistory ?? []).find(
        (entry) => entry.type === 'deposit',
      )?.cashboxId ?? '';
    const lineItems = getLineItems(sale);
    const productTotal = getLineItemsTotal(
      lineItems.filter((item) => item.kind === 'product'),
    );
    const serviceTotal = getLineItemsTotal(
      lineItems.filter((item) => item.kind !== 'product'),
    );
    const paidAmount = getPaidAmount(sale);
    const suggestedRefund = Math.min(
      productTotal,
      Math.max(paidAmount - serviceTotal, 0),
    );

    if (productTotal <= 0) {
      onError('Sale has no products to return to stock.');
      return;
    }

    if (suggestedRefund <= 0) {
      onError(
        'Cannot return a sale without received payment. Use another status for unpaid cancellation.',
      );
      return;
    }

    setFullReturnSale(sale);
    setReturnRefundAmount(
      String(Math.round(suggestedRefund * 100) / 100),
    );
    setReturnWarehouse('Service center');
    setIsFullReturnModalLoading(true);

    try {
      const cashboxData = await getCashboxes();
      setCashboxes(cashboxData);
      setSelectedRefundCashboxId(
        lastDepositCashboxId ||
          cashboxData.find((cashbox) => cashbox.isDefault)?.id ||
          cashboxData[0]?.id ||
          '',
      );
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to load cashboxes.',
      );
      setFullReturnSale(null);
    } finally {
      setIsFullReturnModalLoading(false);
    }
  };

  const addLineItem = (
    sale: Sale,
    item: Omit<OrderLineItem, 'id'>,
  ) => {
    const nextItem = { ...item, id: crypto.randomUUID() };
    void persistSaleWorkspace(sale, {
      lineItems: [...getLineItems(sale), nextItem],
      timeline: [
        appendTimelineEntry(
          `${currentEmployeeName} added ${item.kind} "${item.name}".`,
        ),
        ...sale.timeline,
      ],
    });
  };

  const removeLineItem = (
    sale: Sale,
    itemId: string,
    itemIndex?: number,
  ) => {
    const currentItems = getLineItems(sale);
    const removedItem = currentItems.find((item, index) =>
      index === itemIndex ? true : item.id === itemId,
    );
    if (!removedItem) return;
    if (getPaidAmount(sale) > 0) {
      onError(
        'Cannot remove product or service from a paid order before refund.',
      );
      return;
    }
    if (
      !saleEditableStatuses.has(
        normalizeOrderStatus(sale.status),
      )
    ) {
      onError(
        'This order status does not allow line item removal.',
      );
      return;
    }
    const nextItems = currentItems.filter((item, index) =>
      index === itemIndex ? false : item.id !== itemId,
    );
    if (nextItems.length === 0) {
      void persistSaleWorkspace(sale, {
        lineItems: [],
      });
      return;
    }
    void persistSaleWorkspace(sale, {
      lineItems: nextItems,
      timeline: [
        appendTimelineEntry(
          removedItem.kind === 'product'
            ? `${currentEmployeeName} removed product "${removedItem.name}" from order.`
            : `${currentEmployeeName} removed service "${removedItem.name}" from order.`,
        ),
        ...sale.timeline,
      ],
    });
  };

  const updateLineItem = (
    sale: Sale,
    itemId: string,
    itemIndex: number | undefined,
    patch: Partial<
      Pick<
        OrderLineItem,
        | 'name'
        | 'productId'
        | 'serviceId'
        | 'price'
        | 'quantity'
        | 'warrantyPeriod'
        | 'serialNumbers'
      >
    >,
  ) => {
    const nextItems = getLineItems(sale).map((item, index) => {
      if (itemIndex === index) {
        return {
          ...item,
          ...patch,
          serialNumbers:
            patch.quantity !== undefined
              ? (patch.serialNumbers ?? item.serialNumbers)?.slice(
                  0,
                  patch.quantity,
                )
              : patch.serialNumbers ?? item.serialNumbers,
        };
      }
      if (itemIndex === undefined && item.id === itemId) {
        return { ...item, ...patch };
      }
      return item;
    });

    void persistSaleWorkspace(sale, {
      lineItems: nextItems,
    });
  };

  const setIssuedStatus = (status: PaymentTargetStatus = 'issued') =>
    status;

  const acceptPayment = async (action: PaymentAction) => {
    if (
      !paymentSale ||
      (action !== 'issueWithoutPayment' && !selectedCashboxId)
    )
      return;

    const currentPaidAmount = getPaidAmount(paymentSale);
    const currentLineItems = getLineItems(paymentSale);
    const currentPaymentRemaining = getRemainingPayment(
      paymentSale,
      currentPaidAmount,
      currentLineItems,
    );
    const normalizedAmount =
      Math.round(Number(paymentAmount) * 100) / 100;
    const nextPaymentRemaining = Math.max(
      currentPaymentRemaining -
        (action === 'issueWithoutPayment' ? 0 : normalizedAmount),
      0,
    );

    if (
      action !== 'issueWithoutPayment' &&
      (!Number.isFinite(normalizedAmount) ||
        normalizedAmount <= 0 ||
        normalizedAmount > currentPaymentRemaining)
    ) {
      onError('Payment amount cannot exceed the remaining balance.');
      return;
    }

    if (
      action === 'issueWithoutPayment' &&
      !isRepairOrder(paymentSale) &&
      paymentTargetStatus === 'issued' &&
      currentPaymentRemaining > 0
    ) {
      onError(
        'Issued status requires payment to cashbox. Use payment action or keep unpaid status.',
      );
      return;
    }

    if (
      (action === 'depositAndIssue' ||
        action === 'issueWithoutPayment') &&
      hasAttachedProducts(paymentSale) &&
      nextPaymentRemaining > 0
    ) {
      setWarningMessage(
        'Product shipped but payment has not been received.',
      );
      return;
    }

    setIsPaymentSaving(true);

    try {
      let nextPaidAmount = currentPaidAmount;
      let nextPaymentHistory = [
        ...(paymentSale.paymentHistory ?? []),
      ];
      let nextTimeline = [...(paymentSale.timeline ?? [])];
      let nextStatus: OrderStatus | undefined;

      if (action !== 'issueWithoutPayment') {
        const cashboxName =
          cashboxes.find(
            (cashbox) => cashbox.id === selectedCashboxId,
          )?.name ?? 'Cashbox';
        const acceptedAmount = normalizedAmount;
        nextPaidAmount = Math.min(
          currentPaidAmount + acceptedAmount,
          getOrderTotal(paymentSale, currentLineItems),
        );
        nextPaymentHistory = [
          addPaymentHistoryEntry({
            type: 'deposit',
            paymentMethod,
            amount: acceptedAmount,
            cashboxId: selectedCashboxId,
            cashboxName,
          }),
          ...(paymentSale.paymentHistory ?? []),
        ];
        nextTimeline = [
          appendTimelineEntry(
            `${currentEmployeeName} accepted ${formatCurrency(acceptedAmount)} to ${cashboxName} (${paymentMethod}).`,
          ),
          ...nextTimeline,
        ];
        await createFinanceTransaction({
          type: 'deposit',
          amount: String(normalizedAmount),
          currency: 'UAH',
          toCashboxId: selectedCashboxId,
          note: `Payment for order ${paymentSale.recordNumber ?? paymentSale.id}`,
        });
        setCashboxes(await getCashboxes());
        window.dispatchEvent(
          new CustomEvent('project-goods:finance-updated'),
        );
      }

      const shouldAutoMarkPaidOnDeposit =
        action === 'deposit' &&
        !isRepairOrder(paymentSale) &&
        (paymentTargetStatus === 'issued' ||
          paymentTargetStatus === 'paid');

      if (shouldAutoMarkPaidOnDeposit) {
        nextStatus = 'paid';
        nextTimeline = [
          appendTimelineEntry(
            `${currentEmployeeName} changed status to "${getStatusLabel(paymentSale, 'paid')}".`,
          ),
          ...nextTimeline,
        ];
      }

      if (
        action === 'depositAndIssue' ||
        action === 'issueWithoutPayment'
      ) {
        nextStatus = setIssuedStatus(paymentTargetStatus);
        nextTimeline = [
          appendTimelineEntry(
            `${currentEmployeeName} changed status to "${getStatusLabel(paymentSale, nextStatus)}".`,
          ),
          ...nextTimeline,
        ];
      }

      await persistSaleWorkspace(paymentSale, {
        status: nextStatus,
        paidAmount: nextPaidAmount,
        issuedById:
          nextStatus &&
          shouldCaptureReceivedBy(paymentSale, nextStatus)
            ? currentEmployee?.id
            : '',
        paymentHistory: nextPaymentHistory,
        timeline: nextTimeline,
      });

      onSuccess(
        action === 'deposit'
          ? 'Payment accepted to cashbox.'
          : paymentTargetStatus === 'paid'
            ? 'Sale marked as paid successfully.'
            : paymentTargetStatus === 'issuedWithoutRepair'
              ? 'Order issued without repair successfully.'
              : 'Order issued successfully.',
      );
      setPaymentSale(null);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to accept payment.',
      );
    } finally {
      setIsPaymentSaving(false);
    }
  };

  const refundPayment = async () => {
    if (!refundSale || !selectedRefundCashboxId) return;

    const currentPaidAmount = getPaidAmount(refundSale);
    const normalizedAmount =
      Math.round(Number(refundAmount) * 100) / 100;

    if (
      !Number.isFinite(normalizedAmount) ||
      normalizedAmount <= 0 ||
      normalizedAmount > currentPaidAmount
    ) {
      onError('Refund amount cannot exceed the paid amount.');
      return;
    }

    setIsRefundSaving(true);

    try {
      const lineItems = getLineItems(refundSale);
      const orderTotal = getOrderTotal(refundSale, lineItems);
      const currentStatus = normalizeOrderStatus(refundSale.status);
      const hasProducts = lineItems.some(
        (item) => item.kind === 'product' && item.quantity > 0,
      );
      const cashboxName =
        cashboxes.find(
          (cashbox) => cashbox.id === selectedRefundCashboxId,
        )?.name ?? 'Cashbox';
      const nextPaidAmount = Math.max(
        currentPaidAmount - normalizedAmount,
        0,
      );
      const shouldDowngradeIssuedStatus =
        !isRepairOrder(refundSale) &&
        currentStatus === 'issued' &&
        hasProducts &&
        nextPaidAmount < orderTotal;
      const nextStatus: OrderStatus = shouldDowngradeIssuedStatus
        ? 'reserved'
        : currentStatus;
      const nextPaymentHistory = [
        addPaymentHistoryEntry({
          type: 'refund',
          paymentMethod: 'cash',
          amount: normalizedAmount,
          cashboxId: selectedRefundCashboxId,
          cashboxName,
        }),
        ...(refundSale.paymentHistory ?? []),
      ];
      const nextTimeline = [
        ...(shouldDowngradeIssuedStatus
          ? [
              appendTimelineEntry(
                `${currentEmployeeName} changed status to "${getStatusLabel(refundSale, nextStatus)}".`,
              ),
            ]
          : []),
        appendTimelineEntry(
          `${currentEmployeeName} refunded ${formatCurrency(normalizedAmount)} from ${cashboxName}.`,
        ),
        ...(refundSale.timeline ?? []),
      ];
      await createFinanceTransaction({
        type: 'withdraw',
        amount: String(normalizedAmount),
        currency: 'UAH',
        fromCashboxId: selectedRefundCashboxId,
        note: `Refund for order ${refundSale.recordNumber ?? refundSale.id}`,
      });
      await persistSaleWorkspace(refundSale, {
        status: nextStatus,
        paidAmount: nextPaidAmount,
        issuedById: shouldCaptureReceivedBy(refundSale, nextStatus)
          ? currentEmployee?.id ?? ''
          : '',
        paymentHistory: nextPaymentHistory,
        timeline: nextTimeline,
      });
      setCashboxes(await getCashboxes());
      window.dispatchEvent(
        new CustomEvent('project-goods:finance-updated'),
      );
      onSuccess('Refund completed successfully.');
      setRefundSale(null);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to refund payment.',
      );
    } finally {
      setIsRefundSaving(false);
    }
  };

  const returnLineItemToStock = async () => {
    if (!returnSale || !returnLineItem) return;
    if (!returnWarehouse.trim()) {
      onError('Warehouse is required.');
      return;
    }

    setIsReturnSaving(true);

    try {
      let updatedSale = await returnSaleLineItemToStock(returnSale.id, {
        lineItemId: returnLineItem.id,
        warehouse: returnWarehouse,
        author: currentEmployeeName,
      });

      const hasRemainingProductItems = getLineItems(updatedSale).some(
        (item) => item.kind === 'product' && item.quantity > 0,
      );
      const canAutoMarkReturned =
        !isRepairOrder(updatedSale) &&
        normalizeOrderStatus(updatedSale.status) === 'issued' &&
        getPaidAmount(updatedSale) <= 0 &&
        !hasRemainingProductItems;

      if (canAutoMarkReturned) {
        updatedSale = await persistSaleWorkspace(updatedSale, {
          status: 'returned',
          issuedById: shouldCaptureReceivedBy(updatedSale, 'returned')
            ? currentEmployee?.id ?? ''
            : '',
          timeline: [
            appendTimelineEntry(
              `${currentEmployeeName} changed status to "${getStatusLabel(updatedSale, 'returned')}".`,
            ),
            ...(updatedSale.timeline ?? []),
          ],
        });
      }

      onSaleUpdate(updatedSale);
      await syncReceivedBy(
        updatedSale,
        updatedSale.status as OrderStatus,
      );
      onSuccess('Product returned to stock.');
      setReturnSale(null);
      setReturnLineItem(null);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to return product.',
      );
    } finally {
      setIsReturnSaving(false);
    }
  };

  const returnFullSaleToStock = async () => {
    if (!fullReturnSale || !selectedRefundCashboxId) return;

    const refundAmountValue =
      Math.round(Number(returnRefundAmount) * 100) / 100;
    const lineItems = getLineItems(fullReturnSale);
    const productTotal = getLineItemsTotal(
      lineItems.filter((item) => item.kind === 'product'),
    );
    const serviceTotal = getLineItemsTotal(
      lineItems.filter((item) => item.kind !== 'product'),
    );
    const paidAmount = getPaidAmount(fullReturnSale);

    if (
      !Number.isFinite(refundAmountValue) ||
      refundAmountValue <= 0 ||
      refundAmountValue > productTotal ||
      refundAmountValue > paidAmount ||
      paidAmount - refundAmountValue > serviceTotal ||
      !returnWarehouse.trim()
    ) {
      onError('Refund amount is not valid for this return.');
      return;
    }

    setIsFullReturnSaving(true);

    try {
      const updatedSale = await returnSaleRequest(fullReturnSale.id, {
        cashboxId: selectedRefundCashboxId,
        refundAmount: String(refundAmountValue),
        warehouse: returnWarehouse,
        author: currentEmployeeName,
      });
      onSaleUpdate(updatedSale);
      await syncReceivedBy(
        updatedSale,
        updatedSale.status as OrderStatus,
      );
      setCashboxes(await getCashboxes());
      window.dispatchEvent(
        new CustomEvent('project-goods:finance-updated'),
      );
      onSuccess(
        'Sale returned, products moved back to stock, and refund completed.',
      );
      setFullReturnSale(null);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to return sale.',
      );
    } finally {
      setIsFullReturnSaving(false);
    }
  };

  const saveOrderMainInfo = async (
    sale: Sale,
    payload: {
      serialNumber: string;
      masterId: string;
      status: OrderStatus;
    },
  ) => {
    try {
      const timeline = [
        appendTimelineEntry(
          `${currentEmployeeName} updated order main information.`,
        ),
        ...sale.timeline,
      ];
      const shouldAssignIssuedBy = shouldCaptureReceivedBy(
        sale,
        payload.status,
      );
      await persistSaleWorkspace(sale, {
        status: payload.status,
        masterId: payload.masterId,
        deviceName: getPrimaryDeviceName(sale),
        serialNumber: payload.serialNumber,
        issuedById:
          shouldAssignIssuedBy && currentEmployee?.id
            ? currentEmployee.id
            : '',
        timeline,
      });

      if (isRepairOrder(sale)) {
        const normalizedOldDeviceName = getPrimaryDeviceName(sale)
          .trim()
          .toLowerCase();
        const probeQuery = getPrimaryDeviceName(sale).trim() || sale.client.phone;
        const allDevices = await getClientDevices(probeQuery);
        const linkedDevice = allDevices.find((device) => {
          if (device.clientId !== sale.client.id) return false;
          return device.name.trim().toLowerCase() === normalizedOldDeviceName;
        });

        if (linkedDevice) {
          await updateClientDevice(linkedDevice.id, {
            clientId: sale.client.id,
            clientName: sale.client.name,
            clientPhone: sale.client.phone,
            name: getPrimaryDeviceName(sale),
            serialNumber: '',
            note: linkedDevice.note ?? '',
            source: linkedDevice.source,
            isActive: linkedDevice.isActive,
            expectedUpdatedAt: linkedDevice.updatedAt,
          });
        } else if (getPrimaryDeviceName(sale).trim().length >= 2) {
          await createClientDevice({
            clientId: sale.client.id,
            clientName: sale.client.name,
            clientPhone: sale.client.phone,
            name: getPrimaryDeviceName(sale),
            serialNumber: '',
            note: '',
            source: 'repairOrder',
            isActive: true,
          });
        }
      }

      onSuccess('Order main information updated.');
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to save order main information.',
      );
    }
  };

  return (
    <section className='orders-page'>
      {selectedSale ? (
        <OrderDetailCard
          sale={selectedSale}
          sales={sales}
          supplierOrders={supplierOrders}
          employees={employees}
          status={selectedSaleStatus}
          statusOptions={selectedSaleStatusOptions}
          comments={selectedSale.timeline ?? []}
          lineItems={getLineItems(selectedSale)}
          paidAmount={getPaidAmount(selectedSale)}
          isReadOnly={
            !isRepairOrder(selectedSale) &&
            !saleEditableStatuses.has(
              normalizeOrderStatus(selectedSale.status),
            )
          }
          onClose={() => setSelectedSaleId(null)}
          onAddComment={(comment) =>
            addComment(selectedSale, comment)
          }
          onAddLineItem={(item) => addLineItem(selectedSale, item)}
          onRemoveLineItem={(itemId, itemIndex) =>
            removeLineItem(selectedSale, itemId, itemIndex)
          }
          onUpdateLineItem={(itemId, itemIndex, patch) =>
            updateLineItem(selectedSale, itemId, itemIndex, patch)
          }
          onReturnLineItem={(item) =>
            openReturnLineItemModal(selectedSale, item)
          }
          onOpenRelatedSale={openSaleCard}
          onAcceptPayment={() => openPaymentModal(selectedSale)}
          onRefundPayment={() => openRefundModal(selectedSale)}
          onDiscountChange={(discount) =>
            updateDiscount(selectedSale, discount)
          }
          onOpenClientCard={() =>
            onOpenClientCard(selectedSale.client.id)
          }
          onSupplierOrderCreated={loadSupplierOrders}
          onError={onError}
          onSuccess={onSuccess}
          onSaveMainInfo={(payload) =>
            saveOrderMainInfo(selectedSale, payload)
          }
        />
      ) : null}

      <div
        className='orders-tabs'
        role='tablist'
        aria-label='Order categories'
      >
        {orderTabs.map((tab) => (
          <button
            key={tab.key}
            type='button'
            className={
              tab.key === activeTab
                ? 'orders-tab orders-tab-active'
                : 'orders-tab'
            }
            onClick={() => onActiveTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className='orders-toolbar'>
        <div className='orders-toolbar-left'>
          <button
            type='button'
            className='toolbar-filter-button toolbar-filter-toggle-button'
            aria-expanded={isFilterPanelOpen}
            onClick={toggleFilterPanel}
          >
            Filter
            {activeFiltersCount > 0 ? (
              <span className='toolbar-filter-count'>
                {activeFiltersCount}
              </span>
            ) : null}
          </button>
          <div className='toolbar-settings' ref={columnsMenuRef}>
            <button
              type='button'
              className='toolbar-square-button'
              aria-label='Toggle table columns'
              aria-expanded={isColumnsMenuOpen}
              onClick={() =>
                setIsColumnsMenuOpen((current) => !current)
              }
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                className='toolbar-square-button-icon'
                fill='currentColor'
              >
                <path d='M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.03 7.03 0 0 0-1.69-.98l-.38-2.65A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.49.42l-.38 2.65c-.63.25-1.21.57-1.75.95l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.14.24.42.33.68.22l2.49-1c.54.38 1.12.7 1.75.95l.38 2.65c.04.27.26.47.49.47h4c.27 0 .5-.2.54-.47l.38-2.65c.63-.25 1.21-.57 1.75-.95l2.49 1c.26.11.54.02.68-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z' />
              </svg>
            </button>
            {isColumnsMenuOpen ? (
              <div className='toolbar-settings-menu'>
                {availableColumnsByTab[activeTab].map((columnKey) => (
                  <label
                    key={`${activeTab}-${columnKey}`}
                    className='toolbar-settings-option'
                  >
                    <input
                      type='checkbox'
                      checked={visibleColumnKeys.includes(columnKey)}
                      disabled={lockedColumnsByTab[
                        activeTab
                      ].includes(columnKey)}
                      onChange={() =>
                        toggleColumnVisibility(columnKey)
                      }
                    />
                    <span>
                      {getColumnLabel(columnKey, activeTab)}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <div className='orders-search-group orders-search-group-clearable'>
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={getOrdersSearchPlaceholder(activeTab)}
              aria-label='Search orders'
            />
            {searchValue ? (
              <span
                role='button'
                tabIndex={0}
                className='orders-search-clear'
                aria-label='Clear search text'
                onClick={() => onSearchChange('')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSearchChange('');
                  }
                }}
              >
                x
              </span>
            ) : null}
          </div>
        </div>
        <div className='orders-toolbar-actions'>
          <a
            className={
              canCreateOrders
                ? 'orders-create-button'
                : 'orders-create-button orders-create-button-disabled'
            }
            href={canCreateOrders ? createOrderHref : '#'}
            aria-disabled={!canCreateOrders}
            tabIndex={canCreateOrders ? undefined : -1}
            onClick={(event) => {
              if (!canCreateOrders) {
                event.preventDefault();
                return;
              }

              if (!isPlainLeftClick(event)) return;
              event.preventDefault();
              onCreateOrder(activeTab);
            }}
            title={
              canCreateOrders
                ? 'Create order'
                : 'Only employees with orders.manage permission can create orders.'
            }
          >
            Create order
          </a>
        </div>
      </div>

      <section
        className={
          isFilterPanelOpen
            ? 'orders-filter-panel orders-filter-panel-open'
            : 'orders-filter-panel'
        }
        aria-hidden={!isFilterPanelOpen}
      >
        <div className='orders-filter-saved-row'>
          <p>Saved filters:</p>
          <div className='orders-filter-saved-list'>
            {visibleSavedFilters.length > 0 ? (
              visibleSavedFilters.map((savedFilter) => (
                <div
                  key={savedFilter.id}
                  className='orders-filter-saved-item'
                >
                  <button
                    type='button'
                    className='orders-filter-saved-button'
                    onClick={() => applySavedFilter(savedFilter)}
                    title={savedFilter.name}
                  >
                    <span>{savedFilter.icon}</span>
                    <span>{savedFilter.name}</span>
                  </button>
                  <button
                    type='button'
                    className='orders-filter-delete-button'
                    aria-label={`Delete ${savedFilter.name}`}
                    onClick={() => removeSavedFilter(savedFilter.id)}
                  >
                    🗑️
                  </button>
                </div>
              ))
            ) : (
              <small>No saved filters for this tab.</small>
            )}
          </div>
          <button
            type='button'
            className='toolbar-filter-button'
            onClick={() => setIsSaveFilterDrawerOpen(true)}
            disabled={!canManageSavedFilters}
            title={
              canManageSavedFilters
                ? 'Save filter'
                : 'Employee profile is required to save filters.'
            }
          >
            Save filter
          </button>
        </div>

        <div className='orders-filter-grid'>
          <div
            className='orders-filter-field orders-filter-status-field'
            ref={statusFilterRef}
          >
            <span>Status</span>
            <button
              type='button'
              className='orders-filter-status-toggle'
              aria-expanded={isStatusFilterOpen}
              onClick={() =>
                setIsStatusFilterOpen((current) => !current)
              }
            >
              {draftFilters.statuses.length > 0
                ? `${draftFilters.statuses.length} selected`
                : 'All'}
            </button>
            {isStatusFilterOpen ? (
              <div className='orders-filter-status-menu'>
                <label className='orders-filter-status-all'>
                  <input
                    type='checkbox'
                    checked={
                      draftFilters.statuses.length ===
                      statusOptionsForActiveTab.length
                    }
                    onChange={toggleAllStatuses}
                  />
                  <strong>All</strong>
                </label>
                {statusOptionsForActiveTab.map((statusOption) => (
                  <label key={statusOption.key}>
                    <input
                      type='checkbox'
                      checked={draftFilters.statuses.includes(
                        statusOption.key,
                      )}
                      onChange={() =>
                        toggleStatusFilter(statusOption.key)
                      }
                    />
                    <span>{statusOption.label}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          <label className='orders-filter-field'>
            <span>Order number</span>
            <input
              type='text'
              value={draftFilters.orderNumber}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  orderNumber: event.target.value,
                }))
              }
              placeholder='Order #'
            />
          </label>

          <label className='orders-filter-field'>
            <span>Client</span>
            <input
              type='text'
              value={draftFilters.client}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  client: event.target.value,
                }))
              }
              placeholder='Client name or phone'
            />
          </label>

          <label className='orders-filter-field'>
            <span>Master / manager</span>
            <select
              value={draftFilters.assigneeId}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  assigneeId: event.target.value,
                }))
              }
            >
              <option value=''>All</option>
              {assigneeOptions.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.label}
                </option>
              ))}
            </select>
          </label>

          <label className='orders-filter-field'>
            <span>Warehouse</span>
            <select
              value={draftFilters.warehouse}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  warehouse: event.target.value,
                }))
              }
            >
              <option value=''>All</option>
              {warehouseOptions.map((warehouse) => (
                <option key={warehouse} value={warehouse}>
                  {warehouse}
                </option>
              ))}
            </select>
          </label>

          <label className='orders-filter-field'>
            <span>Repair type</span>
            <select
              value={draftFilters.repairType}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  repairType: event.target.value as RepairTypeFilter,
                }))
              }
            >
              <option value='all'>All</option>
              <option value='paid'>Paid</option>
              <option value='warranty'>Warranty</option>
            </select>
          </label>

          <label className='orders-filter-field'>
            <span>Date</span>
            <input
              type='date'
              value={draftFilters.date}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  date: event.target.value,
                }))
              }
            />
          </label>

          <label className='orders-filter-field'>
            <span>Payment method</span>
            <select
              value={draftFilters.paymentMethod}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  paymentMethod: event.target.value as '' | PaymentMethod,
                }))
              }
            >
              <option value=''>All</option>
              <option value='cash'>Cash</option>
              <option value='non-cash'>Non-cash</option>
            </select>
          </label>

          <label className='orders-filter-field'>
            <span>Product</span>
            <input
              type='text'
              value={draftFilters.product}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  product: event.target.value,
                }))
              }
              placeholder='Product name'
            />
          </label>

          <label className='orders-filter-field'>
            <span>Service</span>
            <input
              type='text'
              value={draftFilters.service}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  service: event.target.value,
                }))
              }
              placeholder='Service name'
            />
          </label>
        </div>

        <div className='orders-filter-actions'>
          <button
            type='button'
            className='toolbar-filter-button orders-filter-apply'
            onClick={applyFilters}
          >
            Apply
          </button>
          <button
            type='button'
            className='toolbar-filter-button'
            onClick={resetFilters}
          >
            Clear
          </button>
        </div>
      </section>

      {isSaveFilterDrawerOpen ? (
        <div
          className='orders-filter-drawer-backdrop'
          onClick={() => setIsSaveFilterDrawerOpen(false)}
        >
          <aside
            className='orders-filter-drawer'
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h3>Save filter</h3>
              <button
                type='button'
                aria-label='Close save filter panel'
                onClick={() => setIsSaveFilterDrawerOpen(false)}
              >
                x
              </button>
            </header>
            <label className='orders-filter-field'>
              <span>Filter name</span>
              <input
                type='text'
                value={newFilterName}
                onChange={(event) =>
                  setNewFilterName(event.target.value)
                }
                placeholder='My filter'
              />
            </label>
            <div className='orders-filter-icons'>
              <span>Choose icon</span>
              <div className='orders-filter-icons-grid'>
                {filterIconOptions.map((icon, index) => (
                  <button
                    key={`${icon}-${index}`}
                    type='button'
                    className={
                      icon === newFilterIcon
                        ? 'orders-filter-icon-button orders-filter-icon-button-active'
                        : 'orders-filter-icon-button'
                    }
                    onClick={() => setNewFilterIcon(icon)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className='orders-filter-drawer-list'>
              <span>Your saved filters</span>
              {employeeSavedFilters.length > 0 ? (
                employeeSavedFilters.map((savedFilter) => (
                  <div
                    key={savedFilter.id}
                    className='orders-filter-drawer-item'
                  >
                    <button
                      type='button'
                      onClick={() => applySavedFilter(savedFilter)}
                    >
                      {`${savedFilter.icon} ${savedFilter.name}`}
                    </button>
                    <button
                      type='button'
                      className='orders-filter-delete-button'
                      onClick={() =>
                        removeSavedFilter(savedFilter.id)
                      }
                      aria-label={`Delete ${savedFilter.name}`}
                    >
                      🗑️
                    </button>
                  </div>
                ))
              ) : (
                <small>No filters yet.</small>
              )}
            </div>
            <footer>
              <button
                type='button'
                className='toolbar-filter-button orders-filter-apply'
                onClick={saveCurrentFilter}
                disabled={!canManageSavedFilters}
              >
                Save
              </button>
              <button
                type='button'
                className='toolbar-filter-button'
                onClick={() => setIsSaveFilterDrawerOpen(false)}
              >
                Cancel
              </button>
            </footer>
          </aside>
        </div>
      ) : null}

      <div className='orders-table-wrap'>
        <table
          className='orders-table'
          style={{ minWidth: tableMinWidth }}
        >
          <thead>
            <tr>
              {visibleColumnKeys.map((columnKey) => (
                <th
                  key={columnKey}
                  className={getOrdersColumnClassName(columnKey)}
                >
                  {getColumnLabel(columnKey, activeTab)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={visibleColumnKeys.length}
                  className='orders-empty'
                >
                  Loading orders...
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumnKeys.length}
                  className='orders-empty'
                >
                  {activeTab === 'orders'
                    ? 'Orders not found.'
                    : 'Sales not found.'}
                </td>
              </tr>
            ) : (
              paginatedOrders.map((sale) => (
                <tr key={sale.id}>
                  {visibleColumnKeys.map((columnKey) => (
                    <td
                      key={`${sale.id}-${columnKey}`}
                      className={getOrdersColumnClassName(columnKey)}
                    >
                      {renderOrdersCell(sale, columnKey)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <PaginationPanel
        totalItems={filteredOrders.length}
        page={currentPage}
        pageSize={currentPageSize}
        onPageChange={(page) =>
          setPageByTab((current) => ({
            ...current,
            [activeTab]: page,
          }))
        }
        onPageSizeChange={(pageSize) => {
          setPageSizeByTab((current) => ({
            ...current,
            [activeTab]: pageSize,
          }));
          setPageByTab((current) => ({ ...current, [activeTab]: 1 }));
        }}
      />
      {openStatusSale &&
      statusMenuPosition &&
      typeof document !== 'undefined'
        ? createPortal(
            <div
              className='order-status-options order-status-options-portal'
              style={{
                top: statusMenuPosition.top,
                left: statusMenuPosition.left,
              }}
            >
              {getStatusOptions(openStatusSale).map((statusOption) => (
                <button
                  key={statusOption.key}
                  type='button'
                  className={
                    statusOption.key === getStatus(openStatusSale)
                      ? 'order-status-option order-status-option-active'
                      : 'order-status-option'
                  }
                  onClick={() => {
                    void updateStatus(openStatusSale, statusOption.key);
                  }}
                >
                  {statusOption.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}

      {paymentSale ? (
        <PaymentModal
          sale={paymentSale}
          paymentTargetStatus={paymentTargetStatus}
          lineItems={getLineItems(paymentSale)}
          cashboxes={cashboxes}
          selectedCashboxId={selectedCashboxId}
          paymentMethod={paymentMethod}
          amount={paymentAmount}
          paidAmount={getPaidAmount(paymentSale)}
          isLoading={isPaymentModalLoading}
          isSaving={isPaymentSaving}
          onCashboxChange={setSelectedCashboxId}
          onPaymentMethodChange={setPaymentMethod}
          onAmountChange={setPaymentAmount}
          onClose={() => setPaymentSale(null)}
          onSubmit={acceptPayment}
        />
      ) : null}

      {refundSale ? (
        <RefundModal
          sale={refundSale}
          lineItems={getLineItems(refundSale)}
          cashboxes={cashboxes}
          selectedCashboxId={selectedRefundCashboxId}
          amount={refundAmount}
          paidAmount={getPaidAmount(refundSale)}
          isLoading={isRefundModalLoading}
          isSaving={isRefundSaving}
          onCashboxChange={setSelectedRefundCashboxId}
          onAmountChange={setRefundAmount}
          onClose={() => setRefundSale(null)}
          onSubmit={refundPayment}
        />
      ) : null}

      {returnSale && returnLineItem ? (
        <ReturnLineItemModal
          sale={returnSale}
          item={returnLineItem}
          warehouse={returnWarehouse}
          isLoading={isReturnModalLoading}
          isSaving={isReturnSaving}
          onWarehouseChange={setReturnWarehouse}
          onClose={() => {
            setReturnSale(null);
            setReturnLineItem(null);
          }}
          onSubmit={returnLineItemToStock}
        />
      ) : null}

      {fullReturnSale ? (
        <ReturnSaleModal
          sale={fullReturnSale}
          lineItems={getLineItems(fullReturnSale)}
          cashboxes={cashboxes}
          selectedCashboxId={selectedRefundCashboxId}
          amount={returnRefundAmount}
          warehouse={returnWarehouse}
          paidAmount={getPaidAmount(fullReturnSale)}
          isLoading={isFullReturnModalLoading}
          isSaving={isFullReturnSaving}
          onCashboxChange={setSelectedRefundCashboxId}
          onAmountChange={setReturnRefundAmount}
          onWarehouseChange={setReturnWarehouse}
          onClose={() => setFullReturnSale(null)}
          onSubmit={returnFullSaleToStock}
        />
      ) : null}

      {warningMessage ? (
        <MessageModal
          title='Payment warning'
          message={warningMessage}
          onClose={() => setWarningMessage(null)}
        />
      ) : null}
    </section>
  );
};

type OrderDetailCardProps = {
  sale: Sale;
  sales: Sale[];
  supplierOrders: SupplierOrder[];
  employees: Employee[];
  status: OrderStatus;
  statusOptions: Array<{ key: OrderStatus; label: string }>;
  comments: TimelineEntry[];
  lineItems: OrderLineItem[];
  paidAmount: number;
  isReadOnly: boolean;
  onClose: () => void;
  onAddComment: (comment: string) => void;
  onAddLineItem: (item: Omit<OrderLineItem, 'id'>) => void;
  onRemoveLineItem: (
    itemId: string,
    itemIndex?: number,
  ) => void;
  onUpdateLineItem: (
    itemId: string,
    itemIndex: number | undefined,
    patch: Partial<
      Pick<
        OrderLineItem,
        | 'name'
        | 'productId'
        | 'serviceId'
        | 'price'
        | 'quantity'
        | 'warrantyPeriod'
        | 'serialNumbers'
      >
    >,
  ) => void;
  onReturnLineItem: (item: OrderLineItem) => void;
  onOpenRelatedSale: (sale: Sale) => void;
  onAcceptPayment: () => void;
  onRefundPayment: () => void;
  onDiscountChange: (discount: {
    mode: 'percent' | 'amount';
    value: number;
  }) => void;
  onOpenClientCard: () => void;
  onSupplierOrderCreated: () => Promise<void>;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  onSaveMainInfo: (payload: {
    serialNumber: string;
    masterId: string;
    status: OrderStatus;
  }) => Promise<void>;
};

const OrderDetailCard = ({
  sale,
  sales,
  supplierOrders,
  employees,
  status,
  statusOptions,
  comments,
  lineItems,
  paidAmount,
  isReadOnly,
  onClose,
  onAddComment,
  onAddLineItem,
  onRemoveLineItem,
  onUpdateLineItem,
  onReturnLineItem,
  onOpenRelatedSale,
  onAcceptPayment,
  onRefundPayment,
  onDiscountChange,
  onOpenClientCard,
  onSupplierOrderCreated,
  onError,
  onSuccess,
  onSaveMainInfo,
}: OrderDetailCardProps) => {
  const isSaleCard = !isRepairOrder(sale);
  const [comment, setComment] = useState('');
  const [isProductsOpen, setIsProductsOpen] = useState(isSaleCard);
  const [isServicesOpen, setIsServicesOpen] = useState(
    isSaleCard ? false : true,
  );
  const [statusDraft, setStatusDraft] = useState<OrderStatus>(status);
  const [relatedTab, setRelatedTab] = useState<OrdersTab>('orders');
  const [serialNumberInput, setSerialNumberInput] = useState('');
  const [masterIdInput, setMasterIdInput] = useState('');
  const [isSavingMainInfo, setIsSavingMainInfo] = useState(false);
  const [relatedSupplierOrderSource, setRelatedSupplierOrderSource] =
    useState<SupplierOrder | null>(null);
  const [relatedSupplierOrderItemIndex, setRelatedSupplierOrderItemIndex] =
    useState<number | null>(null);
  const [isRelatedSupplierOrderModalOpen, setIsRelatedSupplierOrderModalOpen] =
    useState(false);
  const [relatedSuppliers, setRelatedSuppliers] = useState<Supplier[]>(
    [],
  );
  const [isRelatedSupplierOrderOpening, setIsRelatedSupplierOrderOpening] =
    useState(false);
  const [relatedWarehouseOptions, setRelatedWarehouseOptions] = useState<
    Array<{
      id: string;
      name: string;
      locations: Array<{ id: string; name: string }>;
    }>
  >([]);
  const total = getOrderBaseTotal(sale, lineItems);
  const discount = getDiscount(sale);
  const remainingPayment = getRemainingPayment(
    sale,
    paidAmount,
    lineItems,
  );
  const productItems = lineItems.filter(
    (item) => item.kind === 'product',
  );
  const serviceItems = lineItems.filter(
    (item) => item.kind === 'service',
  );
  useEffect(() => {
    setIsProductsOpen(isSaleCard);
    setIsServicesOpen(isSaleCard ? false : true);
  }, [sale.id, isSaleCard]);
  useEffect(() => {
    setStatusDraft(status);
  }, [status]);
  useEffect(() => {
    setSerialNumberInput(getPrimaryDeviceSerial(sale));
    setMasterIdInput(sale.master?.id ?? '');
  }, [sale]);
  const masterOptions = useMemo(
    () =>
      employees.filter(
        (employee) =>
          employee.isActive &&
          (employee.role === 'master' ||
            employee.role === 'owner' ||
            employee.permissions.includes('repairs.execute')),
      ),
    [employees],
  );
  const isMainInfoDirty =
    serialNumberInput.trim().toUpperCase() !== getPrimaryDeviceSerial(sale).trim().toUpperCase() ||
    masterIdInput !== (sale.master?.id ?? '') ||
    statusDraft !== status;
  const relatedRecords = useMemo(
    () =>
      sales
        .filter((item) => item.client.id === sale.client.id)
        .sort(
          (firstItem, secondItem) =>
            getCreatedTime(secondItem) - getCreatedTime(firstItem),
        ),
    [sale.client.id, sales],
  );
  const relatedVisibleRecords = relatedRecords.filter((item) =>
    relatedTab === 'orders'
      ? isRepairOrder(item)
      : !isRepairOrder(item),
  );
  const saleProductNames = useMemo(
    () =>
      new Set(
        lineItems
          .filter((item) => item.kind === 'product')
          .map((item) => item.name.trim().toLowerCase())
          .filter(Boolean),
      ),
    [lineItems],
  );
  const relatedSupplierOrders = useMemo(() => {
    const byExplicitSaleLink = supplierOrders.filter((order) => {
      const linkedSaleId = extractLinkedSaleIdFromSupplierOrder(order);
      return linkedSaleId === sale.id;
    });
    if (byExplicitSaleLink.length > 0) {
      return byExplicitSaleLink.sort(
        (firstItem, secondItem) =>
          new Date(secondItem.createdAt).getTime() -
          new Date(firstItem.createdAt).getTime(),
      );
    }

    return supplierOrders
      .filter((order) => {
        const linkedClientId = extractLinkedClientIdFromSupplierOrder(order);
        if (linkedClientId && linkedClientId !== sale.client.id) {
          return false;
        }
        return order.items.some((item) =>
          saleProductNames.has(item.productName.trim().toLowerCase()),
        );
      })
      .sort(
        (firstItem, secondItem) =>
          new Date(secondItem.createdAt).getTime() -
          new Date(firstItem.createdAt).getTime(),
      );
  }, [sale.id, sale.client.id, saleProductNames, supplierOrders]);
  const hasExplicitSaleSupplierLinks = useMemo(
    () =>
      relatedSupplierOrders.some(
        (order) => extractLinkedSaleIdFromSupplierOrder(order) === sale.id,
      ),
    [relatedSupplierOrders, sale.id],
  );
  const relatedSupplierOrderItems = useMemo(
    () =>
      relatedSupplierOrders.flatMap((order) =>
        order.items
          .filter((item) =>
            hasExplicitSaleSupplierLinks
              ? true
              : saleProductNames.has(item.productName.trim().toLowerCase()),
          )
          .map((item) => ({ order, item })),
      ),
    [
      hasExplicitSaleSupplierLinks,
      relatedSupplierOrders,
      saleProductNames,
    ],
  );
  const timelineItems = [
    {
      id: `${sale.id}-created`,
      author:
        sale.manager?.name ||
        sale.issuedBy?.name ||
        'Unknown employee',
      message: `created order with status "${getStatusLabel(sale, status)}"`,
      createdAt: sale.createdAt,
    },
    ...comments,
  ].sort(
    (firstItem, secondItem) =>
      new Date(secondItem.createdAt).getTime() -
      new Date(firstItem.createdAt).getTime(),
  );

  const submitComment = () => {
    onAddComment(comment);
    setComment('');
  };
  const selectedRelatedSupplierOrder =
    relatedSupplierOrderSource && relatedSupplierOrderItemIndex !== null
      ? {
          ...relatedSupplierOrderSource,
          items:
            relatedSupplierOrderSource.items.filter(
              (item) => item.itemIndex === relatedSupplierOrderItemIndex,
            ) ?? [],
        }
      : null;

  const openRelatedSupplierOrderTakeOnCharge = async (
    order: SupplierOrder,
    itemIndex: number,
  ) => {
    setIsRelatedSupplierOrderOpening(true);
    try {
      const [suppliersData, warehouseSettings] = await Promise.all([
        getSuppliers(''),
        getWarehouseSettings(),
      ]);
      setRelatedSuppliers(suppliersData);
      setRelatedWarehouseOptions(
        warehouseSettings.warehouses
          .filter((warehouse) => warehouse.isActive)
          .map((warehouse) => ({
            id: warehouse.id,
            name: warehouse.name,
            locations: warehouse.locations.map((location) => ({
              id: location.id,
              name: location.name,
            })),
          })),
      );
      setRelatedSupplierOrderSource(order);
      setRelatedSupplierOrderItemIndex(itemIndex);
      setIsRelatedSupplierOrderModalOpen(true);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to open supplier order modal.',
      );
    } finally {
      setIsRelatedSupplierOrderOpening(false);
    }
  };

  return (
    <article className='order-detail-card' aria-label='Order card'>
      <header className='order-detail-header'>
        <div>
          <span className='section-label'>Order card</span>
          <h2>{sale.recordNumber ?? 'r------'}</h2>
        </div>
        <div className='order-detail-actions'>
          <select
            value={statusDraft}
            onChange={(event) => {
              setStatusDraft(event.target.value as OrderStatus);
            }}
            aria-label='Repair status'
            disabled={isReadOnly}
          >
            {statusOptions.map((statusOption) => (
              <option key={statusOption.key} value={statusOption.key}>
                {statusOption.label}
              </option>
            ))}
          </select>
          <button
            type='button'
            className='create-order-close'
            onClick={onClose}
            aria-label='Close order card'
          >
            &times;
          </button>
        </div>
      </header>

      <div className='order-detail-grid'>
        <section className='order-detail-panel'>
          <h3>Main information</h3>
          <dl className='order-detail-list'>
            <div>
              <dt>Client</dt>
              <dd>
                <button
                  type='button'
                  className='orders-client-link'
                  onClick={onOpenClientCard}
                >
                  {sale.client.name}
                </button>
              </dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{formatPhoneNumber(sale.client.phone)}</dd>
            </div>
            {isSaleCard ? null : (
              <>
                <div>
                  <dt>Device</dt>
                  <dd>
                    <span className='order-device-name'>{getPrimaryDeviceName(sale) || '-'}</span>
                  </dd>
                </div>
                <div>
                  <dt>S/N</dt>
                  <dd>{serialNumberInput || '-'}</dd>
                </div>
              </>
            )}
            <div>
              <dt>Created</dt>
              <dd>{formatDateTime(sale.createdAt)}</dd>
            </div>
            <div>
              <dt>{isSaleCard ? 'Created order' : 'Manager'}</dt>
              <dd>{sale.manager?.name || '-'}</dd>
            </div>
            {isSaleCard ? null : (
              <div>
                <dt>Master</dt>
                <dd>
                  <select
                    className='order-detail-master-select'
                    value={masterIdInput}
                    onChange={(event) => setMasterIdInput(event.target.value)}
                  >
                    <option value=''>Select master</option>
                    {masterOptions.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>
            )}
            {isSaleCard ? (
              <div>
                <dt>Issued order</dt>
                <dd>{sale.issuedBy?.name || '-'}</dd>
              </div>
            ) : (
              <div>
                <dt>Issued</dt>
                <dd>{sale.issuedBy?.name || '-'}</dd>
              </div>
            )}
            {isSaleCard ? (
              <div className='order-detail-notes-row'>
                <dt>Notes</dt>
                <dd>{sale.note || 'No notes for this sale yet.'}</dd>
              </div>
            ) : null}
            {isMainInfoDirty ? (
              <div className='order-detail-notes-row'>
                <dt>&nbsp;</dt>
                <dd>
                  <button
                    type='button'
                    className='primary-button'
                    disabled={
                      isSavingMainInfo || isReadOnly
                    }
                    onClick={async () => {
                      setIsSavingMainInfo(true);
                      try {
                        await onSaveMainInfo({
                          serialNumber: serialNumberInput.trim().toUpperCase(),
                          masterId: masterIdInput,
                          status: statusDraft,
                        });
                      } finally {
                        setIsSavingMainInfo(false);
                      }
                    }}
                  >
                    {isSavingMainInfo ? 'Saving...' : 'Save changes'}
                  </button>
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className='order-detail-panel order-detail-live-panel'>
          <h3>Live feed</h3>
          <div className='order-timeline'>
            <div className='order-timeline-list'>
            {timelineItems.map((item, index) => (
              <div
                key={`${item.id}-${index}`}
                className='order-timeline-item'
              >
                <span>
                  {new Date(item.createdAt).toLocaleTimeString(
                    'uk-UA',
                    { hour: '2-digit', minute: '2-digit' },
                  )}
                </span>
                <p>
                  <strong>{item.author}</strong>
                  <small
                    className={
                      isSystemTimelineMessage(item.message)
                        ? 'order-timeline-message-system'
                        : 'order-timeline-message-manual'
                    }
                  >
                    {item.message}
                  </small>
                </p>
              </div>
            ))}
            </div>
            <div className='order-timeline-composer'>
            <textarea
              placeholder='Comment'
              rows={2}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              disabled={isReadOnly}
            />
            <button
              type='button'
              className='primary-button'
              onClick={submitComment}
              disabled={!comment.trim() || isReadOnly}
            >
              Add
            </button>
            </div>
          </div>
        </section>

        <section className='order-detail-panel order-detail-line-items-panel order-detail-products-panel'>
          <button
            type='button'
            className='order-detail-collapse-button'
            onClick={() => setIsProductsOpen((current) => !current)}
            aria-expanded={isProductsOpen}
          >
            <span>Products</span>
            <span className='order-detail-collapse-icon'>
              {isProductsOpen ? '⌃' : '⌄'}
            </span>
          </button>
          {isProductsOpen ? (
            <LineItemsPanel
              title='Products'
              kind='product'
              sales={sales}
              currentSaleId={sale.id}
              currentClientId={sale.client.id}
              currentStatus={status}
              items={productItems}
              onAddItem={onAddLineItem}
              onRemoveItem={onRemoveLineItem}
              onUpdateItem={onUpdateLineItem}
              onReturnItem={onReturnLineItem}
              isOrderPaid={paidAmount > 0}
              onError={onError}
              onSuccess={onSuccess}
              onSupplierOrderCreated={onSupplierOrderCreated}
              isReadOnly={isReadOnly}
            />
          ) : null}
        </section>

        <section className='order-detail-panel order-detail-line-items-panel'>
          <button
            type='button'
            className='order-detail-collapse-button'
            onClick={() => setIsServicesOpen((current) => !current)}
            aria-expanded={isServicesOpen}
          >
            <span>Services</span>
            <span className='order-detail-collapse-icon'>
              {isServicesOpen ? '⌃' : '⌄'}
            </span>
          </button>
          {isServicesOpen ? (
            <LineItemsPanel
              title='Services'
              kind='service'
              sales={sales}
              currentSaleId={sale.id}
              currentClientId={sale.client.id}
              currentStatus={status}
              items={serviceItems}
              onAddItem={onAddLineItem}
              onRemoveItem={onRemoveLineItem}
              onUpdateItem={onUpdateLineItem}
              onReturnItem={onReturnLineItem}
              isOrderPaid={paidAmount > 0}
              onError={onError}
              onSuccess={onSuccess}
              onSupplierOrderCreated={onSupplierOrderCreated}
              isReadOnly={isReadOnly}
            />
          ) : null}
        </section>

        <section className='order-detail-panel order-detail-payment-panel'>
          <h3>Payment</h3>
          <dl className='order-payment-list'>
            <div>
              <dt>Repair cost</dt>
              <dd>{formatCurrency(total)}</dd>
            </div>
            <div>
              <dt>
                <span className='payment-summary-discount-label'>
                  Discount
                  <span className='payment-summary-discount-badge'>
                    {discount.mode === 'percent' ? '%' : '₴'}
                  </span>
                </span>
              </dt>
              <dd>
                <div className='order-payment-discount-control'>
                  <input
                    type='number'
                    min={0}
                    step='0.01'
                    value={String(discount.value)}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      onDiscountChange({
                        mode: discount.mode,
                        value:
                          Number.isFinite(nextValue) && nextValue > 0
                            ? Math.round(nextValue * 100) / 100
                            : 0,
                      });
                    }}
                    disabled={isReadOnly}
                  />
                  <button
                    type='button'
                    className='order-payment-discount-mode'
                    onClick={() =>
                      onDiscountChange({
                        mode:
                          discount.mode === 'percent'
                            ? 'amount'
                            : 'percent',
                        value: discount.value,
                      })
                    }
                    aria-label='Toggle discount mode'
                    disabled={isReadOnly}
                  >
                    {discount.mode === 'percent' ? '%' : '₴'}
                  </button>
                </div>
              </dd>
            </div>
            <div>
              <dt>Paid</dt>
              <dd>{formatCurrency(paidAmount)}</dd>
            </div>
            <div>
              <dt>To pay</dt>
              <dd>{formatCurrency(remainingPayment)}</dd>
            </div>
          </dl>
          <button
            type='button'
            className='primary-button'
            onClick={onAcceptPayment}
            disabled={remainingPayment <= 0 || isReadOnly}
          >
            {remainingPayment <= 0 ? 'Paid' : 'Accept payment'}
          </button>
          {paidAmount > 0 ? (
            <button
              type='button'
              className='secondary-button'
              onClick={onRefundPayment}
              disabled={isReadOnly && status !== 'issued'}
            >
              Refund to client
            </button>
          ) : null}
        </section>

        {!isSaleCard ? (
          <section className='order-detail-panel order-detail-note'>
            <h3>Notes</h3>
            <p>{sale.note || 'No notes for this order yet.'}</p>
          </section>
        ) : null}

        <section className='order-detail-panel order-detail-related-panel'>
          <div className='order-related-tabs'>
            {orderTabs.map((tab) => (
              <button
                key={tab.key}
                type='button'
                className={
                  relatedTab === tab.key
                    ? 'order-related-tab order-related-tab-active'
                    : 'order-related-tab'
                }
                onClick={() => setRelatedTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className='order-related-list'>
            {relatedTab === 'supplierOrders' ? (
              relatedSupplierOrderItems.length === 0 ? (
                <p>No supplier orders linked to this sale.</p>
              ) : (
                relatedSupplierOrderItems.map(({ order, item }) => {
                  return (
                  <button
                    key={`${order.id}-${item.itemIndex}`}
                    className='order-related-item order-related-item-supplier'
                    type='button'
                    onClick={() =>
                      void openRelatedSupplierOrderTakeOnCharge(
                        order,
                        item.itemIndex,
                      )
                    }
                    disabled={isRelatedSupplierOrderOpening}
                  >
                    <span>{`${order.number || order.orderBaseId}-${item.itemIndex + 1}`}</span>
                    <strong>
                      {item.productName.trim() || '-'}
                    </strong>
                    <span>{formatCurrency(item.quantity * item.price)}</span>
                    <span>{formatReadyDate(order.createdAt)}</span>
                    <span className='order-related-supplier-status'>
                      {getSupplierOrderStatusLabel(order.status)}
                    </span>
                  </button>
                  );
                })
              )
            ) : relatedVisibleRecords.length === 0 ? (
              <p>
                {relatedTab === 'orders'
                  ? 'No orders for this client.'
                  : 'No sales for this client.'}
              </p>
            ) : (
              relatedVisibleRecords.map((record) => (
                <button
                  key={record.id}
                  className='order-related-item'
                  type='button'
                  onClick={() => onOpenRelatedSale(record)}
                >
                  <span>{buildOrderNumber(record)}</span>
                  <strong>{record.product.name}</strong>
                  <span>{formatCurrency(getOrderTotal(record))}</span>
                  <span>{formatReadyDate(record.createdAt)}</span>
                </button>
              ))
            )}
          </div>
        </section>
      </div>
      <SupplierOrderModal
        isOpen={isRelatedSupplierOrderModalOpen}
        suppliers={relatedSuppliers}
        editingOrder={selectedRelatedSupplierOrder}
        forceReadOnly={Boolean(
          selectedRelatedSupplierOrder &&
            (selectedRelatedSupplierOrder.status === 'stocked' ||
              selectedRelatedSupplierOrder.receiptStatus === 'received' ||
              selectedRelatedSupplierOrder.status === 'cancelled' ||
              selectedRelatedSupplierOrder.paymentStatus === 'cancelled'),
        )}
        warehouseOptions={relatedWarehouseOptions}
        onClose={() => {
          setIsRelatedSupplierOrderModalOpen(false);
          setRelatedSupplierOrderSource(null);
          setRelatedSupplierOrderItemIndex(null);
        }}
        onCreateSupplier={async (payload) => {
          try {
            const created = await createSupplier(payload);
            setRelatedSuppliers((current) => [created, ...current]);
            return true;
          } catch (error) {
            onError(
              error instanceof Error
                ? error.message
                : 'Failed to create supplier.',
            );
            return false;
          }
        }}
        onSuccess={onSuccess}
        onError={onError}
        onTakeOnCharge={async ({
          autoGenerateSerialNumbers,
          serialNumbers,
          autoGenerateArticles,
          articleBase,
          warehouseId,
          locationId,
        }) => {
          if (
            !relatedSupplierOrderSource ||
            relatedSupplierOrderItemIndex === null
          ) {
            return;
          }
          await takeOnChargeSupplierOrder(relatedSupplierOrderSource.id, {
            autoGenerateSerialNumbers,
            serialNumbers,
            autoGenerateArticles,
            articleBase: articleBase.trim().toUpperCase(),
            itemIndex: relatedSupplierOrderItemIndex,
            warehouseId,
            locationId,
          });
          onSuccess('Order taken on charge.');
          window.dispatchEvent(new Event('project-goods:finance-updated'));
          window.dispatchEvent(new Event('project-goods:products-updated'));
          await onSupplierOrderCreated();
          setIsRelatedSupplierOrderModalOpen(false);
          setRelatedSupplierOrderSource(null);
          setRelatedSupplierOrderItemIndex(null);
        }}
        onCancelOrder={async () => {
          if (
            !relatedSupplierOrderSource ||
            relatedSupplierOrderItemIndex === null
          ) {
            return;
          }
          try {
            if (relatedSupplierOrderSource.items.length <= 1) {
              await cancelSupplierOrder(relatedSupplierOrderSource.id);
              onSuccess('Order cancelled.');
            } else {
              const nextItems = relatedSupplierOrderSource.items
                .filter(
                  (item) =>
                    item.itemIndex !== relatedSupplierOrderItemIndex,
                )
                .map((item, index) => ({
                  ...item,
                  itemIndex: index,
                }));
              await updateSupplierOrder(relatedSupplierOrderSource.id, {
                orderBaseId: relatedSupplierOrderSource.orderBaseId,
                supplierId: relatedSupplierOrderSource.supplierId,
                deliveryDate:
                  relatedSupplierOrderSource.deliveryDate.slice(0, 10),
                supplyType: relatedSupplierOrderSource.supplyType,
                number: relatedSupplierOrderSource.number,
                note: withSupplierOrderLinkNote(
                  relatedSupplierOrderSource.note,
                  sale.id,
                  sale.client.id,
                ),
                createdBy: relatedSupplierOrderSource.createdBy,
                status: relatedSupplierOrderSource.status,
                paymentStatus:
                  relatedSupplierOrderSource.paymentStatus,
                items: nextItems,
              });
              onSuccess('Supplier order item removed.');
            }
            await onSupplierOrderCreated();
            setIsRelatedSupplierOrderModalOpen(false);
            setRelatedSupplierOrderSource(null);
            setRelatedSupplierOrderItemIndex(null);
          } catch (error) {
            onError(
              error instanceof Error
                ? error.message
                : 'Failed to remove supplier order.',
            );
          }
        }}
        onSubmit={async (payload) => {
          if (
            !relatedSupplierOrderSource ||
            relatedSupplierOrderItemIndex === null
          ) {
            return;
          }
          const mergedItems = mergeSupplierOrderItemUpdate({
            sourceOrder: relatedSupplierOrderSource,
            selectedItemIndex: relatedSupplierOrderItemIndex,
            updatedItem: payload.items[0],
          });
          await updateSupplierOrder(relatedSupplierOrderSource.id, {
            orderBaseId: relatedSupplierOrderSource.orderBaseId,
            supplierId: payload.supplierId,
            deliveryDate: payload.deliveryDate,
            supplyType: payload.supplyType,
            number: relatedSupplierOrderSource.number,
            note: withSupplierOrderLinkNote(
              payload.note,
              sale.id,
              sale.client.id,
            ),
            createdBy: relatedSupplierOrderSource.createdBy,
            status: relatedSupplierOrderSource.status,
            paymentStatus: relatedSupplierOrderSource.paymentStatus,
            items: mergedItems,
          });
          onSuccess('Supplier order updated.');
          await onSupplierOrderCreated();
        }}
      />
    </article>
  );
};

type LineItemsPanelProps = {
  title: string;
  kind: OrderLineItemKind;
  sales: Sale[];
  currentSaleId: string;
  currentClientId: string;
  currentStatus: OrderStatus;
  items: OrderLineItem[];
  onAddItem: (item: Omit<OrderLineItem, 'id'>) => void;
  onRemoveItem: (itemId: string, itemIndex?: number) => void;
  onUpdateItem: (
    itemId: string,
    itemIndex: number | undefined,
    patch: Partial<
      Pick<
        OrderLineItem,
        | 'name'
        | 'productId'
        | 'serviceId'
        | 'price'
        | 'quantity'
        | 'warrantyPeriod'
        | 'serialNumbers'
      >
    >,
  ) => void;
  onReturnItem: (item: OrderLineItem) => void;
  isOrderPaid: boolean;
  isReadOnly: boolean;
  onSupplierOrderCreated: () => Promise<void>;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

const LineItemsPanel = ({
  title,
  kind,
  sales,
  currentSaleId,
  currentClientId,
  currentStatus,
  items,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onReturnItem,
  isOrderPaid,
  isReadOnly,
  onSupplierOrderCreated,
  onError,
  onSuccess,
}: LineItemsPanelProps) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [warrantyPeriod, setWarrantyPeriod] = useState(
    kind === 'service' ? '1' : '0',
  );
  const [serviceSuggestions, setServiceSuggestions] = useState<
    ServiceCatalogItem[]
  >([]);
  const [productSuggestions, setProductSuggestions] = useState<
    Product[]
  >([]);
  const [selectedServiceId, setSelectedServiceId] = useState<
    string | undefined
  >();
  const [selectedProductId, setSelectedProductId] = useState<
    string | undefined
  >();
  const [isServiceLookupLoading, setIsServiceLookupLoading] =
    useState(false);
  const [isProductLookupLoading, setIsProductLookupLoading] =
    useState(false);
  const [selectedProduct, setSelectedProduct] =
    useState<Product | null>(null);
  const [selectedService, setSelectedService] =
    useState<ServiceCatalogItem | null>(null);
  const [productForm, setProductForm] =
    useState<ProductFormValues | null>(null);
  const [serviceForm, setServiceForm] = useState(
    initialServiceCatalogForm,
  );
  const [editingItemId, setEditingItemId] = useState<string | null>(
    null,
  );
  const [isCatalogSaving, setIsCatalogSaving] = useState(false);
  const [isCreateServiceOpen, setIsCreateServiceOpen] =
    useState(false);
  const [createServiceForm, setCreateServiceForm] = useState(
    initialServiceCatalogForm,
  );
  const [isCreateServiceSaving, setIsCreateServiceSaving] =
    useState(false);
  const [serialsEditingItem, setSerialsEditingItem] =
    useState<OrderLineItem | null>(null);
  const [serialsInput, setSerialsInput] = useState('');
  const [isSupplierOrderModalOpen, setIsSupplierOrderModalOpen] =
    useState(false);
  const [supplierOrderProductName, setSupplierOrderProductName] =
    useState('');
  const [supplierOrderInitialQuantity, setSupplierOrderInitialQuantity] =
    useState(1);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isSuppliersLoading, setIsSuppliersLoading] = useState(false);
  const [availableSerialProducts, setAvailableSerialProducts] =
    useState<Product[]>([]);
  const [isSerialLookupLoading, setIsSerialLookupLoading] =
    useState(false);
  const serviceLookupQuery = kind === 'service' ? name.trim() : '';
  const hasExactServiceSuggestion = serviceSuggestions.some(
    (service) =>
      service.name.trim().toLowerCase() ===
      serviceLookupQuery.toLowerCase(),
  );
  const canCreateMissingService =
    kind === 'service' &&
    serviceLookupQuery.length >= 2 &&
    !isServiceLookupLoading &&
    serviceSuggestions.length === 0 &&
    !hasExactServiceSuggestion;
  const selectedSerials = useMemo(
    () =>
      Array.from(
        new Set(
          serialsInput
            .split('\n')
            .map((value) => value.trim().toUpperCase())
            .filter(Boolean),
        ),
      ),
    [serialsInput],
  );
  const occupiedSerials = useMemo(() => {
    const occupied = new Set<string>();

    sales.forEach((candidateSale) => {
      (candidateSale.lineItems ?? []).forEach((lineItem) => {
        if (lineItem.kind !== 'product') return;

        const isCurrentEditingLine =
          serialsEditingItem &&
          candidateSale.id === currentSaleId &&
          lineItem.id === serialsEditingItem.id;
        if (isCurrentEditingLine) return;

        (lineItem.serialNumbers ?? [])
          .map((serial) => serial.trim().toUpperCase())
          .filter(Boolean)
          .forEach((serial) => occupied.add(serial));
      });
    });

    return occupied;
  }, [currentSaleId, sales, serialsEditingItem]);
  const canRemoveServiceItem = !isReadOnly && !isOrderPaid;
  const isIssuedSale = currentStatus === 'issued';
  const canDirectRemoveProductItem = (item: OrderLineItem) =>
    item.kind === 'product' &&
    !isReadOnly &&
    !isOrderPaid &&
    (item.serialNumbers ?? []).length === 0;
  const canReturnIssuedProductItem = (item: OrderLineItem) =>
    item.kind === 'product' &&
    isIssuedSale &&
    (item.serialNumbers ?? []).length > 0;
  const getProductActionBlockedReason = (item: OrderLineItem) => {
    if (canDirectRemoveProductItem(item)) return '';
    if (canReturnIssuedProductItem(item)) return '';
    if (
      isIssuedSale &&
      (item.serialNumbers ?? []).length === 0
    ) {
      return 'Bind sold serial number before stock return.';
    }
    if (isReadOnly) {
      return 'Use Return flow for issued sale.';
    }
    if (isOrderPaid) {
      return 'Refund is required before removing items.';
    }
    if ((item.serialNumbers ?? []).length > 0) {
      return 'Unbind serial numbers before removing this product.';
    }
    return 'Action is unavailable for this item.';
  };

  const openSupplierOrderModalForSerialItem = async () => {
    if (!serialsEditingItem) return;
    setIsSuppliersLoading(true);
    try {
      const supplierData = await getSuppliers('');
      setSuppliers(supplierData);
      setSupplierOrderProductName(serialsEditingItem.name.trim());
      setSupplierOrderInitialQuantity(
        Math.max(1, Math.floor(serialsEditingItem.quantity)),
      );
      setIsSupplierOrderModalOpen(true);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to load suppliers.',
      );
    } finally {
      setIsSuppliersLoading(false);
    }
  };

  const handleCreateSupplier = async (
    payload: SupplierFormValues,
  ) => {
    try {
      const created = await createSupplier(payload);
      setSuppliers((current) => [created, ...current]);
      return true;
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to create supplier.',
      );
      return false;
    }
  };

  const handleSubmitSupplierOrder = async (
    payload: SupplierOrderModalSubmitPayload,
  ) => {
    const createPayload: SupplierOrderFormValues = {
      supplierId: payload.supplierId,
      deliveryDate: payload.deliveryDate,
      supplyType: payload.supplyType,
      number: payload.number,
      note: withSupplierOrderLinkNote(
        payload.note,
        currentSaleId,
        currentClientId,
      ),
      createdBy: 'Administrator',
      orderBaseId: `SO-${Date.now()}`,
      status: 'request',
      paymentStatus: 'pending',
      items: payload.items,
    };
    await createSupplierOrder(createPayload);
    await onSupplierOrderCreated();
    onSuccess(
      'Supplier order created with status New and added to Supplier Order tab.',
    );
  };

  useEffect(() => {
    if (!serialsEditingItem) return;

    let isActive = true;
    const normalizeNameForMatch = (value: string) =>
      normalizeProductLookupValue(value)
        .replace(/\([^)]*\)/g, '')
        .replace(/[^a-z0-9\u0400-\u04ff\s-]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const isSameProductName = (left: string, right: string) => {
      const leftNormalized = normalizeNameForMatch(left);
      const rightNormalized = normalizeNameForMatch(right);
      if (!leftNormalized || !rightNormalized) return false;
      return (
        leftNormalized === rightNormalized ||
        leftNormalized.includes(rightNormalized) ||
        rightNormalized.includes(leftNormalized)
      );
    };
    const loadAvailableSerials = async () => {
      setIsSerialLookupLoading(true);
      try {
        const products = await getProducts(serialsEditingItem.name);
        if (!isActive) return;

        const normalizedLineName = serialsEditingItem.name;
        const lineProductId = serialsEditingItem.productId ?? '';
        let filtered = products.filter((product) => {
          if (!product.isActive) return false;
          if (!product.serialNumber?.trim()) return false;
          if (product.freeQuantity <= 0) return false;
          if (
            lineProductId &&
            product.id === lineProductId
          ) {
            return true;
          }

          return isSameProductName(product.name, normalizedLineName);
        });

        if (filtered.length === 0) {
          const allProducts = await getProducts('');
          if (!isActive) return;
          filtered = allProducts.filter((product) => {
            if (!product.isActive) return false;
            if (!product.serialNumber?.trim()) return false;
            if (product.freeQuantity <= 0) return false;
            if (
              lineProductId &&
              product.id === lineProductId
            ) {
              return true;
            }
            return isSameProductName(
              product.name,
              normalizedLineName,
            );
          });
        }

        const sorted = [...filtered]
          .filter((product) => {
            const serial = product.serialNumber.trim().toUpperCase();
            if (!serial) return false;
            return !occupiedSerials.has(serial);
          })
          .sort((first, second) => {
          const firstTime = new Date(
            first.purchaseDate ?? first.createdAt,
          ).getTime();
          const secondTime = new Date(
            second.purchaseDate ?? second.createdAt,
          ).getTime();
          return firstTime - secondTime;
        });
        setAvailableSerialProducts(sorted);
      } catch {
        if (isActive) setAvailableSerialProducts([]);
      } finally {
        if (isActive) setIsSerialLookupLoading(false);
      }
    };

    void loadAvailableSerials();

    return () => {
      isActive = false;
    };
  }, [occupiedSerials, serialsEditingItem]);

  useEffect(() => {
    setWarrantyPeriod(kind === 'service' ? '1' : '0');
  }, [kind]);

  useEffect(() => {
    if (
      kind !== 'product' ||
      name.trim().length < 2 ||
      Boolean(selectedProductId)
    ) {
      setProductSuggestions([]);
      return;
    }

    let isActive = true;
    const timeoutId = window.setTimeout(async () => {
      setIsProductLookupLoading(true);
      try {
        const products = await getProducts(name.trim());
        if (isActive) {
          const normalizedQuery = normalizeProductLookupValue(name);
          setProductSuggestions(
            products
              .filter((product) => {
                if (!product.isActive) return false;
                const lookupFields = [
                  product.name,
                  product.article,
                  product.serialNumber,
                ];
                return lookupFields.some((field) =>
                  normalizeProductLookupValue(field).includes(
                    normalizedQuery,
                  ),
                );
              })
              .slice(0, 8),
          );
        }
      } catch {
        if (isActive) setProductSuggestions([]);
      } finally {
        if (isActive) setIsProductLookupLoading(false);
      }
    }, 350);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [kind, name, selectedProductId]);

  useEffect(() => {
    if (
      kind !== 'service' ||
      serviceLookupQuery.length < 2 ||
      Boolean(selectedServiceId)
    ) {
      setServiceSuggestions([]);
      return;
    }

    let isActive = true;
    const timeoutId = window.setTimeout(async () => {
      setIsServiceLookupLoading(true);
      try {
        const services = await getServiceCatalogItems(
          serviceLookupQuery,
        );
        if (isActive) setServiceSuggestions(services.slice(0, 6));
      } catch {
        if (isActive) setServiceSuggestions([]);
      } finally {
        if (isActive) setIsServiceLookupLoading(false);
      }
    }, 350);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [kind, selectedServiceId, serviceLookupQuery]);

  const applyServiceSuggestion = (service: ServiceCatalogItem) => {
    setName(service.name);
    setPrice(String(service.price));
    setQuantity('1');
    setWarrantyPeriod('1');
    setSelectedServiceId(service.id);
    setServiceSuggestions([]);
  };

  const applyProductSuggestion = (product: Product) => {
    const suggestedPrice =
      product.salePriceOptions[0] ?? product.price ?? 0;
    setName(product.name);
    setPrice(String(suggestedPrice));
    setQuantity('1');
    setWarrantyPeriod('0');
    setSelectedProductId(product.id);
    setProductSuggestions([]);
  };

  const openCreateServiceModal = () => {
    setCreateServiceForm({
      ...initialServiceCatalogForm,
      name: serviceLookupQuery,
      price,
    });
    setIsCreateServiceOpen(true);
  };

  const saveCreatedService = async () => {
    setIsCreateServiceSaving(true);
    try {
      const createdService =
        await createServiceCatalogItem(createServiceForm);
      setName(createdService.name);
      setPrice(String(createdService.price));
      setQuantity('1');
      setWarrantyPeriod('1');
      setSelectedServiceId(createdService.id);
      setServiceSuggestions([createdService]);
      setIsCreateServiceOpen(false);
      onSuccess('Service saved to catalog.');
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to save service.',
      );
    } finally {
      setIsCreateServiceSaving(false);
    }
  };

  const openLineItemModal = async (item: OrderLineItem) => {
    setEditingItemId(item.id);
    try {
      if (item.kind === 'product') {
        const products = await getProducts(item.name);
        const product =
          products.find(
            (candidate) => candidate.id === item.productId,
          ) ??
          products.find(
            (candidate) => candidate.name === item.name,
          ) ??
          null;
        if (!product) {
          onError('Product was not found in catalog.');
          return;
        }
        setSelectedProduct(product);
        setProductForm(toProductForm(product));
        return;
      }

      const services = await getServiceCatalogItems(item.name);
      const service =
        services.find(
          (candidate) => candidate.id === item.serviceId,
        ) ??
        services.find((candidate) => candidate.name === item.name) ??
        null;
      if (!service) {
        onError('Service was not found in catalog.');
        return;
      }
      setSelectedService(service);
      setServiceForm(toServiceCatalogForm(service));
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to load catalog item.',
      );
    }
  };

  const saveSelectedProduct = async () => {
    if (!selectedProduct || !productForm || !editingItemId) return;

    setIsCatalogSaving(true);
    try {
      const updatedProduct = await updateProduct(
        selectedProduct.id,
        productForm,
      );
      setSelectedProduct(updatedProduct);
      setProductForm(toProductForm(updatedProduct));
      onUpdateItem(editingItemId, undefined, {
        name: updatedProduct.name,
        productId: updatedProduct.id,
        price:
          updatedProduct.salePriceOptions[0] ?? updatedProduct.price,
        warrantyPeriod: 0,
      });
      onSuccess('Product updated.');
      setSelectedProduct(null);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to update product.',
      );
    } finally {
      setIsCatalogSaving(false);
    }
  };

  const saveSelectedService = async () => {
    if (!selectedService || !editingItemId) return;

    setIsCatalogSaving(true);
    try {
      const updatedService = await updateServiceCatalogItem(
        selectedService.id,
        serviceForm,
      );
      setSelectedService(updatedService);
      setServiceForm(toServiceCatalogForm(updatedService));
      onUpdateItem(editingItemId, undefined, {
        name: updatedService.name,
        serviceId: updatedService.id,
        price: updatedService.price,
        warrantyPeriod: 1,
      });
      onSuccess('Service updated.');
      setSelectedService(null);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to update service.',
      );
    } finally {
      setIsCatalogSaving(false);
    }
  };

  const submitItem = async () => {
    const normalizedName = name.trim();
    const normalizedPrice = Number(price);
    const normalizedQuantity = Number(quantity);

    if (
      !normalizedName ||
      !Number.isFinite(normalizedPrice) ||
      normalizedPrice < 0 ||
      !Number.isFinite(normalizedQuantity) ||
      normalizedQuantity <= 0
    ) {
      return;
    }

    let nextServiceId =
      kind === 'service'
        ? (selectedServiceId ??
          serviceSuggestions.find(
            (service) => service.name === normalizedName,
          )?.id)
        : undefined;

    if (
      shouldCreateMissingServiceOnSubmit({
        kind,
        normalizedName,
        selectedServiceId: nextServiceId,
        suggestionNames: serviceSuggestions.map(
          (service) => service.name,
        ),
      })
    ) {
      try {
        const createdService = await createServiceCatalogItem(
          buildMissingServicePayload(normalizedName, normalizedPrice),
        );
        nextServiceId = createdService.id;
        setServiceSuggestions([createdService]);
        onSuccess('Service saved to catalog.');
      } catch (error) {
        onError(
          error instanceof Error
            ? error.message
            : 'Failed to save service.',
        );
        return;
      }
    }

    onAddItem({
      kind,
      productId:
        kind === 'product'
          ? (selectedProductId ??
            productSuggestions.find(
              (product) => product.name === normalizedName,
            )?.id)
          : undefined,
      serviceId:
        kind === 'service'
          ? nextServiceId
          : undefined,
      name: normalizedName,
      price: normalizedPrice,
      quantity: normalizedQuantity,
      warrantyPeriod: Number(warrantyPeriod),
    });
    setName('');
    setPrice('');
    setQuantity('1');
    setWarrantyPeriod(kind === 'service' ? '1' : '0');
    setSelectedServiceId(undefined);
    setSelectedProductId(undefined);
    setServiceSuggestions([]);
    setProductSuggestions([]);
  };

  return (
    <div className='order-line-items'>
      <div className='order-detail-table order-detail-table-wide'>
        <div>Name</div>
        <div>Price</div>
        <div>Qty</div>
        <div>Warranty</div>
        <div>Action</div>
        {items.length === 0 ? (
          <div className='order-line-items-empty'>{`No ${title.toLowerCase()} added.`}</div>
        ) : (
          items.map((item, itemIndex) => (
            <div
              key={`${item.id || 'line-item'}-${itemIndex}`}
              className='order-detail-table-row'
            >
              <div key={`${item.id}-name`}>
                <button
                  type='button'
                  className='order-line-item-name-button'
                  onClick={() => void openLineItemModal(item)}
                  disabled={isReadOnly}
                >
                  {item.name}
                </button>
                {item.kind === 'product' &&
                (item.serialNumbers ?? []).length > 0 ? (
                  <p className='muted-copy'>
                    {`S/N: ${(item.serialNumbers ?? []).join(', ')}`}
                  </p>
                ) : null}
              </div>
              <div key={`${item.id}-price`}>
                <NumberStepper
                  className='line-item-inline-input'
                  min={0}
                  value={String(item.price)}
                  onChange={(value) =>
                    onUpdateItem(item.id, itemIndex, {
                      price: Number(value),
                    })
                  }
                  disabled={isReadOnly}
                />
              </div>
              <div key={`${item.id}-qty`}>
                <NumberStepper
                  className='line-item-inline-input'
                  min={1}
                  value={String(item.quantity)}
                  onChange={(value) =>
                    onUpdateItem(item.id, itemIndex, {
                      quantity: Math.max(1, Number(value) || 1),
                    })
                  }
                  disabled={isReadOnly}
                />
              </div>
              <div key={`${item.id}-warranty`}>
                <select
                  className='line-item-inline-input'
                  value={item.warrantyPeriod}
                  onChange={(event) =>
                    onUpdateItem(item.id, itemIndex, {
                      warrantyPeriod: Number(event.target.value),
                    })
                  }
                  disabled={isReadOnly}
                >
                  {warrantyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div key={`${item.id}-action`}>
                {(() => {
                  const isProduct = item.kind === 'product';
                  const canDirectRemove = canDirectRemoveProductItem(item);
                  const canReturnIssued = canReturnIssuedProductItem(item);
                  const actionDisabled = isProduct
                    ? !canDirectRemove && !canReturnIssued
                    : !canRemoveServiceItem;
                  const actionLabel = isProduct
                    ? canReturnIssued
                      ? 'Return'
                      : 'Remove'
                    : 'Remove';
                  const actionBlockedReason =
                    isProduct && actionDisabled
                      ? getProductActionBlockedReason(item)
                      : !isProduct && actionDisabled
                        ? isReadOnly
                          ? 'Editing is blocked for current order status.'
                          : 'Refund is required before removing items.'
                        : '';
                  return (
                    <>
                {item.kind === 'product' ? (
                  <button
                    type='button'
                    className='line-item-serials-button'
                    onClick={() => {
                      setSerialsEditingItem(item);
                      setSerialsInput(
                        (item.serialNumbers ?? []).join('\n'),
                      );
                    }}
                    disabled={isReadOnly}
                  >
                    <span>{'Serials '}</span>
                    <span className='line-item-serials-count'>
                      {`${(item.serialNumbers ?? []).length}/${item.quantity}`}
                    </span>
                  </button>
                ) : null}
                <button
                  type='button'
                  className='line-item-remove-button'
                  onClick={() =>
                    isProduct
                      ? canDirectRemove
                        ? onRemoveItem(item.id, itemIndex)
                        : onReturnItem(item)
                      : onRemoveItem(item.id, itemIndex)
                  }
                  disabled={actionDisabled}
                  title={actionBlockedReason || undefined}
                >
                  {actionLabel}
                </button>
                    </>
                  );
                })()}
              </div>
            </div>
          ))
        )}
      </div>
      <div className='order-line-items-form'>
        <div
          className={
            kind === 'product'
              ? 'order-line-items-entry-row order-line-items-entry-row-product'
              : 'order-line-items-entry-row'
          }
        >
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSelectedServiceId(undefined);
              setSelectedProductId(undefined);
            }}
            placeholder={`Add ${kind}`}
            disabled={isReadOnly}
          />
          <NumberStepper
            min={0}
            value={price}
            onChange={setPrice}
            placeholder='Price'
            disabled={isReadOnly}
          />
          <NumberStepper
            min={1}
            value={quantity}
            onChange={setQuantity}
            placeholder='Qty'
            disabled={isReadOnly}
          />
          <select
            value={warrantyPeriod}
            onChange={(event) => setWarrantyPeriod(event.target.value)}
            disabled={isReadOnly}
          >
            {warrantyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type='button'
            className='primary-button'
            onClick={() => void submitItem()}
            disabled={isReadOnly}
          >
            Add {kind}
          </button>
        </div>
        {kind === 'product' &&
        (productSuggestions.length > 0 || isProductLookupLoading) ? (
          <div className='create-suggestions line-item-suggestions'>
            {isProductLookupLoading ? (
              <p>Searching products...</p>
            ) : null}
            {productSuggestions.map((product) => (
              <button
                key={product.id}
                type='button'
                className='create-suggestion-item'
                onClick={() => applyProductSuggestion(product)}
                disabled={isReadOnly}
              >
                <strong>{product.name}</strong>
                <span>{`${formatCurrency(product.salePriceOptions[0] ?? product.price ?? 0)} / ${product.article} / ${product.serialNumber}`}</span>
              </button>
            ))}
          </div>
        ) : null}
        {kind === 'service' &&
        (serviceSuggestions.length > 0 || isServiceLookupLoading) ? (
          <div className='create-suggestions line-item-suggestions'>
            {isServiceLookupLoading ? (
              <p>Searching services...</p>
            ) : null}
            {serviceSuggestions.map((service) => (
              <button
                key={service.id}
                type='button'
                className='create-suggestion-item'
                onClick={() => applyServiceSuggestion(service)}
                disabled={isReadOnly}
              >
                <strong>{service.name}</strong>
                <span>{`${formatCurrency(service.price)}${service.note ? ` / ${service.note}` : ''}`}</span>
              </button>
            ))}
          </div>
        ) : null}
        {canCreateMissingService ? (
          <button
            type='button'
            className='secondary-button line-item-create-service-button'
            onClick={openCreateServiceModal}
            disabled={isReadOnly}
          >
            Add service
          </button>
        ) : null}
      </div>
      {isCreateServiceOpen ? (
        <CatalogServiceEditorModal
          title='Create service'
          form={createServiceForm}
          isSaving={isCreateServiceSaving}
          isEditing
          onChange={(field, value) =>
            setCreateServiceForm((current) => ({
              ...current,
              [field]: value,
            }))
          }
          onSubmit={() => void saveCreatedService()}
          onClose={() => setIsCreateServiceOpen(false)}
        />
      ) : null}
      {selectedProduct && productForm ? (
        <CatalogProductEditorModal
          product={selectedProduct}
          form={productForm}
          isSaving={isCatalogSaving}
          onChange={(field, value) =>
            setProductForm((current) =>
              current ? { ...current, [field]: value } : current,
            )
          }
          onSubmit={() => void saveSelectedProduct()}
          onClose={() => setSelectedProduct(null)}
        />
      ) : null}
      {selectedService ? (
        <CatalogServiceEditorModal
          title={selectedService.name}
          service={selectedService}
          form={serviceForm}
          isSaving={isCatalogSaving}
          isEditing
          onChange={(field, value) =>
            setServiceForm((current) => ({
              ...current,
              [field]: value,
            }))
          }
          onSubmit={() => void saveSelectedService()}
          onClose={() => setSelectedService(null)}
        />
      ) : null}
      {serialsEditingItem ? (
        <div
          className='modal-backdrop'
          role='presentation'
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSerialsEditingItem(null);
            }
          }}
        >
          <section className='payment-modal payment-modal-message serial-bind-modal'>
            <div className='serial-bind-modal-scroll'>
              <h3>Bind serial numbers</h3>
              <p>{`One serial per line, max ${serialsEditingItem.quantity}.`}</p>
              <div className='modal-actions'>
              <button
                type='button'
                className='secondary-button'
                onClick={() => {
                  const oldestSerials = availableSerialProducts
                    .map((product) =>
                      product.serialNumber.trim().toUpperCase(),
                    )
                    .filter(Boolean)
                    .slice(0, serialsEditingItem.quantity);
                  setSerialsInput(oldestSerials.join('\n'));
                }}
                disabled={
                  isSerialLookupLoading ||
                  availableSerialProducts.length === 0
                }
              >
                Auto-select oldest
              </button>
              </div>
              <div className='create-suggestions line-item-suggestions'>
              {isSerialLookupLoading ? (
                <p>Loading available serials...</p>
              ) : null}
              {!isSerialLookupLoading &&
              availableSerialProducts.length === 0 ? (
                <p>No available serials found in stock.</p>
              ) : null}
              {availableSerialProducts.map((product) => {
                const serial = product.serialNumber
                  .trim()
                  .toUpperCase();
                const isSelected = selectedSerials.includes(serial);
                return (
                  <button
                    key={product.id}
                    type='button'
                    className='create-suggestion-item'
                    onClick={() => {
                      const nextSet = new Set(selectedSerials);
                      if (nextSet.has(serial)) {
                        nextSet.delete(serial);
                      } else if (
                        nextSet.size < serialsEditingItem.quantity
                      ) {
                        nextSet.add(serial);
                      } else {
                        onError(
                          'Serial count cannot exceed line quantity.',
                        );
                        return;
                      }
                      setSerialsInput(Array.from(nextSet).join('\n'));
                    }}
                  >
                    <strong>
                      {isSelected ? '[x] ' : '[ ] '}
                      {serial}
                    </strong>
                    <span>
                      {`Date: ${formatDateTime(
                        product.purchaseDate ?? product.createdAt,
                      )}`}
                    </span>
                  </button>
                );
              })}
              </div>
              {selectedSerials.length > 0 ? (
                <div className='modal-actions'>
                  <span>{`Selected: ${selectedSerials.length}`}</span>
                  <button
                    type='button'
                    className='secondary-button'
                    onClick={() => setSerialsInput('')}
                  >
                    Clear selected
                  </button>
                </div>
              ) : null}
              {selectedSerials.length > 0 ? (
                <div className='create-suggestions line-item-suggestions'>
                  {selectedSerials.map((serial) => (
                    <div
                      key={`selected-${serial}`}
                      className='create-suggestion-item'
                    >
                      <strong>{serial}</strong>
                      <button
                        type='button'
                        className='line-item-remove-button'
                        onClick={() =>
                          setSerialsInput(
                            selectedSerials
                              .filter((candidate) => candidate !== serial)
                              .join('\n'),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <textarea
                rows={8}
                value={serialsInput}
                onChange={(event) => setSerialsInput(event.target.value)}
                placeholder={'SN-001\nSN-002'}
              />
            </div>
            <div className='modal-actions serial-bind-modal-footer'>
              <button
                type='button'
                className='primary-button'
                onClick={() => void openSupplierOrderModalForSerialItem()}
                disabled={isSuppliersLoading}
              >
                {isSuppliersLoading ? 'Loading...' : 'Order'}
              </button>
              <button
                type='button'
                className='secondary-button'
                onClick={() => setSerialsEditingItem(null)}
              >
                Cancel
              </button>
              <button
                type='button'
                className='primary-button'
                onClick={() => {
                  const serials = serialsInput
                    .split('\n')
                    .map((value) => value.trim().toUpperCase())
                    .filter(Boolean);
                  const uniqueSerials = Array.from(new Set(serials));
                  if (
                    uniqueSerials.length >
                    serialsEditingItem.quantity
                  ) {
                    onError(
                      'Serial count cannot exceed line quantity.',
                    );
                    return;
                  }
                  const itemIndex = items.findIndex(
                    (candidate) => candidate.id === serialsEditingItem.id,
                  );
                  onUpdateItem(
                    serialsEditingItem.id,
                    itemIndex >= 0 ? itemIndex : undefined,
                    { serialNumbers: uniqueSerials },
                  );
                  onSuccess('Serial numbers updated.');
                  setSerialsEditingItem(null);
                }}
              >
                Save
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <SupplierOrderModal
        isOpen={isSupplierOrderModalOpen}
        suppliers={suppliers}
        initialProductName={supplierOrderProductName}
        initialQuantity={supplierOrderInitialQuantity}
        onClose={() => setIsSupplierOrderModalOpen(false)}
        onCreateSupplier={handleCreateSupplier}
        onSubmit={handleSubmitSupplierOrder}
        onSuccess={onSuccess}
        onError={onError}
      />
    </div>
  );
};

const getProductPriceOption = (
  form: ProductFormValues,
  index: number,
) =>
  form.salePriceOptions
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)[index] ?? '';

const setProductPriceOption = (
  form: ProductFormValues,
  index: number,
  value: string,
) => {
  const values = form.salePriceOptions
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  values[index] = value;
  return values.join(', ');
};

type CatalogProductEditorModalProps = {
  product: Product;
  form: ProductFormValues;
  isSaving: boolean;
  onChange: <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ) => void;
  onSubmit: () => void;
  onClose: () => void;
};

const CatalogProductEditorModal = ({
  product,
  form,
  isSaving,
  onChange,
  onSubmit,
  onClose,
}: CatalogProductEditorModalProps) => {
  useLockBodyScroll();

  return (
    <div
      className='modal-backdrop'
      role='presentation'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className='catalog-edit-modal'
        role='dialog'
        aria-modal='true'
      >
        <header className='catalog-edit-header'>
          <div className='catalog-edit-title'>
            <span>Product</span>
            <h2>{product.name}</h2>
          </div>
          <button
            type='button'
            className='create-order-close'
            onClick={onClose}
            aria-label='Close'
          >
            &times;
          </button>
        </header>
        <div className='catalog-edit-body'>
          <h3>Main information</h3>
          <label className='field'>
            <span>Name</span>
            <input
              value={form.name}
              onChange={(event) =>
                onChange('name', event.target.value)
              }
            />
          </label>
          <label className='field'>
            <span>Article</span>
            <input
              value={form.article}
              onChange={(event) =>
                onChange('article', event.target.value)
              }
            />
          </label>
          <label className='field'>
            <span>Serial number</span>
            <input
              value={form.serialNumber}
              onChange={(event) =>
                onChange('serialNumber', event.target.value)
              }
            />
          </label>
          <fieldset className='catalog-type-field'>
            <legend>Item type</legend>
            <label>
              <input type='radio' checked readOnly /> Product
            </label>
            <label>
              <input type='radio' disabled /> Service
            </label>
          </fieldset>
          <div className='catalog-price-grid'>
            <label className='field'>
              <span>Retail price</span>
              <NumberStepper
                min={0}
                value={getProductPriceOption(form, 0) || form.price}
                onChange={(value) =>
                  onChange(
                    'salePriceOptions',
                    setProductPriceOption(form, 0, value),
                  )
                }
              />
            </label>
            <label className='field'>
              <span>Purchase price</span>
              <NumberStepper
                min={0}
                value={form.price}
                onChange={(value) => onChange('price', value)}
              />
            </label>
            <label className='field'>
              <span>Quantity</span>
              <NumberStepper
                min={0}
                value={form.quantity}
                onChange={(value) => onChange('quantity', value)}
              />
            </label>
            <label className='field'>
              <span>Warehouse</span>
              <input
                value={form.purchasePlace}
                onChange={(event) =>
                  onChange('purchasePlace', event.target.value)
                }
              />
            </label>
            <label className='field'>
              <span>Warranty</span>
              <input
                value={form.warrantyPeriod}
                onChange={(event) =>
                  onChange('warrantyPeriod', event.target.value)
                }
              />
            </label>
          </div>
          <label className='field field-wide'>
            <span>Note</span>
            <textarea
              rows={3}
              value={form.note}
              onChange={(event) =>
                onChange('note', event.target.value)
              }
            />
          </label>
        </div>
        <footer className='catalog-edit-footer'>
          <button
            type='button'
            className='secondary-button'
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type='button'
            className='primary-button'
            onClick={onSubmit}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </footer>
      </section>
    </div>
  );
};

type CatalogServiceEditorModalProps = {
  title: string;
  service?: ServiceCatalogItem;
  form: typeof initialServiceCatalogForm;
  isSaving: boolean;
  isEditing: boolean;
  onChange: <K extends keyof typeof initialServiceCatalogForm>(
    field: K,
    value: (typeof initialServiceCatalogForm)[K],
  ) => void;
  onSubmit: () => void;
  onClose: () => void;
};

const CatalogServiceEditorModal = ({
  title,
  service,
  form,
  isSaving,
  isEditing,
  onChange,
  onSubmit,
  onClose,
}: CatalogServiceEditorModalProps) => {
  useLockBodyScroll();

  return (
    <div
      className='modal-backdrop'
      role='presentation'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className='catalog-edit-modal'
        role='dialog'
        aria-modal='true'
      >
        <header className='catalog-edit-header'>
          <div className='catalog-edit-title'>
            <span>{service ? 'Service' : 'New service'}</span>
            <h2>{title}</h2>
          </div>
          <button
            type='button'
            className='create-order-close'
            onClick={onClose}
            aria-label='Close'
          >
            &times;
          </button>
        </header>
        <div className='catalog-edit-body'>
          <h3>Main information</h3>
          <label className='field'>
            <span>Name</span>
            <input
              value={form.name}
              onChange={(event) =>
                onChange('name', event.target.value)
              }
            />
          </label>
          <fieldset className='catalog-type-field'>
            <legend>Item type</legend>
            <label>
              <input type='radio' disabled /> Product
            </label>
            <label>
              <input type='radio' checked readOnly /> Service
            </label>
          </fieldset>
          <label className='field'>
            <span>Retail price</span>
            <NumberStepper
              min={0}
              value={form.price}
              onChange={(value) => onChange('price', value)}
            />
          </label>
          <label className='field field-wide'>
            <span>Note</span>
            <textarea
              rows={3}
              value={form.note}
              onChange={(event) =>
                onChange('note', event.target.value)
              }
            />
          </label>
        </div>
        <footer className='catalog-edit-footer'>
          <button
            type='button'
            className='secondary-button'
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type='button'
            className='primary-button'
            onClick={onSubmit}
            disabled={isSaving || !isEditing}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </footer>
      </section>
    </div>
  );
};

const useLockBodyScroll = () => {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
};

type PaymentModalProps = {
  sale: Sale;
  paymentTargetStatus: PaymentTargetStatus;
  lineItems: OrderLineItem[];
  cashboxes: Cashbox[];
  selectedCashboxId: string;
  paymentMethod: PaymentMethod;
  amount: string;
  paidAmount: number;
  isLoading: boolean;
  isSaving: boolean;
  onCashboxChange: (cashboxId: string) => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onAmountChange: (amount: string) => void;
  onClose: () => void;
  onSubmit: (action: PaymentAction) => void;
};

const PaymentModal = ({
  sale,
  paymentTargetStatus,
  lineItems,
  cashboxes,
  selectedCashboxId,
  paymentMethod,
  amount,
  paidAmount,
  isLoading,
  isSaving,
  onCashboxChange,
  onPaymentMethodChange,
  onAmountChange,
  onClose,
  onSubmit,
}: PaymentModalProps) => {
  const total = getOrderBaseTotal(sale, lineItems);
  const discount = getDiscount(sale);
  const numericAmount = Number(amount);
  const currentPaymentRemaining = getRemainingPayment(
    sale,
    paidAmount,
    lineItems,
  );
  const nextPaymentRemaining = Math.max(
    currentPaymentRemaining -
      (Number.isFinite(numericAmount) ? numericAmount : 0),
    0,
  );
  const orderNumber = sale.recordNumber ?? 'r------';
  const submitWithStatusLabel =
    paymentTargetStatus === 'paid'
      ? 'Accept and mark paid'
      : 'Accept and issue';
  const submitWithoutPaymentLabel =
    paymentTargetStatus === 'paid'
      ? 'Mark paid without payment'
      : 'Issue without payment';
  const [isPrintMenuOpen, setIsPrintMenuOpen] = useState(false);
  const [selectedFormIds, setSelectedFormIds] = useState<string[]>(
    [],
  );
  const printMenuRef = useRef<HTMLDivElement | null>(null);
  const printForms = readPrintForms();
  const isSubmitDisabled =
    isLoading ||
    isSaving ||
    !selectedCashboxId ||
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0 ||
    numericAmount > currentPaymentRemaining;
  const isIssueWithoutPaymentBlocked =
    paymentTargetStatus === 'issued' && currentPaymentRemaining > 0;
  const isIssueDisabled =
    isLoading || isSaving || isIssueWithoutPaymentBlocked;

  useEffect(() => {
    if (!isPrintMenuOpen) return;

    const closePrintMenuOnOutsideClick = (event: MouseEvent) => {
      if (!printMenuRef.current?.contains(event.target as Node)) {
        setIsPrintMenuOpen(false);
      }
    };

    document.addEventListener(
      'mousedown',
      closePrintMenuOnOutsideClick,
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        closePrintMenuOnOutsideClick,
      );
    };
  }, [isPrintMenuOpen]);

  const togglePrintForm = (formId: string) => {
    setSelectedFormIds((current) =>
      current.includes(formId)
        ? current.filter((id) => id !== formId)
        : [...current, formId],
    );
  };

  const printSelectedForms = () => {
    const formsToPrint = printForms.filter((form) =>
      selectedFormIds.includes(form.id),
    );
    if (formsToPrint.length === 0) return;

    const printWindow = window.open(
      '',
      '_blank',
      'width=900,height=700',
    );
    if (!printWindow) return;

    const body = formsToPrint
      .map(
        (form) => `
          <section class="print-form">
            <h1>${escapeHtml(form.title)}</h1>
            <pre>${escapeHtml(renderPrintTemplate(form.content, sale, paidAmount, orderNumber))}</pre>
          </section>
        `,
      )
      .join('');

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Print forms ${orderNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
            .print-form { page-break-after: always; border: 1px solid #d1d5db; padding: 24px; margin-bottom: 24px; }
            h1 { margin-top: 0; }
            pre { white-space: pre-wrap; font: inherit; line-height: 1.5; }
          </style>
        </head>
        <body>${body}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className='modal-backdrop' role='presentation'>
      <section
        className='payment-modal'
        role='dialog'
        aria-modal='true'
        aria-label='Accept payment'
      >
        <button
          type='button'
          className='payment-modal-close'
          onClick={onClose}
          aria-label='Close payment modal'
        >
          &times;
        </button>

        <div className='payment-modal-summary'>
          <dl>
            <div>
              <dt>Repair cost</dt>
              <dd>{formatCurrency(total)}</dd>
            </div>
            <div>
              <dt>Paid</dt>
              <dd>{formatCurrency(paidAmount)}</dd>
            </div>
            <div>
              <dt>
                <span className='payment-summary-discount-label'>
                  Discount
                  <span className='payment-summary-discount-badge'>
                    {discount.mode === 'percent' ? '%' : '₴'}
                  </span>
                </span>
              </dt>
              <dd>
                {discount.value > 0
                  ? `${discount.value}${discount.mode === 'percent' ? '%' : ' ₴'}`
                  : '-'}
              </dd>
            </div>
            <div>
              <dt>To pay</dt>
              <dd>{formatCurrency(currentPaymentRemaining)}</dd>
            </div>
          </dl>
          <button
            type='button'
            className={
              paymentMethod === 'non-cash'
                ? 'payment-cash-badge payment-cash-badge-non-cash'
                : 'payment-cash-badge'
            }
            onClick={() =>
              onPaymentMethodChange(
                paymentMethod === 'cash' ? 'non-cash' : 'cash',
              )
            }
            disabled={isLoading || isSaving}
          >
            {paymentMethod === 'cash' ? 'Cash' : 'Non-cash'}
          </button>
        </div>

        <div className='payment-modal-form'>
          <label className='field payment-cashbox-field'>
            <span>* Cashbox</span>
            <select
              value={selectedCashboxId}
              onChange={(event) =>
                onCashboxChange(event.target.value)
              }
              disabled={isLoading || isSaving}
            >
              {cashboxes.map((cashbox) => (
                <option key={cashbox.id} value={cashbox.id}>
                  {cashbox.name}
                </option>
              ))}
            </select>
          </label>
          <label className='field'>
            <span>Amount</span>
            <NumberStepper
              min={0}
              max={currentPaymentRemaining}
              value={amount}
              onChange={onAmountChange}
              disabled={isLoading || isSaving}
            />
          </label>
          <label className='field'>
            <span>To pay</span>
            <input
              value={String(nextPaymentRemaining)}
              disabled
              readOnly
            />
          </label>
        </div>

        <footer className='payment-modal-footer'>
          <div className='payment-print-menu' ref={printMenuRef}>
            <button
              type='button'
              className='secondary-button'
              onClick={() =>
                setIsPrintMenuOpen((current) => !current)
              }
              disabled={isSaving}
            >
              Print
            </button>
            {isPrintMenuOpen ? (
              <div className='payment-print-options'>
                {printForms.map((form) => (
                  <label
                    key={form.id}
                    className='payment-print-option'
                  >
                    <input
                      type='checkbox'
                      checked={selectedFormIds.includes(form.id)}
                      onChange={() => togglePrintForm(form.id)}
                    />
                    <span>{form.title}</span>
                  </label>
                ))}
                <button
                  type='button'
                  className='primary-button'
                  onClick={printSelectedForms}
                  disabled={selectedFormIds.length === 0}
                >
                  Print selected
                </button>
              </div>
            ) : null}
          </div>
          <div className='payment-modal-actions'>
            <button
              type='button'
              className='secondary-button'
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type='button'
              className='orders-create-button'
              onClick={() => onSubmit('deposit')}
              disabled={isSubmitDisabled}
            >
              {isSaving ? 'Saving...' : 'Accept to cashbox'}
            </button>
            <button
              type='button'
              className='payment-issue-button'
              onClick={() => onSubmit('depositAndIssue')}
              disabled={isSubmitDisabled}
            >
              {submitWithStatusLabel}
            </button>
            <button
              type='button'
              className='payment-issue-secondary-button'
              onClick={() => onSubmit('issueWithoutPayment')}
              disabled={isIssueDisabled}
              title={
                isIssueWithoutPaymentBlocked
                  ? 'Issued requires payment to cashbox unless total is 0.'
                  : undefined
              }
            >
              {submitWithoutPaymentLabel}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};

type RefundModalProps = {
  sale: Sale;
  lineItems: OrderLineItem[];
  cashboxes: Cashbox[];
  selectedCashboxId: string;
  amount: string;
  paidAmount: number;
  isLoading: boolean;
  isSaving: boolean;
  onCashboxChange: (cashboxId: string) => void;
  onAmountChange: (amount: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

const RefundModal = ({
  sale,
  lineItems,
  cashboxes,
  selectedCashboxId,
  amount,
  paidAmount,
  isLoading,
  isSaving,
  onCashboxChange,
  onAmountChange,
  onClose,
  onSubmit,
}: RefundModalProps) => {
  const total = getOrderTotal(sale, lineItems);
  const numericAmount = Number(amount);
  const isSubmitDisabled =
    isLoading ||
    isSaving ||
    !selectedCashboxId ||
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0 ||
    numericAmount > paidAmount;

  return (
    <div className='modal-backdrop' role='presentation'>
      <section
        className='payment-modal'
        role='dialog'
        aria-modal='true'
        aria-label='Refund payment'
      >
        <button
          type='button'
          className='payment-modal-close'
          onClick={onClose}
          aria-label='Close refund modal'
        >
          &times;
        </button>

        <div className='payment-modal-summary'>
          <dl>
            <div>
              <dt>Order total</dt>
              <dd>{formatCurrency(total)}</dd>
            </div>
            <div>
              <dt>Paid</dt>
              <dd>{formatCurrency(paidAmount)}</dd>
            </div>
            <div>
              <dt>Refund amount</dt>
              <dd>
                {formatCurrency(
                  Number.isFinite(numericAmount) ? numericAmount : 0,
                )}
              </dd>
            </div>
          </dl>
          <span className='payment-cash-badge'>Refund</span>
        </div>

        <div className='payment-modal-form'>
          <label className='field payment-cashbox-field'>
            <span>* Cashbox</span>
            <select
              value={selectedCashboxId}
              onChange={(event) =>
                onCashboxChange(event.target.value)
              }
              disabled={isLoading || isSaving}
            >
              {cashboxes.map((cashbox) => (
                <option key={cashbox.id} value={cashbox.id}>
                  {cashbox.name}
                </option>
              ))}
            </select>
          </label>
          <label className='field'>
            <span>Amount</span>
            <NumberStepper
              min={0}
              max={paidAmount}
              value={amount}
              onChange={onAmountChange}
              disabled={isLoading || isSaving}
            />
          </label>
          <label className='field'>
            <span>Available</span>
            <input value={String(paidAmount)} disabled readOnly />
          </label>
        </div>

        <footer className='payment-modal-footer'>
          <div />
          <div className='payment-modal-actions'>
            <button
              type='button'
              className='secondary-button'
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type='button'
              className='payment-issue-secondary-button'
              onClick={onSubmit}
              disabled={isSubmitDisabled}
            >
              {isSaving ? 'Saving...' : 'Refund to client'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};

type ReturnLineItemModalProps = {
  sale: Sale;
  item: OrderLineItem;
  warehouse: string;
  isLoading: boolean;
  isSaving: boolean;
  onWarehouseChange: (warehouse: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

type ReturnSaleModalProps = {
  sale: Sale;
  lineItems: OrderLineItem[];
  cashboxes: Cashbox[];
  selectedCashboxId: string;
  amount: string;
  warehouse: string;
  paidAmount: number;
  isLoading: boolean;
  isSaving: boolean;
  onCashboxChange: (cashboxId: string) => void;
  onAmountChange: (amount: string) => void;
  onWarehouseChange: (warehouse: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

const ReturnSaleModal = ({
  sale,
  lineItems,
  cashboxes,
  selectedCashboxId,
  amount,
  warehouse,
  paidAmount,
  isLoading,
  isSaving,
  onCashboxChange,
  onAmountChange,
  onWarehouseChange,
  onClose,
  onSubmit,
}: ReturnSaleModalProps) => {
  const productItems = lineItems.filter(
    (item) => item.kind === 'product',
  );
  const serviceItems = lineItems.filter(
    (item) => item.kind !== 'product',
  );
  const productTotal = getLineItemsTotal(productItems);
  const serviceTotal = getLineItemsTotal(serviceItems);
  const numericAmount = Number(amount);
  const minRefund = Math.max(paidAmount - serviceTotal, 0);
  const maxRefund = Math.min(productTotal, paidAmount);
  const suggestedCashboxName =
    cashboxes.find((cashbox) => cashbox.id === selectedCashboxId)
      ?.name ?? 'Cashbox';
  const isSubmitDisabled =
    isLoading ||
    isSaving ||
    !selectedCashboxId ||
    !warehouse.trim() ||
    !Number.isFinite(numericAmount) ||
    numericAmount < minRefund ||
    numericAmount <= 0 ||
    numericAmount > maxRefund;

  return (
    <div className='modal-backdrop' role='presentation'>
      <section
        className='payment-modal'
        role='dialog'
        aria-modal='true'
        aria-label='Return sale'
      >
        <button
          type='button'
          className='payment-modal-close'
          onClick={onClose}
          aria-label='Close return modal'
        >
          &times;
        </button>

        <div className='payment-modal-summary'>
          <dl>
            <div>
              <dt>Order</dt>
              <dd>{sale.recordNumber ?? 'r------'}</dd>
            </div>
            <div>
              <dt>Products to stock</dt>
              <dd>
                {productItems
                  .map((item) => `${item.name} x${item.quantity}`)
                  .join(', ')}
              </dd>
            </div>
            <div>
              <dt>Product total</dt>
              <dd>{formatCurrency(productTotal)}</dd>
            </div>
            <div>
              <dt>Paid</dt>
              <dd>{formatCurrency(paidAmount)}</dd>
            </div>
          </dl>
          <span className='payment-cash-badge'>Return</span>
        </div>

        <div className='payment-modal-form'>
          <label className='field'>
            <span>Receive to warehouse</span>
            <input
              value={warehouse}
              onChange={(event) =>
                onWarehouseChange(event.target.value)
              }
              disabled={isLoading || isSaving}
            />
          </label>
          <label className='field payment-cashbox-field'>
            <span>Refund from cashbox</span>
            <select
              value={selectedCashboxId}
              onChange={(event) =>
                onCashboxChange(event.target.value)
              }
              disabled={isLoading || isSaving}
            >
              {cashboxes.map((cashbox) => (
                <option key={cashbox.id} value={cashbox.id}>
                  {cashbox.name}
                </option>
              ))}
            </select>
          </label>
          <label className='field'>
            <span>Refund amount</span>
            <NumberStepper
              min={minRefund}
              max={maxRefund}
              value={amount}
              onChange={onAmountChange}
              disabled={isLoading || isSaving}
            />
          </label>
        </div>

        <footer className='payment-modal-footer'>
          <p className='muted-copy'>{`Suggested cashbox: ${suggestedCashboxName}`}</p>
          <div className='payment-modal-actions'>
            <button
              type='button'
              className='secondary-button'
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type='button'
              className='payment-issue-secondary-button'
              onClick={onSubmit}
              disabled={isSubmitDisabled}
            >
              {isSaving ? 'Saving...' : 'Return sale'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};

const ReturnLineItemModal = ({
  sale,
  item,
  warehouse,
  isLoading,
  isSaving,
  onWarehouseChange,
  onClose,
  onSubmit,
}: ReturnLineItemModalProps) => {
  const itemTotal = item.price * item.quantity;
  const isSubmitDisabled =
    isLoading ||
    isSaving ||
    !warehouse.trim();

  return (
    <div className='modal-backdrop' role='presentation'>
      <section
        className='payment-modal'
        role='dialog'
        aria-modal='true'
        aria-label='Return product'
      >
        <button
          type='button'
          className='payment-modal-close'
          onClick={onClose}
          aria-label='Close return modal'
        >
          &times;
        </button>

        <div className='payment-modal-summary'>
          <dl>
            <div>
              <dt>Product</dt>
              <dd>{item.name}</dd>
            </div>
            <div>
              <dt>Order</dt>
              <dd>{sale.recordNumber ?? 'r------'}</dd>
            </div>
            <div>
              <dt>Item total</dt>
              <dd>{formatCurrency(itemTotal)}</dd>
            </div>
          </dl>
          <span className='payment-cash-badge'>Return</span>
        </div>

        <div className='payment-modal-form'>
          <label className='field'>
            <span>Receive to warehouse</span>
            <input
              value={warehouse}
              onChange={(event) =>
                onWarehouseChange(event.target.value)
              }
              disabled={isLoading || isSaving}
            />
          </label>
        </div>

        <footer className='payment-modal-footer'>
          <p className='muted-copy'>
            Refund must be completed via "Refund to client" before stock return.
          </p>
          <div className='payment-modal-actions'>
            <button
              type='button'
              className='secondary-button'
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type='button'
              className='payment-issue-secondary-button'
              onClick={onSubmit}
              disabled={isSubmitDisabled}
            >
              {isSaving ? 'Saving...' : 'Return product'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};

type MessageModalProps = {
  title: string;
  message: string;
  onClose: () => void;
};

const MessageModal = ({
  title,
  message,
  onClose,
}: MessageModalProps) => (
  <div className='modal-backdrop' role='presentation'>
    <section
      className='payment-modal payment-modal-message'
      role='dialog'
      aria-modal='true'
      aria-label={title}
    >
      <div className='payment-modal-summary'>
        <h3>{title}</h3>
        <p>{message}</p>
      </div>
      <footer className='payment-modal-footer'>
        <div />
        <div className='payment-modal-actions'>
          <button
            type='button'
            className='primary-button'
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </footer>
    </section>
  </div>
);
