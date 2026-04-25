import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { Employee } from '../../../entities/employee/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import { isRepairOrder } from '../../../entities/sale/lib/sale-kind';
import type { DemoSeedKind } from '../../../features/demo-data/api/demoApi';
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
  returnSaleLineItem,
  updateSaleWorkspace,
} from '../../../entities/sale/api/saleApi';
import { getServiceCatalogItems } from '../../../entities/service-catalog/api/serviceCatalogApi';
import type { ServiceCatalogItem } from '../../../entities/service-catalog/model/types';
import type { Cashbox } from '../../../entities/finance/model/types';
import { NumberStepper } from '../../../shared/ui/NumberStepper';

type OrdersWorkspaceProps = {
  sales: Sale[];
  isLoading: boolean;
  activeTab: OrdersTab;
  searchValue: string;
  isSeeding: boolean;
  currentEmployee: Employee | null;
  canCreateOrders: boolean;
  onActiveTabChange: (tab: OrdersTab) => void;
  onSearchChange: (value: string) => void;
  onCreateOrder: (tab: OrdersTab) => void;
  createOrderHref: string;
  onSeedDemoData: (kind: DemoSeedKind) => void;
  onSaleUpdate: (sale: Sale) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

type OrdersTab = 'orders' | 'sales';
const isPlainLeftClick = (event: ReactMouseEvent<HTMLAnchorElement>) =>
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
  | 'completed'
  | 'returned';
type OrderStatus = RepairStatus | SaleStatus;
type PaymentAction =
  | 'deposit'
  | 'depositAndIssue'
  | 'issueWithoutPayment';
type PaymentTargetStatus =
  | 'issued'
  | 'issuedWithoutRepair'
  | 'paid'
  | 'completed';
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
  amount: number;
  cashboxId: string;
  cashboxName: string;
  createdAt: string;
  author: string;
};
type OrderLineItemKind = 'product' | 'service';
type OrderLineItem = {
  id: string;
  kind: OrderLineItemKind;
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  warrantyPeriod: number;
};

const orderTabs: Array<{ key: OrdersTab; label: string }> = [
  { key: 'orders', label: 'Orders' },
  { key: 'sales', label: 'Sales' },
];

const printFormsStorageKey = 'project-goods.print-forms';
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
  { key: 'completed', label: 'Completed' },
  { key: 'returned', label: 'Returned' },
];

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

const getStatusOptionsForSale = (sale: Sale) =>
  isRepairOrder(sale) ? repairStatuses : saleStatuses;

const getStatusLabel = (sale: Sale, status: OrderStatus) =>
  getStatusOptionsForSale(sale).find((option) => option.key === status)?.label ??
  statusLabels[status];

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

const createOrderLineItem = (
  sale: Sale,
  kind: OrderLineItemKind,
): OrderLineItem => ({
  id: `${sale.id}-${kind}-default`,
  kind,
  productId: kind === 'product' ? sale.product.id : undefined,
  name: kind === 'product' ? sale.product.name : 'Repair',
  price: sale.salePrice,
  quantity: sale.quantity,
  warrantyPeriod: 0,
});

const warrantyOptions = [
  { label: '30 day', value: 1 },
  { label: '3 month', value: 3 },
  { label: '6 month', value: 6 },
  { label: '1 year', value: 12 },
  { label: '2 year', value: 24 },
  { label: '3 year', value: 36 },
];

const getDefaultLineItems = (sale: Sale) =>
  isRepairOrder(sale)
    ? [createOrderLineItem(sale, 'service')]
    : [createOrderLineItem(sale, 'product')];

const getOrderTotal = (
  sale: Sale,
  lineItems: OrderLineItem[] =
    sale.lineItems?.length ? sale.lineItems : getDefaultLineItems(sale),
) =>
  lineItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

const getLineItemsTotal = (lineItems: OrderLineItem[]) =>
  lineItems.reduce((total, item) => total + item.price * item.quantity, 0);

const getRemainingPayment = (
  sale: Sale,
  paidAmount: number,
  lineItems: OrderLineItem[] =
    sale.lineItems?.length ? sale.lineItems : getDefaultLineItems(sale),
) => Math.max(getOrderTotal(sale, lineItems) - paidAmount, 0);

const isClosingStatus = (sale: Sale, status: OrderStatus) =>
  isRepairOrder(sale)
    ? status === 'issued' || status === 'issuedWithoutRepair'
    : status === 'paid' || status === 'completed';

const shouldCaptureIssuedBy = (sale: Sale, status: OrderStatus) =>
  !isRepairOrder(sale) && isClosingStatus(sale, status) && !sale.issuedBy;

const isSalePaymentStatus = (status: OrderStatus) =>
  status === 'paid' || status === 'completed';

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

const buildOrderNumber = (sale: Sale) => sale.recordNumber ?? 'r------';

const formatReadyDate = (value: string) =>
  new Intl.DateTimeFormat('uk-UA', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(value));

const formatPhoneNumber = (value: string) => {
  const groups = getPhoneNumberGroups(value);

  return groups.length > 0 ? groups.join(' ') : value.replace(/^\+?38\s*/, '');
};

const getPhoneNumberGroups = (value: string) => {
  const digits = value.replace(/\D/g, '');
  const localDigits = digits.startsWith('38') ? digits.slice(2) : digits;
  const tenDigitMatch = localDigits.match(/^(\d{3})(\d{3})(\d{2})(\d{2})$/);
  const elevenDigitMatch = localDigits.match(/^(\d{3})(\d{4})(\d{2})(\d{2})$/);

  if (tenDigitMatch) {
    return tenDigitMatch.slice(1);
  }

  if (elevenDigitMatch) {
    return elevenDigitMatch.slice(1);
  }

  return [];
};

const getCreatedTime = (sale: Sale) => new Date(sale.createdAt).getTime();

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

export const OrdersWorkspace = ({
  sales,
  isLoading,
  activeTab,
  searchValue,
  isSeeding,
  currentEmployee,
  canCreateOrders,
  onActiveTabChange,
  onSearchChange,
  onCreateOrder,
  createOrderHref,
  onSeedDemoData,
  onSaleUpdate,
  onError,
  onSuccess,
}: OrdersWorkspaceProps) => {
  const currentEmployeeName = currentEmployee?.name ?? 'Unknown employee';
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(
    null,
  );
  const [openStatusSaleId, setOpenStatusSaleId] = useState<
    string | null
  >(null);
  const [paymentSale, setPaymentSale] = useState<Sale | null>(null);
  const [refundSale, setRefundSale] = useState<Sale | null>(null);
  const [returnSale, setReturnSale] = useState<Sale | null>(null);
  const [fullReturnSale, setFullReturnSale] = useState<Sale | null>(null);
  const [returnLineItem, setReturnLineItem] = useState<OrderLineItem | null>(null);
  const [paymentTargetStatus, setPaymentTargetStatus] =
    useState<PaymentTargetStatus>('issued');
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [selectedCashboxId, setSelectedCashboxId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedRefundCashboxId, setSelectedRefundCashboxId] =
    useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [returnRefundAmount, setReturnRefundAmount] = useState('');
  const [returnWarehouse, setReturnWarehouse] = useState('Service center');
  const [isPaymentModalLoading, setIsPaymentModalLoading] =
    useState(false);
  const [isPaymentSaving, setIsPaymentSaving] = useState(false);
  const [isRefundModalLoading, setIsRefundModalLoading] =
    useState(false);
  const [isRefundSaving, setIsRefundSaving] = useState(false);
  const [isReturnModalLoading, setIsReturnModalLoading] = useState(false);
  const [isReturnSaving, setIsReturnSaving] = useState(false);
  const [isFullReturnModalLoading, setIsFullReturnModalLoading] = useState(false);
  const [isFullReturnSaving, setIsFullReturnSaving] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(
    null,
  );

  const filteredOrders = useMemo(() => {
    const tabSales = sales.filter((sale) =>
      activeTab === 'orders'
        ? isRepairOrder(sale)
        : !isRepairOrder(sale),
    );
    const query = searchValue.trim().toLowerCase();
    const sortedTabSales = [...tabSales].sort(
      (firstSale, secondSale) =>
        getCreatedTime(secondSale) - getCreatedTime(firstSale),
    );

    if (!query) {
      return sortedTabSales;
    }

    return sortedTabSales.filter((sale) => {
      const orderNumber = buildOrderNumber(sale);
      return (
        String(orderNumber).includes(query) ||
        sale.product.name.toLowerCase().includes(query) ||
        sale.client.name.toLowerCase().includes(query) ||
        sale.client.phone.toLowerCase().includes(query)
      );
    });
  }, [activeTab, sales, searchValue]);

  const selectedSale = useMemo(
    () => sales.find((sale) => sale.id === selectedSaleId) ?? null,
    [sales, selectedSaleId],
  );
  const selectedSaleStatusOptions = selectedSale
    ? isRepairOrder(selectedSale)
      ? repairStatuses
      : saleStatuses
    : repairStatuses;
  const selectedSaleStatus = selectedSale
    ? ((selectedSale.status ?? 'new') as OrderStatus)
    : 'new';

  const getStatus = (sale: Sale): OrderStatus =>
    (sale.status as OrderStatus) ?? 'new';

  const getStatusOptions = getStatusOptionsForSale;

  const getLineItems = (sale: Sale) =>
    sale.lineItems?.length ? sale.lineItems : getDefaultLineItems(sale);

  const getPaidAmount = (sale: Sale) => sale.paidAmount ?? 0;

  const getOrderRemainingPayment = (sale: Sale) =>
    getRemainingPayment(sale, getPaidAmount(sale), getLineItems(sale));

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
      issuedById?: string;
      timeline?: TimelineEntry[];
      paymentHistory?: PaymentEntry[];
      lineItems?: OrderLineItem[];
    },
  ) => {
    const updatedSale = await updateSaleWorkspace(sale.id, {
      kind: sale.kind,
      status: payload.status ?? sale.status,
      paidAmount: payload.paidAmount ?? sale.paidAmount,
      issuedById: payload.issuedById,
      timeline: payload.timeline ?? sale.timeline,
      paymentHistory:
        payload.paymentHistory ?? sale.paymentHistory,
      lineItems: payload.lineItems ?? getLineItems(sale),
    });
    onSaleUpdate(updatedSale);
    return updatedSale;
  };

  const updateStatus = async (
    sale: Sale,
    status: OrderStatus,
  ) => {
    const remainingPayment = getOrderRemainingPayment(sale);

    if (!isRepairOrder(sale) && status === 'returned') {
      setOpenStatusSaleId(null);
      await openReturnSaleModal(sale);
      return;
    }

    if (
      (isRepairOrder(sale) && status === 'issued') ||
      (!isRepairOrder(sale) && isSalePaymentStatus(status))
    ) {
      setOpenStatusSaleId(null);
      if (remainingPayment <= 0) {
        await persistSaleWorkspace(sale, {
          status,
          issuedById: shouldCaptureIssuedBy(sale, status)
            ? currentEmployee?.id
            : undefined,
          timeline: [
            appendTimelineEntry(
              `${currentEmployeeName} changed status to "${getStatusLabel(sale, status)}".`,
            ),
            ...sale.timeline,
          ],
        });
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
      issuedById: shouldCaptureIssuedBy(sale, status)
        ? currentEmployee?.id
        : undefined,
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

  const openPaymentModal = async (
    sale: Sale,
    targetStatus: PaymentTargetStatus = 'issued',
  ) => {
    const remainingPayment = getOrderRemainingPayment(sale);

    setPaymentSale(sale);
    setPaymentTargetStatus(targetStatus);
    setPaymentAmount(String(remainingPayment));
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

  const openReturnLineItemModal = async (sale: Sale, item: OrderLineItem) => {
    const lastDepositCashboxId =
      (sale.paymentHistory ?? []).find((entry) => entry.type === 'deposit')
        ?.cashboxId ?? '';

    setReturnSale(sale);
    setReturnLineItem(item);
    setReturnRefundAmount(String(Math.min(item.price * item.quantity, getPaidAmount(sale))));
    setReturnWarehouse('Service center');
    setIsReturnModalLoading(true);

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
      setReturnSale(null);
      setReturnLineItem(null);
    } finally {
      setIsReturnModalLoading(false);
    }
  };

  const openReturnSaleModal = async (sale: Sale) => {
    const lastDepositCashboxId =
      (sale.paymentHistory ?? []).find((entry) => entry.type === 'deposit')
        ?.cashboxId ?? '';
    const lineItems = getLineItems(sale);
    const productTotal = getLineItemsTotal(
      lineItems.filter((item) => item.kind === 'product'),
    );
    const serviceTotal = getLineItemsTotal(
      lineItems.filter((item) => item.kind !== 'product'),
    );
    const paidAmount = getPaidAmount(sale);
    const suggestedRefund = Math.min(productTotal, Math.max(paidAmount - serviceTotal, 0));

    if (productTotal <= 0) {
      onError('Sale has no products to return to stock.');
      return;
    }

    if (suggestedRefund <= 0) {
      onError('Cannot return a sale without received payment. Use another status for unpaid cancellation.');
      return;
    }

    setFullReturnSale(sale);
    setReturnRefundAmount(String(Math.round(suggestedRefund * 100) / 100));
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

  const removeLineItem = (sale: Sale, itemId: string) => {
    const currentItems = getLineItems(sale);
    const nextItems = currentItems.filter((item) => item.id !== itemId);
    void persistSaleWorkspace(sale, {
      lineItems:
        nextItems.length > 0 ? nextItems : getDefaultLineItems(sale),
    });
  };

  const updateLineItem = (
    sale: Sale,
    itemId: string,
    patch: Partial<Pick<OrderLineItem, 'price' | 'quantity' | 'warrantyPeriod'>>,
  ) => {
    const nextItems = getLineItems(sale).map((item) =>
      item.id === itemId ? { ...item, ...patch } : item,
    );

    void persistSaleWorkspace(sale, {
      lineItems: nextItems,
    });
  };

  const setIssuedStatus = (
    status: PaymentTargetStatus = 'issued',
  ) => status;

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
      let nextPaymentHistory = [...(paymentSale.paymentHistory ?? [])];
      let nextTimeline = [...(paymentSale.timeline ?? [])];
      let nextStatus: OrderStatus | undefined;

      if (action !== 'issueWithoutPayment') {
        const cashboxName =
          cashboxes.find((cashbox) => cashbox.id === selectedCashboxId)
            ?.name ?? 'Cashbox';
        const acceptedAmount = normalizedAmount;
        nextPaidAmount = Math.min(
          currentPaidAmount + acceptedAmount,
          getOrderTotal(paymentSale, currentLineItems),
        );
        nextPaymentHistory = [
          addPaymentHistoryEntry({
            type: 'deposit',
            amount: acceptedAmount,
            cashboxId: selectedCashboxId,
            cashboxName,
          }),
          ...(paymentSale.paymentHistory ?? []),
        ];
        nextTimeline = [
          appendTimelineEntry(
            `${currentEmployeeName} accepted ${formatCurrency(acceptedAmount)} to ${cashboxName}.`,
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
          nextStatus && shouldCaptureIssuedBy(paymentSale, nextStatus)
            ? currentEmployee?.id
            : undefined,
        paymentHistory: nextPaymentHistory,
        timeline: nextTimeline,
      });

      onSuccess(
        action === 'deposit'
          ? 'Payment accepted to cashbox.'
          : paymentTargetStatus === 'paid'
            ? 'Sale marked as paid successfully.'
            : paymentTargetStatus === 'completed'
              ? 'Sale completed successfully.'
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
    const normalizedAmount = Math.round(Number(refundAmount) * 100) / 100;

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
      const cashboxName =
        cashboxes.find(
          (cashbox) => cashbox.id === selectedRefundCashboxId,
        )?.name ?? 'Cashbox';
      const nextPaidAmount = Math.max(
        currentPaidAmount - normalizedAmount,
        0,
      );
      const nextPaymentHistory = [
        addPaymentHistoryEntry({
          type: 'refund',
          amount: normalizedAmount,
          cashboxId: selectedRefundCashboxId,
          cashboxName,
        }),
        ...(refundSale.paymentHistory ?? []),
      ];
      const nextTimeline = [
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
        paidAmount: nextPaidAmount,
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
    if (!returnSale || !returnLineItem || !selectedRefundCashboxId) return;

    const refundAmountValue = Math.round(Number(returnRefundAmount) * 100) / 100;

    if (
      !Number.isFinite(refundAmountValue) ||
      refundAmountValue <= 0 ||
      refundAmountValue > returnLineItem.price * returnLineItem.quantity ||
      refundAmountValue > getPaidAmount(returnSale)
    ) {
      onError('Refund amount cannot exceed item total or paid amount.');
      return;
    }

    setIsReturnSaving(true);

    try {
      const updatedSale = await returnSaleLineItem(returnSale.id, {
        lineItemId: returnLineItem.id,
        cashboxId: selectedRefundCashboxId,
        refundAmount: String(refundAmountValue),
        warehouse: returnWarehouse,
        author: currentEmployeeName,
      });
      onSaleUpdate(updatedSale);
      setCashboxes(await getCashboxes());
      window.dispatchEvent(
        new CustomEvent('project-goods:finance-updated'),
      );
      onSuccess('Product returned to stock and refund completed.');
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

    const refundAmountValue = Math.round(Number(returnRefundAmount) * 100) / 100;
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
      setCashboxes(await getCashboxes());
      window.dispatchEvent(
        new CustomEvent('project-goods:finance-updated'),
      );
      onSuccess('Sale returned, products moved back to stock, and refund completed.');
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

  return (
    <section className='orders-page'>
      {selectedSale ? (
        <OrderDetailCard
          sale={selectedSale}
          sales={sales}
          status={selectedSaleStatus}
          statusOptions={selectedSaleStatusOptions}
          comments={selectedSale.timeline ?? []}
          lineItems={getLineItems(selectedSale)}
          paidAmount={getPaidAmount(selectedSale)}
          onClose={() => setSelectedSaleId(null)}
          onStatusChange={(status) =>
            updateStatus(selectedSale, status)
          }
          onAddComment={(comment) =>
            addComment(selectedSale, comment)
          }
          onAddLineItem={(item) => addLineItem(selectedSale, item)}
          onRemoveLineItem={(itemId) =>
            removeLineItem(selectedSale, itemId)
          }
          onUpdateLineItem={(itemId, patch) =>
            updateLineItem(selectedSale, itemId, patch)
          }
          onReturnLineItem={(item) =>
            openReturnLineItemModal(selectedSale, item)
          }
          onOpenRelatedSale={openSaleCard}
          onAcceptPayment={() => openPaymentModal(selectedSale)}
          onRefundPayment={() => openRefundModal(selectedSale)}
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
            className='toolbar-square-button'
            aria-label='Filters'
          >
            ⚙
          </button>
          <button type='button' className='toolbar-filter-button'>
            Filter
          </button>
          <div className='orders-search-group'>
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder='Search by order, client or device'
              aria-label='Search orders'
            />
            <button type='button'>Find</button>
          </div>
        </div>
        <div className='orders-toolbar-actions'>
          <button
            type='button'
            className='toolbar-filter-button'
            onClick={() => onSeedDemoData('repairs')}
            disabled={isSeeding}
          >
            {isSeeding ? 'Loading...' : 'Demo repairs'}
          </button>
          <button
            type='button'
            className='toolbar-filter-button'
            onClick={() => onSeedDemoData('sales')}
            disabled={isSeeding}
          >
            {isSeeding ? 'Loading...' : 'Demo sales'}
          </button>
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

      <div className='orders-table-wrap'>
        <table className='orders-table'>
          <thead>
            <tr>
              <th>Order #</th>
              <th>Receiver</th>
              <th>Manager</th>
              <th>Master</th>
              <th>Status</th>
              <th>Device</th>
              <th>Price</th>
              <th>Paid</th>
              <th>Client</th>
              <th>Term</th>
              <th>Warehouse</th>
              <th>Add</th>
              <th>Ready date</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={13} className='orders-empty'>
                  Loading orders...
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={13} className='orders-empty'>
                  {activeTab === 'orders'
                    ? 'Orders not found.'
                    : 'Sales not found.'}
                </td>
              </tr>
            ) : (
              filteredOrders.map((sale) => {
                const status = getStatus(sale);
                const statusOptions = getStatusOptions(sale);
                return (
                  <tr key={sale.id}>
                    <td>
                      <button
                        type='button'
                        className='order-number-button'
                        onClick={() => openSaleCard(sale)}
                      >
                        {buildOrderNumber(sale)}
                      </button>
                    </td>
                    <td>{sale.client.name}</td>
                    <td>{sale.manager?.name || '-'}</td>
                    <td>{sale.master?.name || '-'}</td>
                    <td>
                      <div className='order-status-menu'>
                        <button
                          type='button'
                          className={`order-status order-status-${status}`}
                          onClick={() =>
                            setOpenStatusSaleId((currentId) =>
                              currentId === sale.id ? null : sale.id,
                            )
                          }
                        >
                          {getStatusLabel(sale, status)}
                        </button>
                        {openStatusSaleId === sale.id ? (
                          <div className='order-status-options'>
                            {statusOptions.map((statusOption) => (
                              <button
                                key={statusOption.key}
                                type='button'
                                className={
                                  statusOption.key === status
                                    ? 'order-status-option order-status-option-active'
                                    : 'order-status-option'
                                }
                                onClick={() => {
                                  void updateStatus(
                                    sale,
                                    statusOption.key,
                                  );
                                }}
                              >
                                {statusOption.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <button
                        type='button'
                        className='order-device-button'
                        onClick={() => openSaleCard(sale)}
                      >
                        <span>{sale.product.name}</span>
                        <small>
                          S/N: {sale.product.serialNumber}
                        </small>
                      </button>
                    </td>
                    <td>{formatCurrency(getOrderTotal(sale, getLineItems(sale)))}</td>
                    <td>{formatCurrency(getPaidAmount(sale))}</td>
                    <td>
                      <div className='orders-client-cell'>
                        <span>{sale.client.name}</span>
                        <small>
                          <PhoneNumber value={sale.client.phone} />
                        </small>
                      </div>
                    </td>
                    <td>Non-urgent</td>
                    <td>Service center</td>
                    <td>{formatReadyDate(sale.createdAt)}</td>
                    <td>{formatReadyDate(sale.saleDate)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {paymentSale ? (
        <PaymentModal
          sale={paymentSale}
          paymentTargetStatus={paymentTargetStatus}
          lineItems={getLineItems(paymentSale)}
          cashboxes={cashboxes}
          selectedCashboxId={selectedCashboxId}
          amount={paymentAmount}
          paidAmount={getPaidAmount(paymentSale)}
          isLoading={isPaymentModalLoading}
          isSaving={isPaymentSaving}
          onCashboxChange={setSelectedCashboxId}
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
          cashboxes={cashboxes}
          selectedCashboxId={selectedRefundCashboxId}
          amount={returnRefundAmount}
          warehouse={returnWarehouse}
          paidAmount={getPaidAmount(returnSale)}
          isLoading={isReturnModalLoading}
          isSaving={isReturnSaving}
          onCashboxChange={setSelectedRefundCashboxId}
          onAmountChange={setReturnRefundAmount}
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
  status: OrderStatus;
  statusOptions: Array<{ key: OrderStatus; label: string }>;
  comments: TimelineEntry[];
  lineItems: OrderLineItem[];
  paidAmount: number;
  onClose: () => void;
  onStatusChange: (status: OrderStatus) => void;
  onAddComment: (comment: string) => void;
  onAddLineItem: (item: Omit<OrderLineItem, 'id'>) => void;
  onRemoveLineItem: (itemId: string) => void;
  onUpdateLineItem: (
    itemId: string,
    patch: Partial<Pick<OrderLineItem, 'price' | 'quantity' | 'warrantyPeriod'>>,
  ) => void;
  onReturnLineItem: (item: OrderLineItem) => void;
  onOpenRelatedSale: (sale: Sale) => void;
  onAcceptPayment: () => void;
  onRefundPayment: () => void;
};

const OrderDetailCard = ({
  sale,
  sales,
  status,
  statusOptions,
  comments,
  lineItems,
  paidAmount,
  onClose,
  onStatusChange,
  onAddComment,
  onAddLineItem,
  onRemoveLineItem,
  onUpdateLineItem,
  onReturnLineItem,
  onOpenRelatedSale,
  onAcceptPayment,
  onRefundPayment,
}: OrderDetailCardProps) => {
  const [comment, setComment] = useState('');
  const [isServicesOpen, setIsServicesOpen] = useState(false);
  const [relatedTab, setRelatedTab] = useState<OrdersTab>('orders');
  const total = getOrderTotal(sale, lineItems);
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
  const isSaleCard = !isRepairOrder(sale);
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
    relatedTab === 'orders' ? isRepairOrder(item) : !isRepairOrder(item),
  );
  const timelineItems = [
    {
      id: `${sale.id}-created`,
      author: sale.client.name,
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

  return (
    <article className='order-detail-card' aria-label='Order card'>
      <header className='order-detail-header'>
        <div>
          <span className='section-label'>Order card</span>
          <h2>{sale.recordNumber ?? 'r------'}</h2>
        </div>
        <div className='order-detail-actions'>
          <select
            value={status}
            onChange={(event) => {
              void onStatusChange(
                event.target.value as OrderStatus,
              );
            }}
            aria-label='Repair status'
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
              <dd>{sale.client.name}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{formatPhoneNumber(sale.client.phone)}</dd>
            </div>
            {isSaleCard ? null : (
              <>
                <div>
                  <dt>Device</dt>
                  <dd>{sale.product.name}</dd>
                </div>
                <div>
                  <dt>S/N</dt>
                  <dd>{sale.product.serialNumber}</dd>
                </div>
                <div>
                  <dt>Article</dt>
                  <dd>{sale.product.article}</dd>
                </div>
              </>
            )}
            <div>
              <dt>Received</dt>
              <dd>{formatDateTime(sale.createdAt)}</dd>
            </div>
            <div>
              <dt>{isSaleCard ? 'Created order' : 'Manager'}</dt>
              <dd>{sale.manager?.name || '-'}</dd>
            </div>
            {isSaleCard ? (
              <div>
                <dt>Issued order</dt>
                <dd>{sale.issuedBy?.name || '-'}</dd>
              </div>
            ) : (
              <div>
                <dt>Master</dt>
                <dd>{sale.master?.name || '-'}</dd>
              </div>
            )}
            {isSaleCard ? (
              <div className='order-detail-notes-row'>
                <dt>Notes</dt>
                <dd>{sale.note || 'No notes for this sale yet.'}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className='order-detail-panel'>
          <h3>Live feed</h3>
          <div className='order-timeline'>
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
                  <small>{item.message}</small>
                </p>
              </div>
            ))}
            <textarea
              placeholder='Comment'
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
            <button
              type='button'
              className='primary-button'
              onClick={submitComment}
              disabled={!comment.trim()}
            >
              Add
            </button>
          </div>
        </section>

        <section className='order-detail-panel'>
          <h3>Products</h3>
          <LineItemsPanel
            title='Products'
            kind='product'
            items={productItems}
            onAddItem={onAddLineItem}
            onRemoveItem={onRemoveLineItem}
            onUpdateItem={onUpdateLineItem}
            onReturnItem={onReturnLineItem}
            isPaidSale={isSaleCard && paidAmount > 0}
          />
        </section>

        {isSaleCard ? (
          <section className='order-detail-panel order-detail-stacked-panel'>
            <button
              type='button'
              className='order-detail-collapse-button'
              onClick={() => setIsServicesOpen((current) => !current)}
              aria-expanded={isServicesOpen}
            >
              <span>Services</span>
              <span>{isServicesOpen ? 'Hide' : 'Show'}</span>
            </button>
            {isServicesOpen ? (
              <LineItemsPanel
                title='Services'
                kind='service'
                items={serviceItems}
                onAddItem={onAddLineItem}
                onRemoveItem={onRemoveLineItem}
                onUpdateItem={onUpdateLineItem}
                onReturnItem={onReturnLineItem}
                isPaidSale={false}
              />
            ) : null}
          </section>
        ) : (
          <section className='order-detail-panel'>
            <h3>Services</h3>
            <LineItemsPanel
              title='Services'
              kind='service'
              items={serviceItems}
              onAddItem={onAddLineItem}
              onRemoveItem={onRemoveLineItem}
              onUpdateItem={onUpdateLineItem}
              onReturnItem={onReturnLineItem}
              isPaidSale={false}
            />
          </section>
        )}

        <section className={`order-detail-panel ${isSaleCard ? 'order-detail-stacked-panel' : ''}`}>
          <h3>Payment</h3>
          <dl className='order-payment-list'>
            <div>
              <dt>Repair cost</dt>
              <dd>{formatCurrency(total)}</dd>
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
            disabled={remainingPayment <= 0}
          >
            {remainingPayment <= 0 ? 'Paid' : 'Accept payment'}
          </button>
          {paidAmount > 0 ? (
            <button
              type='button'
              className='secondary-button'
              onClick={onRefundPayment}
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
            {relatedVisibleRecords.length === 0 ? (
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
    </article>
  );
};

type LineItemsPanelProps = {
  title: string;
  kind: OrderLineItemKind;
  items: OrderLineItem[];
  onAddItem: (item: Omit<OrderLineItem, 'id'>) => void;
  onRemoveItem: (itemId: string) => void;
  onUpdateItem: (
    itemId: string,
    patch: Partial<Pick<OrderLineItem, 'price' | 'quantity' | 'warrantyPeriod'>>,
  ) => void;
  onReturnItem: (item: OrderLineItem) => void;
  isPaidSale: boolean;
};

const LineItemsPanel = ({
  title,
  kind,
  items,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onReturnItem,
  isPaidSale,
}: LineItemsPanelProps) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [warrantyPeriod, setWarrantyPeriod] = useState('12');
  const [serviceSuggestions, setServiceSuggestions] = useState<ServiceCatalogItem[]>([]);
  const [isServiceLookupLoading, setIsServiceLookupLoading] = useState(false);
  const serviceLookupQuery = kind === 'service' ? name.trim() : '';

  useEffect(() => {
    if (kind !== 'service' || serviceLookupQuery.length < 2) {
      setServiceSuggestions([]);
      return;
    }

    let isActive = true;
    const timeoutId = window.setTimeout(async () => {
      setIsServiceLookupLoading(true);
      try {
        const services = await getServiceCatalogItems(serviceLookupQuery);
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
  }, [kind, serviceLookupQuery]);

  const applyServiceSuggestion = (service: ServiceCatalogItem) => {
    setName(service.name);
    setPrice(String(service.price));
    setQuantity('1');
    setServiceSuggestions([]);
  };

  const submitItem = () => {
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

    onAddItem({
      kind,
      name: normalizedName,
      price: normalizedPrice,
      quantity: normalizedQuantity,
      warrantyPeriod: Number(warrantyPeriod),
    });
    setName('');
    setPrice('');
    setQuantity('1');
    setServiceSuggestions([]);
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
          items.map((item) => (
            <div key={item.id} className='order-detail-table-row'>
              <div key={`${item.id}-name`}>{item.name}</div>
              <div key={`${item.id}-price`}>
                <NumberStepper
                  className='line-item-inline-input'
                  min={0}
                  value={String(item.price)}
                  onChange={(value) => onUpdateItem(item.id, { price: Number(value) })}
                />
              </div>
              <div key={`${item.id}-qty`}>
                <NumberStepper
                  className='line-item-inline-input'
                  min={1}
                  value={String(item.quantity)}
                  onChange={(value) => onUpdateItem(item.id, { quantity: Number(value) })}
                />
              </div>
              <div key={`${item.id}-warranty`}>
                <select
                  className='line-item-inline-input'
                  value={item.warrantyPeriod || 12}
                  onChange={(event) =>
                    onUpdateItem(item.id, { warrantyPeriod: Number(event.target.value) })
                  }
                >
                  {warrantyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div key={`${item.id}-action`}>
                <button
                  type='button'
                  className='line-item-remove-button'
                  onClick={() =>
                    isPaidSale && item.kind === 'product'
                      ? onReturnItem(item)
                      : onRemoveItem(item.id)
                  }
                >
                  {isPaidSale && item.kind === 'product' ? 'Return' : 'Remove'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className='order-line-items-form'>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={`Add ${kind}`}
        />
        {kind === 'service' && (serviceSuggestions.length > 0 || isServiceLookupLoading) ? (
          <div className='create-suggestions line-item-suggestions'>
            {isServiceLookupLoading ? <p>Searching services...</p> : null}
            {serviceSuggestions.map((service) => (
              <button
                key={service.id}
                type='button'
                className='create-suggestion-item'
                onClick={() => applyServiceSuggestion(service)}
              >
                <strong>{service.name}</strong>
                <span>{`${formatCurrency(service.price)}${service.note ? ` / ${service.note}` : ''}`}</span>
              </button>
            ))}
          </div>
        ) : null}
        <NumberStepper
          min={0}
          value={price}
          onChange={setPrice}
          placeholder='Price'
        />
        <NumberStepper
          min={1}
          value={quantity}
          onChange={setQuantity}
          placeholder='Qty'
        />
        <select
          value={warrantyPeriod}
          onChange={(event) => setWarrantyPeriod(event.target.value)}
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
          onClick={submitItem}
        >
          Add {kind}
        </button>
      </div>
    </div>
  );
};

type PaymentModalProps = {
  sale: Sale;
  paymentTargetStatus: PaymentTargetStatus;
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
  onSubmit: (action: PaymentAction) => void;
};

const PaymentModal = ({
  sale,
  paymentTargetStatus,
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
}: PaymentModalProps) => {
  const total = getOrderTotal(sale, lineItems);
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
    paymentTargetStatus === 'completed'
      ? 'Accept and complete'
      : paymentTargetStatus === 'paid'
        ? 'Accept and mark paid'
        : 'Accept and issue';
  const submitWithoutPaymentLabel =
    paymentTargetStatus === 'completed'
      ? 'Complete without payment'
      : paymentTargetStatus === 'paid'
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
  const isIssueDisabled = isLoading || isSaving;

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
              <dt>Discount</dt>
              <dd>0%</dd>
            </div>
            <div>
              <dt>To pay</dt>
              <dd>{formatCurrency(currentPaymentRemaining)}</dd>
            </div>
          </dl>
          <span className='payment-cash-badge'>Cash</span>
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
              <dd>{formatCurrency(Number.isFinite(numericAmount) ? numericAmount : 0)}</dd>
            </div>
          </dl>
          <span className='payment-cash-badge'>Refund</span>
        </div>

        <div className='payment-modal-form'>
          <label className='field payment-cashbox-field'>
            <span>* Cashbox</span>
            <select
              value={selectedCashboxId}
              onChange={(event) => onCashboxChange(event.target.value)}
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
  const productItems = lineItems.filter((item) => item.kind === 'product');
  const serviceItems = lineItems.filter((item) => item.kind !== 'product');
  const productTotal = getLineItemsTotal(productItems);
  const serviceTotal = getLineItemsTotal(serviceItems);
  const numericAmount = Number(amount);
  const minRefund = Math.max(paidAmount - serviceTotal, 0);
  const maxRefund = Math.min(productTotal, paidAmount);
  const suggestedCashboxName =
    cashboxes.find((cashbox) => cashbox.id === selectedCashboxId)?.name ??
    'Cashbox';
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
              <dd>{productItems.map((item) => `${item.name} x${item.quantity}`).join(', ')}</dd>
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
              onChange={(event) => onWarehouseChange(event.target.value)}
              disabled={isLoading || isSaving}
            />
          </label>
          <label className='field payment-cashbox-field'>
            <span>Refund from cashbox</span>
            <select
              value={selectedCashboxId}
              onChange={(event) => onCashboxChange(event.target.value)}
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
}: ReturnLineItemModalProps) => {
  const itemTotal = item.price * item.quantity;
  const numericAmount = Number(amount);
  const suggestedCashboxName =
    cashboxes.find((cashbox) => cashbox.id === selectedCashboxId)?.name ??
    'Cashbox';
  const isSubmitDisabled =
    isLoading ||
    isSaving ||
    !selectedCashboxId ||
    !warehouse.trim() ||
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0 ||
    numericAmount > itemTotal ||
    numericAmount > paidAmount;

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
              onChange={(event) => onWarehouseChange(event.target.value)}
              disabled={isLoading || isSaving}
            />
          </label>
          <label className='field payment-cashbox-field'>
            <span>Refund from cashbox</span>
            <select
              value={selectedCashboxId}
              onChange={(event) => onCashboxChange(event.target.value)}
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
              max={Math.min(itemTotal, paidAmount)}
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
