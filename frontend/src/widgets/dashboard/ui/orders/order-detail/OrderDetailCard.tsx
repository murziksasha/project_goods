import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { hasEmployeePermission } from '../../../../../entities/employee/model/permissions';
import { isRepairOrder } from '../../../../../entities/sale/lib/sale-kind';
import { getSaleProductName } from '../../../../../entities/sale/lib/sale-product';
import { formatCurrency, formatDateTime } from '../../../../../shared/lib/format';
import { getClientDevices } from '../../../../../entities/client-device/api/clientDeviceApi';
import {
  cancelSupplierOrder,
  cancelSupplierOrderItem,
  takeOnChargeSupplierOrder,
  updateSupplierOrder,
} from '../../../../../entities/supplier-order/api/supplierOrderApi';
import type {
  SupplierOrder,
  SupplierOrderStatus,
} from '../../../../../entities/supplier-order/model/types';
import { getWarehouseSettings } from '../../../../../entities/warehouse-settings/api/warehouseSettingsApi';
import { createSupplier, getSuppliers } from '../../../../../entities/supplier/api/supplierApi';
import type { Supplier } from '../../../../../entities/supplier/model/types';
import type { ClientDevice } from '../../../../../entities/client-device/model/types';
import {
  getUnbindClientDeviceAction,
  unbindClientDevice,
} from '../../../../../entities/client-device/lib/unbind-client-device';
import { normalizeDecimalInput, parseDecimal } from '../../../../../shared/lib/decimal';
import { SupplierOrderModal } from '../modals/SupplierOrderModal';
import {
  filterActiveDevicesByQuery,
  getOrderLink,
  toNameKey,
} from '../create-order/create-order-card-shared';
import {
  applySupplierOrderStatusChange,
  isSupplierOrderModalForceReadOnly,
  isSupplierOrderStatusControlDisabled,
} from '../../../model/apply-supplier-order-status-change';
import {
  buildSupplierOrderItemNumber,
  mergeSupplierOrderItemUpdate,
} from '../../../model/supplier-order-utils';
import {
  computeSupplierOrderStatusMenuPosition,
  getSupplierOrderStatusClass,
} from '../../../model/supplier-orders-workspace';
import { SupplierOrderStatusMenuPortal } from '../../supplier-orders/SupplierOrdersWorkspaceSections';
import {
  buildOrderNumber,
  canRefundFromStatus,
  formatPhoneNumber,
  getDiscount,
  formatReadyDate,
  getCreatedTime,
  getOrderBaseTotal,
  getOrderTotal,
  getPrimaryDeviceName,
  getPrimaryDeviceSerial,
  getRemainingPayment,
  getStoredOrderDetailRelatedTab,
  getSupplierOrderStatusLabel,
  hasSaleReturnObligations,
  isRepairDevicePlaceholderLineItem,
  isRepairStatusChangeLockedByStock,
  isSupplierOrderLinkedToSale,
  isSystemTimelineMessage,
  normalizeOrderStatus,
  orderDetailRelatedTabStorageKey,
  isOrderEditableStatus,
  patchOrderDetailSectionState,
  readOrderDetailSectionsState,
  withSupplierOrderLinkNote,
  type OrderStatus,
  type OrdersTab,
  type TimelineEntry,
  isPlainLeftClick,
} from '../workspace/orders-workspace-shared';
import { PrinterIcon } from '../modals/PrinterIcon';
import { OrderDetailDeviceModal } from './OrderDetailDeviceModal';
import { OrderDetailLineItemsPanel } from './OrderDetailLineItemsPanel';
import { OrderDetailNoteSection } from './OrderDetailNoteSection';
import {
  orderDetailRelatedTabs,
  type OrderDetailCardProps,
} from './order-detail-card-types';
import { buildCreatedOrderTimelineMessage } from './order-detail-shared';

export type { OrderDetailCardProps } from './order-detail-card-types';

const COLLAPSE_ICON_EXPANDED = '\u2303';
const COLLAPSE_ICON_COLLAPSED = '\u2304';
const EM_DASH = '\u2014';
const CURRENCY_UAH = '\u20B4';

const COMPACT_LAYOUT_MEDIA_QUERY = '(max-width: 1024px)';
const ORDER_RELATED_LIST_SCROLL_THRESHOLD = 6;

const getIsCompactLayout = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia(COMPACT_LAYOUT_MEDIA_QUERY).matches;

export const OrderDetailCard = ({
  sale,
  sales,
  supplierOrders,
  employees,
  status,
  statusOptions,
  comments,
  lineItems,
  products,
  printForms,
  clientDevices,
  catalogProducts,
  paidAmount,
  isReadOnly,
  canAddComment,
  canAcceptPayment,
  canRefundPayment: canRefundPaymentPermission,
  canCreateOrders,
  canManageSupplierOrders = false,
  onCreateOrder,
  createOrderHref,
  onClose,
  onAddComment,
  onAddLineItem,
  onReplaceLineItem,
  onRemoveLineItem,
  onUpdateLineItem,
  onReturnLineItem,
  onOpenRelatedSale,
  onAcceptPayment,
  onOpenPrint,
  onRefundPayment,
  onDiscountChange,
  onOpenClientCard,
  onSupplierOrderCreated,
  onCreateClientDevice,
  onUpdateClientDevice,
  onDeleteClientDevice,
  onUpdateProductModel,
  onError,
  onSuccess,
  onSaveMainInfo,
  onSaveUserNote,
}: OrderDetailCardProps) => {
  const { t } = useTranslation();
  const isSaleCard = !isRepairOrder(sale);
  const [comment, setComment] = useState('');
  const [isProductsOpen, setIsProductsOpen] = useState(isSaleCard);
  const [isServicesOpen, setIsServicesOpen] = useState(
    isSaleCard ? false : true,
  );
  const [isMainInfoOpen, setIsMainInfoOpen] = useState(true);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isSavingUserNote, setIsSavingUserNote] = useState(false);
  const [isLiveFeedOpen, setIsLiveFeedOpen] = useState(() => !getIsCompactLayout());
  const [isCompactLayout, setIsCompactLayout] = useState(getIsCompactLayout);
  const [statusDraft, setStatusDraft] = useState<OrderStatus>(status);
  const [relatedTab, setRelatedTab] = useState<OrdersTab>(
    getStoredOrderDetailRelatedTab,
  );
  const [deviceNameInput, setDeviceNameInput] = useState('');
  const [serialNumberInput, setSerialNumberInput] = useState('');
  const [masterIdInput, setMasterIdInput] = useState('');
  const [isSavingMainInfo, setIsSavingMainInfo] = useState(false);
  const [mainInfoSaveError, setMainInfoSaveError] = useState<string | null>(
    null,
  );
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [clearSerialOnDeviceApply, setClearSerialOnDeviceApply] =
    useState(false);
  const [isCreatingDevice, setIsCreatingDevice] = useState(false);
  const [unbindingDeviceId, setUnbindingDeviceId] = useState<string | null>(
    null,
  );
  const [deviceLookupSuggestions, setDeviceLookupSuggestions] = useState<
    ClientDevice[]
  >([]);
  const [isDeviceLookupLoading, setIsDeviceLookupLoading] =
    useState(false);
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
  const [relatedDefaultTakeOnChargeWarehouse, setRelatedDefaultTakeOnChargeWarehouse] =
    useState<{ warehouseId: string; locationId: string } | null>(null);
  const [openRelatedStatusOrder, setOpenRelatedStatusOrder] = useState<{
    key: string;
    order: SupplierOrder;
    itemIndex: number;
  } | null>(null);
  const [relatedStatusMenuPosition, setRelatedStatusMenuPosition] = useState<{
    top: number;
    left: number;
    maxHeight: number;
    placement: 'below' | 'above';
  } | null>(null);
  const [relatedWarehouseOptions, setRelatedWarehouseOptions] = useState<
    Array<{
      id: string;
      name: string;
      locations: Array<{ id: string; name: string }>;
    }>
  >([]);
  const total = getOrderBaseTotal(sale, lineItems);
  const discount = getDiscount(sale);
  const [discountInput, setDiscountInput] = useState(String(discount.value));
  const remainingPayment = getRemainingPayment(
    sale,
    paidAmount,
    lineItems,
  );
  const canRefundPayment =
    canRefundPaymentPermission && paidAmount > 0 && canRefundFromStatus(sale, status);
  const productItems = lineItems.filter(
    (item) => item.kind === 'product',
  );
  const serviceItems = lineItems.filter(
    (item) => item.kind === 'service',
  );
  const isProductBlockReadOnly =
    isSaleCard
      ? isReadOnly
      : !isOrderEditableStatus(sale, normalizeOrderStatus(sale.status));
  useEffect(() => {
    const storedState = readOrderDetailSectionsState()[sale.id];
    const productsOpenByDefault = isSaleCard;
    const servicesOpenByDefault = !isSaleCard;
    setIsProductsOpen(
      storedState?.productsOpen ?? productsOpenByDefault,
    );
    setIsServicesOpen(
      storedState?.servicesOpen ?? servicesOpenByDefault,
    );
    setIsMainInfoOpen(storedState?.mainInfoOpen ?? true);
    setIsNoteOpen(storedState?.noteOpen ?? false);
    setIsLiveFeedOpen(
      storedState?.liveFeedOpen ?? !getIsCompactLayout(),
    );
  }, [sale.id, isSaleCard]);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;

    const media = window.matchMedia(COMPACT_LAYOUT_MEDIA_QUERY);
    const handleLayoutChange = () => {
      setIsCompactLayout(media.matches);
    };

    handleLayoutChange();
    media.addEventListener('change', handleLayoutChange);
    return () => media.removeEventListener('change', handleLayoutChange);
  }, []);
  const toggleMainInfoSection = () => {
    setIsMainInfoOpen((current) => {
      const next = !current;
      patchOrderDetailSectionState(sale.id, { mainInfoOpen: next });
      return next;
    });
  };
  const toggleLiveFeedSection = () => {
    setIsLiveFeedOpen((current) => {
      const next = !current;
      patchOrderDetailSectionState(sale.id, { liveFeedOpen: next });
      return next;
    });
  };
  const toggleProductsSection = () => {
    setIsProductsOpen((current) => {
      const next = !current;
      patchOrderDetailSectionState(sale.id, { productsOpen: next });
      return next;
    });
  };
  const toggleServicesSection = () => {
    setIsServicesOpen((current) => {
      const next = !current;
      patchOrderDetailSectionState(sale.id, { servicesOpen: next });
      return next;
    });
  };
  const toggleNoteSection = () => {
    setIsNoteOpen((current) => {
      const next = !current;
      patchOrderDetailSectionState(sale.id, { noteOpen: next });
      return next;
    });
  };
  const canEditUserNote =
    !isReadOnly &&
    isOrderEditableStatus(sale, normalizeOrderStatus(sale.status));
  const toggleDiscountMode = () => {
    if (isReadOnly) return;

    const nextValue = parseDecimal(discountInput);
    onDiscountChange({
      mode: discount.mode === 'percent' ? 'amount' : 'percent',
      value:
        Number.isFinite(nextValue) && nextValue > 0
          ? Math.round(nextValue * 100) / 100
          : discount.value,
    });
  };
  useEffect(() => {
    setStatusDraft(status);
  }, [status]);
  useEffect(() => {
    setMainInfoSaveError(null);
  }, [sale.id, deviceNameInput, serialNumberInput, masterIdInput, statusDraft]);
  useEffect(() => {
    setDiscountInput((current) => {
      const currentValue = parseDecimal(current);
      const roundedCurrentValue = Number.isFinite(currentValue)
        ? Math.round(currentValue * 100) / 100
        : NaN;

      if (current.trim() === '' && discount.value === 0) return current;
      if (roundedCurrentValue === discount.value) return current;

      return String(discount.value);
    });
  }, [discount.mode, discount.value, sale.id]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        orderDetailRelatedTabStorageKey,
        relatedTab,
      );
    } catch {
      // Ignore localStorage write errors.
    }
  }, [relatedTab]);
  useEffect(() => {
    setDeviceNameInput(getPrimaryDeviceName(sale));
    setSerialNumberInput(getPrimaryDeviceSerial(sale));
    setMasterIdInput(sale.master?.id ?? '');
  }, [sale]);
  useEffect(() => {
    if (!isDeviceModalOpen) {
      setDeviceSearch('');
      setNewDeviceName('');
      setClearSerialOnDeviceApply(false);
      setDeviceLookupSuggestions([]);
      setIsDeviceLookupLoading(false);
    }
  }, [isDeviceModalOpen]);
  useEffect(() => {
    const deviceLookupQuery = deviceSearch.trim();
    if (!isDeviceModalOpen || deviceLookupQuery.length < 2) {
      setDeviceLookupSuggestions([]);
      setIsDeviceLookupLoading(false);
      return;
    }

    let isActive = true;
    const timeoutId = window.setTimeout(async () => {
      setIsDeviceLookupLoading(true);
      try {
        const devices = await getClientDevices(deviceLookupQuery);
        if (!isActive) return;
        let suggestions = filterActiveDevicesByQuery(
          devices,
          deviceLookupQuery,
        );

        if (suggestions.length === 0) {
          const allDevices = await getClientDevices('');
          if (!isActive) return;
          suggestions = filterActiveDevicesByQuery(
            allDevices,
            deviceLookupQuery,
          );
        }

        setDeviceLookupSuggestions(suggestions.slice(0, 8));
      } catch {
        if (isActive) setDeviceLookupSuggestions([]);
      } finally {
        if (isActive) setIsDeviceLookupLoading(false);
      }
    }, 350);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [deviceSearch, isDeviceModalOpen]);
  const clientDeviceOptions = useMemo(() => {
    const uniqueByName = new Map<string, ClientDevice>();
    const sourceDevices =
      deviceSearch.trim().length >= 2
        ? deviceLookupSuggestions
        : clientDevices.filter((device) => device.clientId === sale.client.id);

    sourceDevices.forEach((device) => {
      if (!device.isActive) return;
      const key = toNameKey(device.name);
      if (!key || uniqueByName.has(key)) return;
      uniqueByName.set(key, device);
    });
    const query = toNameKey(deviceSearch);
    return Array.from(uniqueByName.values()).filter((device) =>
      query ? filterActiveDevicesByQuery([device], query).length > 0 : true,
    );
  }, [
    clientDevices,
    deviceLookupSuggestions,
    deviceSearch,
    sale.client.id,
  ]);
  const existingDeviceNameKeys = useMemo(
    () =>
      new Set(
        [...clientDevices, ...deviceLookupSuggestions]
          .map((device) => toNameKey(device.name))
          .filter(Boolean),
      ),
    [clientDevices, deviceLookupSuggestions],
  );
  const trimmedNewDeviceName = newDeviceName.trim();
  const canCreateDevice =
    trimmedNewDeviceName.length >= 2 &&
    !existingDeviceNameKeys.has(toNameKey(trimmedNewDeviceName));
  const applyDeviceName = (name: string) => {
    setDeviceNameInput(name.trim());
    if (clearSerialOnDeviceApply) {
      setSerialNumberInput('');
    }
    setIsDeviceModalOpen(false);
  };
  const createAndApplyDevice = async () => {
    if (!canCreateDevice) return;
    setIsCreatingDevice(true);
    try {
      const ok = await onCreateClientDevice({
        clientId: sale.client.id,
        clientName: sale.client.name,
        clientPhone: sale.client.phone,
        name: trimmedNewDeviceName,
        serialNumber: '',
        note: '',
        source: 'repairOrder',
        isActive: true,
      });
      if (ok) {
        applyDeviceName(trimmedNewDeviceName);
      }
    } finally {
      setIsCreatingDevice(false);
    }
  };
  const handleUnbindDevice = async (device: ClientDevice) => {
    if (!device.isActive || unbindingDeviceId) return;

    const action = getUnbindClientDeviceAction(device);
    const confirmMessage =
      action === 'delete'
        ? t('orders.detail.deviceModal.confirmDelete', { name: device.name })
        : t('orders.detail.deviceModal.confirmDeactivate', {
            name: device.name,
          });

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setUnbindingDeviceId(device.id);
    try {
      await unbindClientDevice(device, {
        onDelete: onDeleteClientDevice,
        onUpdate: onUpdateClientDevice,
      });
    } finally {
      setUnbindingDeviceId(null);
    }
  };
  const masterOptions = useMemo(
    () =>
      employees.filter(
        (employee) =>
          employee.isActive &&
          (employee.role === 'master' ||
            hasEmployeePermission(employee, 'repairs.execute')),
      ),
    [employees],
  );
  const isMainInfoDirty =
    deviceNameInput.trim() !== getPrimaryDeviceName(sale).trim() ||
    serialNumberInput.trim().toUpperCase() !== getPrimaryDeviceSerial(sale).trim().toUpperCase() ||
    masterIdInput !== (sale.master?.id ?? '') ||
    statusDraft !== status;
  const isStatusDraftLockedByStock = isRepairStatusChangeLockedByStock(
    sale,
    statusDraft,
    lineItems,
  );
  const hasRepairProductLineItems =
    isRepairOrder(sale) &&
    lineItems
      .filter((item) => !isRepairDevicePlaceholderLineItem(sale, item))
      .some((item) => item.kind === 'product' && item.quantity > 0);
  const isRepairIssuedDraftBlockedByPayment =
    hasRepairProductLineItems &&
    statusDraft === 'issued' &&
    getRemainingPayment(sale, paidAmount, lineItems) > 0;
  const isSaleReturnStatusDraftBlocked =
    !isRepairOrder(sale) &&
    statusDraft === 'returned' &&
    hasSaleReturnObligations(sale, lineItems);
  const isStatusDraftBlocked =
    isStatusDraftLockedByStock ||
    isRepairIssuedDraftBlockedByPayment ||
    isSaleReturnStatusDraftBlocked;
  const getStatusOptionBlockedReason = (statusOption: OrderStatus) => {
    if (
      isRepairStatusChangeLockedByStock(sale, statusOption, lineItems)
    ) {
      return t('orders.payment.stockLocked');
    }
    if (
      hasRepairProductLineItems &&
      statusOption === 'issued' &&
      getRemainingPayment(sale, paidAmount, lineItems) > 0
    ) {
      return t('orders.messages.errors.fullPaymentBeforeIssue');
    }
    if (
      !isRepairOrder(sale) &&
      statusOption === 'returned' &&
      hasSaleReturnObligations(sale, lineItems)
    ) {
      return t('orders.messages.errors.returnProductsFirst');
    }
    return '';
  };
  const getStatusDraftBlockedReason = () => {
    if (isSaleReturnStatusDraftBlocked) {
      return t('orders.messages.errors.returnProductsFirst');
    }
    if (isRepairIssuedDraftBlockedByPayment) {
      return t('orders.messages.errors.fullPaymentBeforeIssue');
    }
    if (isStatusDraftLockedByStock) {
      return t('orders.payment.stockLocked');
    }
    return undefined;
  };
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
  const clientStats = useMemo(() => {
    const stats = relatedRecords.reduce(
      (accumulator, item) => {
        const total = getOrderTotal(item);
        if (isRepairOrder(item)) {
          accumulator.repairsCount += 1;
          accumulator.repairsAmount += total;
        } else {
          accumulator.salesCount += 1;
          accumulator.salesAmount += total;
        }
        return accumulator;
      },
      {
        salesCount: 0,
        salesAmount: 0,
        repairsCount: 0,
        repairsAmount: 0,
      },
    );
    const validCreatedAt = relatedRecords
      .map((item) => ({
        value: item.createdAt,
        time: getCreatedTime(item),
      }))
      .filter((item) => Number.isFinite(item.time));
    const firstContactAt =
      validCreatedAt.length > 0
        ? validCreatedAt.reduce((previous, current) =>
            current.time < previous.time ? current : previous,
          ).value
        : null;
    const lastContactAt =
      validCreatedAt.length > 0
        ? validCreatedAt.reduce((previous, current) =>
            current.time > previous.time ? current : previous,
          ).value
        : null;
    return {
      ...stats,
      totalCount: stats.salesCount + stats.repairsCount,
      totalAmount: stats.salesAmount + stats.repairsAmount,
      firstContactAt,
      lastContactAt,
    };
  }, [relatedRecords]);
  const relatedSupplierOrders = useMemo(
    () =>
      supplierOrders
        .filter((order) => isSupplierOrderLinkedToSale(order, sale))
        .sort(
          (firstItem, secondItem) =>
            new Date(secondItem.createdAt).getTime() -
            new Date(firstItem.createdAt).getTime(),
        ),
    [sale, supplierOrders],
  );
  const relatedSupplierOrderItems = useMemo(
    () =>
      relatedSupplierOrders.flatMap((order) =>
        order.items.map((item) => ({ order, item })),
      ),
    [relatedSupplierOrders],
  );
  const timelineItems = [
    {
      id: `${sale.id}-created`,
      author:
        sale.manager?.name ||
        sale.issuedBy?.name ||
        t('orders.messages.errors.unknownEmployee'),
      message: buildCreatedOrderTimelineMessage(sale, status),
      createdAt: sale.createdAt,
    },
    ...comments,
  ].sort(
    (firstItem, secondItem) =>
      new Date(secondItem.createdAt).getTime() -
      new Date(firstItem.createdAt).getTime(),
  );
  const isCommentComposerDisabled = isReadOnly || !canAddComment;
  const relatedListCount =
    relatedTab === 'supplierOrders'
      ? relatedSupplierOrderItems.length
      : relatedTab === 'supplierInformation'
        ? 0
        : relatedVisibleRecords.length;
  const shouldScrollRelatedList =
    relatedListCount >= ORDER_RELATED_LIST_SCROLL_THRESHOLD;

  const getDateKey = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };

  const formatDateSeparator = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  };

  const timelineDisplay = useMemo(() => {
    const out: Array<
      | { kind: 'sep'; key: string; label: string }
      | { kind: 'msg'; item: TimelineEntry; idx: number }
    > = [];
    let lastKey = '';
    timelineItems.forEach((item, idx) => {
      const key = getDateKey(item.createdAt);
      const label = formatDateSeparator(item.createdAt) || EM_DASH;
      if (key && key !== lastKey) {
        out.push({ kind: 'sep', key: `sep-${key}`, label });
        lastKey = key;
      }
      out.push({ kind: 'msg', item, idx });
    });
    return out;
  }, [timelineItems]);

  const submitComment = () => {
    onAddComment(comment);
    setComment('');
  };
  const getTimelineMessageClassName = (item: TimelineEntry) => {
    if (item.kind === 'manual') return 'order-timeline-message-manual';
    if (item.kind === 'system') return 'order-timeline-message-system';
    return isSystemTimelineMessage(item.message)
      ? 'order-timeline-message-system'
      : 'order-timeline-message-manual';
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

  const loadRelatedSupplierOrderContext = async () => {
    const [suppliersData, warehouseSettings] = await Promise.all([
      getSuppliers(''),
      getWarehouseSettings(),
    ]);
    setRelatedSuppliers(suppliersData);
    const activeWarehouses = warehouseSettings.warehouses.filter(
      (warehouse) => warehouse.isActive,
    );
    setRelatedWarehouseOptions(
      activeWarehouses.map((warehouse) => ({
        id: warehouse.id,
        name: warehouse.name,
        locations: warehouse.locations.map((location) => ({
          id: location.id,
          name: location.name,
        })),
      })),
    );
    const defaultWarehouse = activeWarehouses[0];
    const defaultLocation = defaultWarehouse?.locations[0];
    setRelatedDefaultTakeOnChargeWarehouse(
      defaultWarehouse?.id && defaultLocation?.id
        ? {
            warehouseId: defaultWarehouse.id,
            locationId: defaultLocation.id,
          }
        : null,
    );
  };

  const openRelatedSupplierOrderTakeOnCharge = async (
    order: SupplierOrder,
    itemIndex: number,
  ) => {
    setIsRelatedSupplierOrderOpening(true);
    try {
      await loadRelatedSupplierOrderContext();
      setRelatedSupplierOrderSource(order);
      setRelatedSupplierOrderItemIndex(itemIndex);
      setIsRelatedSupplierOrderModalOpen(true);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('orders.messages.errors.failedOpenSupplierModal'),
      );
    } finally {
      setIsRelatedSupplierOrderOpening(false);
    }
  };

  const openRelatedSupplierOrderStatusMenu = async (
    key: string,
    order: SupplierOrder,
    itemIndex: number,
    rect: DOMRect,
  ) => {
    if (!canManageSupplierOrders) {
      onError(t('orders.supplier.messages.errors.noManagePermission'));
      return;
    }
    if (isSupplierOrderStatusControlDisabled(order, canManageSupplierOrders)) {
      return;
    }
    if (openRelatedStatusOrder?.key === key) {
      setOpenRelatedStatusOrder(null);
      setRelatedStatusMenuPosition(null);
      return;
    }
    try {
      if (!relatedDefaultTakeOnChargeWarehouse) {
        await loadRelatedSupplierOrderContext();
      }
    } catch {
      // status update will report missing warehouse if still unavailable
    }
    setRelatedStatusMenuPosition(computeSupplierOrderStatusMenuPosition(rect));
    setOpenRelatedStatusOrder({ key, order, itemIndex });
  };

  const updateRelatedSupplierOrderStatus = async (
    order: SupplierOrder,
    nextStatus: SupplierOrderStatus,
  ) => {
    await applySupplierOrderStatusChange({
      order,
      nextStatus,
      itemIndex: openRelatedStatusOrder?.itemIndex,
      defaultWarehouse: relatedDefaultTakeOnChargeWarehouse,
      takeOnCharge: async ({
        supplierOrderId,
        autoGenerateSerialNumbers,
        serialNumbers,
        autoGenerateArticles,
        articleBase,
        warehouseId,
        locationId,
        itemIndex,
      }) => {
        const result = await takeOnChargeSupplierOrder(supplierOrderId, {
          autoGenerateSerialNumbers,
          serialNumbers,
          autoGenerateArticles,
          articleBase,
          warehouseId,
          locationId,
          ...(itemIndex === undefined ? {} : { itemIndex }),
        });
        window.dispatchEvent(new Event('project-goods:finance-updated'));
        window.dispatchEvent(new Event('project-goods:products-updated'));
        await onSupplierOrderCreated();
        return result;
      },
      updateOrder: async ({
        supplierOrderId,
        order: source,
        nextStatus: status,
      }) => {
        await updateSupplierOrder(supplierOrderId, {
          orderBaseId: source.orderBaseId,
          supplierId: source.supplierId,
          deliveryDate: source.deliveryDate.slice(0, 10),
          supplyType: source.supplyType,
          number: source.number,
          note: source.note,
          createdBy: source.createdBy,
          status,
          items: source.items,
        });
        await onSupplierOrderCreated();
      },
      translate: t,
      onSuccess,
      onError,
      notifyFinanceUpdated: () => {
        window.dispatchEvent(new Event('project-goods:finance-updated'));
      },
    });
    setOpenRelatedStatusOrder(null);
    setRelatedStatusMenuPosition(null);
  };

  useEffect(() => {
    if (!openRelatedStatusOrder) return;

    const closeOnOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('.supplier-order-status-menu-portal')) return;
      if (target.closest('[data-related-supplier-order-status-trigger]')) return;
      setOpenRelatedStatusOrder(null);
      setRelatedStatusMenuPosition(null);
    };
    const closeOnResize = () => {
      setOpenRelatedStatusOrder(null);
      setRelatedStatusMenuPosition(null);
    };

    document.addEventListener('mousedown', closeOnOutside);
    window.addEventListener('resize', closeOnResize);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      window.removeEventListener('resize', closeOnResize);
    };
  }, [openRelatedStatusOrder]);

  return (
    <article
      className='order-detail-card'
      aria-label={
        isSaleCard
          ? t('orders.detail.saleCard')
          : t('orders.detail.orderCard')
      }
    >
      <header className='order-detail-header order-detail-header-sticky'>
        <div className='order-detail-title'>
          <div className='order-detail-title-label-row'>
            <span className='section-label'>
              {isSaleCard
                ? t('orders.detail.saleCard')
                : t('orders.detail.orderCard')}
            </span>
            <button
              type='button'
              className='toolbar-square-button order-print-icon-button order-header-print-button'
              onClick={onOpenPrint}
              aria-label={
                isSaleCard
                  ? t('orders.detail.printSale')
                  : t('orders.detail.printOrder')
              }
              title={
                isSaleCard
                  ? t('orders.detail.printSale')
                  : t('orders.detail.printOrder')
              }
            >
              <PrinterIcon />
            </button>
          </div>
          <h2>{sale.recordNumber ?? 'r------'}</h2>
          <p className='order-detail-header-meta'>
            <span className='order-detail-header-meta-label'>
              {t('orders.payment.toPay')}
            </span>
            <strong className='order-detail-header-remaining'>
              {formatCurrency(remainingPayment)}
            </strong>
          </p>
        </div>
        <button
          type='button'
          className='create-order-close order-detail-close-button'
          onClick={onClose}
          aria-label={t('orders.detail.closeOrderCard')}
        >
          &times;
        </button>
        <div className='order-detail-actions'>
          <div className='order-detail-status-field'>
            <select
              id={`order-status-${sale.id}`}
              className='order-detail-status-select'
              value={statusDraft}
              onChange={(event) => {
                setStatusDraft(event.target.value as OrderStatus);
              }}
              aria-label={t('orders.detail.repairStatus')}
              aria-describedby={
                isStatusDraftBlocked
                  ? `order-status-hint-${sale.id}`
                  : undefined
              }
              disabled={isReadOnly}
              title={
                isStatusDraftBlocked
                  ? getStatusDraftBlockedReason()
                  : undefined
              }
            >
            {statusOptions.map((statusOption) => {
              const blockedReason = getStatusOptionBlockedReason(
                statusOption.key,
              );
              return (
                <option
                  key={statusOption.key}
                  value={statusOption.key}
                  disabled={Boolean(blockedReason)}
                >
                  {t(statusOption.labelKey)}
                </option>
              );
            })}
            </select>
            {isStatusDraftBlocked ? (
              <p
                id={`order-status-hint-${sale.id}`}
                className='inline-field-error'
                role='alert'
              >
                {getStatusDraftBlockedReason()}
              </p>
            ) : null}
          </div>
          <div className='order-detail-header-actions'>
            <button
              type='button'
              className='primary-button order-detail-header-pay-button'
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onAcceptPayment();
              }}
              disabled={remainingPayment <= 0 || isReadOnly || !canAcceptPayment}
            >
              {remainingPayment <= 0
                ? t('orders.payment.paid')
                : t('orders.payment.acceptPayment')}
            </button>
            <a
              className={
                canCreateOrders
                  ? 'orders-create-button order-detail-create-button'
                  : 'orders-create-button order-detail-create-button orders-create-button-disabled'
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
                onCreateOrder();
              }}
              title={
                canCreateOrders
                  ? t('orders.toolbar.createOrder')
                  : t('orders.toolbar.createOrderDenied')
              }
            >
              {t('orders.toolbar.createOrder')}
            </a>
          </div>
        </div>
      </header>

      <div className='order-detail-grid'>
        <section className='order-detail-panel order-detail-main-panel'>
          <button
            type='button'
            className='order-detail-collapse-button order-detail-main-info-toggle'
            onClick={() => {
              if (isCompactLayout) {
                toggleMainInfoSection();
              }
            }}
            aria-expanded={isMainInfoOpen || !isCompactLayout}
          >
            <span>{t('orders.detail.mainInformation')}</span>
            <span className='order-detail-collapse-icon' aria-hidden='true'>
              {isMainInfoOpen ? COLLAPSE_ICON_EXPANDED : COLLAPSE_ICON_COLLAPSED}
            </span>
          </button>
          {isMainInfoOpen || !isCompactLayout ? (
          <dl className='order-detail-list'>
            <div>
              <dt>{t('orders.detail.client')}</dt>
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
              <dt>{t('orders.detail.phone')}</dt>
              <dd>{formatPhoneNumber(sale.client.phone)}</dd>
            </div>
            {isSaleCard ? null : (
              <>
                <div>
                  <dt>{t('orders.detail.device')}</dt>
                  <dd>
                    <button
                      type='button'
                      className='order-detail-device-button'
                      onClick={() => setIsDeviceModalOpen(true)}
                      disabled={isReadOnly}
                      aria-label={t('orders.detail.changeDevice')}
                    >
                      <span>{deviceNameInput || '-'}</span>
                      <small>{t('orders.detail.change')}</small>
                    </button>
                  </dd>
                </div>
                <div>
                  <dt>{t('orders.detail.serialNumberShort')}</dt>
                  <dd className='order-detail-serial-value'>
                    <span>{serialNumberInput || '-'}</span>
                  </dd>
                </div>
              </>
            )}
            <div>
              <dt>{t('orders.detail.created')}</dt>
              <dd>{formatDateTime(sale.createdAt)}</dd>
            </div>
            <div>
              <dt>
                {isSaleCard
                  ? t('orders.detail.createdOrder')
                  : t('orders.detail.manager')}
              </dt>
              <dd>{sale.manager?.name || '-'}</dd>
            </div>
            {isSaleCard ? null : (
              <div>
                <dt>{t('orders.detail.master')}</dt>
                <dd>
                  <select
                    className='order-detail-master-select'
                    value={masterIdInput}
                    onChange={(event) => setMasterIdInput(event.target.value)}
                  >
                    <option value=''>{t('orders.detail.selectMaster')}</option>
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
                <dt>{t('orders.detail.issuedOrder')}</dt>
                <dd>{sale.issuedBy?.name || '-'}</dd>
              </div>
            ) : (
              <div>
                <dt>{t('orders.detail.issued')}</dt>
                <dd>{sale.issuedBy?.name || '-'}</dd>
              </div>
            )}
            {isMainInfoDirty ? (
              <div className='order-detail-notes-row'>
                <dt>&nbsp;</dt>
                <dd>
                  <div className='order-detail-save-actions'>
                    <button
                      type='button'
                      className='primary-button'
                      disabled={
                        isSavingMainInfo ||
                        isReadOnly ||
                        isStatusDraftBlocked
                      }
                      title={
                        isStatusDraftBlocked
                          ? getStatusDraftBlockedReason()
                          : undefined
                      }
                      onClick={async () => {
                        setIsSavingMainInfo(true);
                        setMainInfoSaveError(null);
                        try {
                          await onSaveMainInfo({
                            deviceName: deviceNameInput.trim(),
                            serialNumber: serialNumberInput.trim().toUpperCase(),
                            masterId: masterIdInput,
                            status: statusDraft,
                          });
                        } catch (error) {
                          setMainInfoSaveError(
                            error instanceof Error
                              ? error.message
                              : t('orders.detail.saveFailedInline'),
                          );
                        } finally {
                          setIsSavingMainInfo(false);
                        }
                      }}
                    >
                      {isSavingMainInfo
                        ? t('orders.payment.saving')
                        : t('orders.detail.saveChanges')}
                    </button>
                    {mainInfoSaveError ? (
                      <p className='inline-field-error' role='alert'>
                        {mainInfoSaveError}
                      </p>
                    ) : null}
                  </div>
                </dd>
              </div>
            ) : null}
          </dl>
          ) : null}
        </section>

        <section
          className={
            isLiveFeedOpen
              ? 'order-detail-panel order-detail-live-panel order-detail-live-panel-expanded'
              : 'order-detail-panel order-detail-live-panel order-detail-live-panel-collapsed'
          }
        >
          <button
            type='button'
            className='order-detail-collapse-button order-detail-live-feed-toggle'
            onClick={() => {
              if (isCompactLayout) {
                toggleLiveFeedSection();
              }
            }}
            aria-expanded={isLiveFeedOpen || !isCompactLayout}
          >
            <span>{t('orders.detail.liveFeed')}</span>
            <span className='order-detail-collapse-icon' aria-hidden='true'>
              {isLiveFeedOpen ? COLLAPSE_ICON_EXPANDED : COLLAPSE_ICON_COLLAPSED}
            </span>
          </button>
          {isLiveFeedOpen || !isCompactLayout ? (
          <div className='order-timeline'>
            <div className='order-timeline-list'>
            {timelineDisplay.map((entry) =>
              entry.kind === 'sep' ? (
                <div key={entry.key} className="order-timeline-date-separator">
                  ---   {entry.label}  ---
                </div>
              ) : (
                <div
                  key={`${entry.item.id}-${entry.idx}`}
                  className="order-timeline-item"
                >
                  <span>
                    {new Date(entry.item.createdAt).toLocaleTimeString(
                      'uk-UA',
                      { hour: '2-digit', minute: '2-digit' },
                    )}
                  </span>
                  <p>
                    <strong>{entry.item.author}</strong>
                    <small className={getTimelineMessageClassName(entry.item)}>
                      {entry.item.message}
                    </small>
                  </p>
                </div>
              )
            )}
            </div>
            <div className='order-timeline-composer'>
            <textarea
              placeholder={t('orders.detail.comment')}
              rows={2}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              disabled={isCommentComposerDisabled}
            />
            <button
              type='button'
              className='primary-button'
              onClick={submitComment}
              disabled={!comment.trim() || isCommentComposerDisabled}
            >
              {t('orders.detail.add')}
            </button>
            </div>
          </div>
          ) : null}
        </section>

        <section className='order-detail-panel order-detail-line-items-panel order-detail-products-panel'>
          <button
            type='button'
            className='order-detail-collapse-button'
            onClick={toggleProductsSection}
            aria-expanded={isProductsOpen}
          >
            <span>{t('orders.detail.products')}</span>
            <span className='order-detail-collapse-icon' aria-hidden='true'>
              {isProductsOpen ? COLLAPSE_ICON_EXPANDED : COLLAPSE_ICON_COLLAPSED}
            </span>
          </button>
          {isProductsOpen ? (
            <OrderDetailLineItemsPanel
              kind='product'
              sales={sales}
              currentSaleId={sale.id}
              currentSaleRecordNumber={sale.recordNumber ?? undefined}
              currentClientId={sale.client.id}
              currentStatus={status}
              items={productItems}
              allItems={lineItems}
              products={products}
              printForms={printForms}
              catalogProducts={catalogProducts}
              onUpdateProductModel={onUpdateProductModel}
              onAddItem={onAddLineItem}
              onReplaceItem={onReplaceLineItem}
              onRemoveItem={onRemoveLineItem}
              onUpdateItem={onUpdateLineItem}
              onReturnItem={onReturnLineItem}
              paidAmount={paidAmount}
              discount={getDiscount(sale)}
              onError={onError}
              onSuccess={onSuccess}
              onSupplierOrderCreated={onSupplierOrderCreated}
              isReadOnly={isProductBlockReadOnly}
            />
          ) : null}
        </section>

        <section className='order-detail-panel order-detail-line-items-panel'>
          <button
            type='button'
            className='order-detail-collapse-button'
            onClick={toggleServicesSection}
            aria-expanded={isServicesOpen}
          >
            <span>{t('orders.detail.services')}</span>
            <span className='order-detail-collapse-icon' aria-hidden='true'>
              {isServicesOpen ? COLLAPSE_ICON_EXPANDED : COLLAPSE_ICON_COLLAPSED}
            </span>
          </button>
          {isServicesOpen ? (
            <OrderDetailLineItemsPanel
              kind='service'
              sales={sales}
              currentSaleId={sale.id}
              currentSaleRecordNumber={sale.recordNumber ?? undefined}
              currentClientId={sale.client.id}
              currentStatus={status}
              items={serviceItems}
              allItems={lineItems}
              products={products}
              printForms={printForms}
              catalogProducts={catalogProducts}
              onUpdateProductModel={onUpdateProductModel}
              onAddItem={onAddLineItem}
              onReplaceItem={onReplaceLineItem}
              onRemoveItem={onRemoveLineItem}
              onUpdateItem={onUpdateLineItem}
              onReturnItem={onReturnLineItem}
              paidAmount={paidAmount}
              discount={getDiscount(sale)}
              onError={onError}
              onSuccess={onSuccess}
              onSupplierOrderCreated={onSupplierOrderCreated}
              isReadOnly={isReadOnly}
            />
          ) : null}
        </section>

        <section className='order-detail-panel order-detail-payment-panel'>
          <h3>{t('orders.detail.payment')}</h3>
          <dl className='order-payment-list'>
            <div>
              <dt>{t('orders.payment.repairCost')}</dt>
              <dd>{formatCurrency(total)}</dd>
            </div>
            <div>
              <dt>
                <span className='payment-summary-discount-label'>
                  {t('orders.payment.discount')}
                  <button
                    type='button'
                    className='payment-summary-discount-badge'
                    onClick={toggleDiscountMode}
                    aria-label={t('orders.payment.toggleDiscountMode')}
                    disabled={isReadOnly}
                  >
                    {discount.mode === 'percent' ? '%' : CURRENCY_UAH}
                  </button>
                </span>
              </dt>
              <dd>
                <div className='order-payment-discount-control'>
                  <input
                    type='text'
                    inputMode='decimal'
                    value={discountInput}
                    onChange={(event) => {
                      const nextInput = normalizeDecimalInput(event.target.value);
                      const nextValue = parseDecimal(nextInput);
                      setDiscountInput(nextInput);

                      if (nextInput === '') {
                        onDiscountChange({
                          mode: discount.mode,
                          value: 0,
                        });
                        return;
                      }
                      if (!Number.isFinite(nextValue)) return;

                      onDiscountChange({
                        mode: discount.mode,
                        value: nextValue > 0
                          ? Math.round(nextValue * 100) / 100
                          : 0,
                      });
                    }}
                    disabled={isReadOnly}
                  />
                  <button
                    type='button'
                    className='order-payment-discount-mode'
                    onClick={toggleDiscountMode}
                    aria-label={t('orders.payment.toggleDiscountMode')}
                    disabled={isReadOnly}
                  >
                    {discount.mode === 'percent' ? '%' : CURRENCY_UAH}
                  </button>
                </div>
              </dd>
            </div>
            <div>
              <dt>{t('orders.payment.paid')}</dt>
              <dd>{formatCurrency(paidAmount)}</dd>
            </div>
            <div>
              <dt>{t('orders.payment.toPay')}</dt>
              <dd>{formatCurrency(remainingPayment)}</dd>
            </div>
          </dl>
          <button
            type='button'
            className='primary-button'
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onAcceptPayment();
            }}
            disabled={remainingPayment <= 0 || isReadOnly || !canAcceptPayment}
          >
            {remainingPayment <= 0
              ? t('orders.payment.paid')
              : t('orders.payment.acceptPayment')}
          </button>
          {paidAmount > 0 ? (
            <button
              type='button'
              className='secondary-button'
              onClick={onRefundPayment}
              disabled={!canRefundPayment || (isReadOnly && status !== 'issued')}
            >
              {t('orders.payment.refundToClient')}
            </button>
          ) : null}
        </section>

        <OrderDetailNoteSection
          saleId={sale.id}
          isSaleCard={isSaleCard}
          systemNote={sale.note}
          userNote={sale.userNote ?? ''}
          isNoteOpen={isNoteOpen}
          canEdit={canEditUserNote}
          isSaving={isSavingUserNote}
          onToggle={toggleNoteSection}
          onSaveUserNote={async (userNote) => {
            setIsSavingUserNote(true);
            try {
              await onSaveUserNote(userNote);
            } finally {
              setIsSavingUserNote(false);
            }
          }}
        />

        <section className='order-detail-panel order-detail-related-panel'>
          <div className='order-related-tabs'>
            {orderDetailRelatedTabs.map((tab) => (
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
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
          <div
            className={
              shouldScrollRelatedList
                ? 'order-related-list order-related-list-scrollable'
                : 'order-related-list'
            }
          >
            {relatedTab === 'supplierOrders' ? (
              relatedSupplierOrderItems.length === 0 ? (
                <p>{t('orders.detail.noSupplierOrdersLinked')}</p>
              ) : (
                relatedSupplierOrderItems.map(({ order, item }) => {
                  const rowKey = `${order.id}-${item.itemIndex}`;
                  const statusDisabled = isSupplierOrderStatusControlDisabled(
                    order,
                    canManageSupplierOrders,
                  );
                  return (
                    <div
                      key={rowKey}
                      className='order-related-item order-related-item-supplier'
                    >
                      <button
                        type='button'
                        className='order-related-supplier-open'
                        onClick={() =>
                          void openRelatedSupplierOrderTakeOnCharge(
                            order,
                            item.itemIndex,
                          )
                        }
                        disabled={isRelatedSupplierOrderOpening}
                      >
                        <span>
                          {buildSupplierOrderItemNumber(
                            order,
                            item.itemIndex,
                          )}
                        </span>
                        <strong>
                          {item.productName.trim() || '-'}
                        </strong>
                        <span>
                          {formatCurrency(item.quantity * item.price)}
                        </span>
                        <span>{formatReadyDate(order.createdAt)}</span>
                      </button>
                      <div className='supplier-order-status-picker order-related-supplier-status'>
                        <button
                          type='button'
                          className={getSupplierOrderStatusClass(order.status)}
                          data-related-supplier-order-status-trigger={rowKey}
                          disabled={statusDisabled}
                          aria-expanded={
                            openRelatedStatusOrder?.key === rowKey
                          }
                          aria-haspopup='listbox'
                          onClick={(event) => {
                            event.stopPropagation();
                            void openRelatedSupplierOrderStatusMenu(
                              rowKey,
                              order,
                              item.itemIndex,
                              event.currentTarget.getBoundingClientRect(),
                            );
                          }}
                        >
                          {getSupplierOrderStatusLabel(order.status)}
                        </button>
                      </div>
                    </div>
                  );
                })
              )
            ) : relatedTab === 'supplierInformation' ? (
              <dl className='order-payment-list order-related-stats-list'>
                <div>
                  <dt>{t('orders.detail.stats.ordersSales')}</dt>
                  <dd>
                    {clientStats.salesCount} | {formatCurrency(clientStats.salesAmount)}
                  </dd>
                </div>
                <div>
                  <dt>{t('orders.detail.stats.repairOrders')}</dt>
                  <dd>
                    {clientStats.repairsCount} | {formatCurrency(clientStats.repairsAmount)}
                  </dd>
                </div>
                <div>
                  <dt>{t('orders.detail.stats.total')}</dt>
                  <dd>
                    {clientStats.totalCount} | {formatCurrency(clientStats.totalAmount)}
                  </dd>
                </div>
                <div>
                  <dt>{t('orders.detail.stats.firstContact')}</dt>
                  <dd>
                    {clientStats.firstContactAt
                      ? formatReadyDate(clientStats.firstContactAt)
                      : '-'}
                  </dd>
                </div>
                <div>
                  <dt>{t('orders.detail.stats.lastContact')}</dt>
                  <dd>
                    {clientStats.lastContactAt
                      ? formatReadyDate(clientStats.lastContactAt)
                      : '-'}
                  </dd>
                </div>
              </dl>
            ) : relatedVisibleRecords.length === 0 ? (
              <p>
                {relatedTab === 'orders'
                  ? t('orders.detail.noOrdersForClient')
                  : t('orders.detail.noSalesForClient')}
              </p>
            ) : (
              relatedVisibleRecords.map((record) => (
                <a
                  key={record.id}
                  className='order-related-item'
                  href={getOrderLink(record.id, record.kind)}
                  onClick={(event) => {
                    if (
                      event.button !== 0 ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    ) {
                      return;
                    }
                    event.preventDefault();
                    onOpenRelatedSale(record);
                  }}
                >
                  <span>{buildOrderNumber(record)}</span>
                  <strong>{getSaleProductName(record, t('orders.fallbacks.product'))}</strong>
                  <span>{formatCurrency(getOrderTotal(record))}</span>
                  <span>{formatReadyDate(record.createdAt)}</span>
                </a>
              ))
            )}
          </div>
        </section>
      </div>
      {isDeviceModalOpen ? (
        <OrderDetailDeviceModal
          deviceSearch={deviceSearch}
          newDeviceName={newDeviceName}
          clearSerialOnDeviceApply={clearSerialOnDeviceApply}
          isDeviceLookupLoading={isDeviceLookupLoading}
          isCreatingDevice={isCreatingDevice}
          canCreateDevice={canCreateDevice}
          unbindingDeviceId={unbindingDeviceId}
          clientDeviceOptions={clientDeviceOptions}
          onDeviceSearchChange={setDeviceSearch}
          onNewDeviceNameChange={setNewDeviceName}
          onClearSerialOnDeviceApplyChange={setClearSerialOnDeviceApply}
          onClose={() => setIsDeviceModalOpen(false)}
          onApplyDeviceName={applyDeviceName}
          onUnbindDevice={handleUnbindDevice}
          onCreateAndApply={() => void createAndApplyDevice()}
        />
      ) : null}
      <SupplierOrderStatusMenuPortal
        openStatusOrder={
          openRelatedStatusOrder
            ? {
                key: openRelatedStatusOrder.key,
                order: openRelatedStatusOrder.order,
              }
            : null
        }
        statusMenuPosition={relatedStatusMenuPosition}
        onUpdateStatus={(order, status) =>
          void updateRelatedSupplierOrderStatus(order, status)
        }
      />
      <SupplierOrderModal
        isOpen={isRelatedSupplierOrderModalOpen}
        suppliers={relatedSuppliers}
        editingOrder={selectedRelatedSupplierOrder}
        warehouseOptions={relatedWarehouseOptions}
        forceReadOnly={isSupplierOrderModalForceReadOnly(
          canManageSupplierOrders,
        )}
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
                : t('orders.messages.errors.failedCreateSupplier'),
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
          const result = await takeOnChargeSupplierOrder(relatedSupplierOrderSource.id, {
            autoGenerateSerialNumbers,
            serialNumbers,
            autoGenerateArticles,
            articleBase: articleBase.trim().toUpperCase(),
            itemIndex: relatedSupplierOrderItemIndex,
            warehouseId,
            locationId,
          });
          onSuccess(t('orders.messages.success.takenOnCharge'));
          window.dispatchEvent(new Event('project-goods:finance-updated'));
          window.dispatchEvent(new Event('project-goods:products-updated'));
          await onSupplierOrderCreated();
          setIsRelatedSupplierOrderModalOpen(false);
          setRelatedSupplierOrderSource(null);
          setRelatedSupplierOrderItemIndex(null);
          return result;
        }}
        onCancelOrder={async () => {
          if (
            !relatedSupplierOrderSource ||
            relatedSupplierOrderItemIndex === null
          ) {
            return;
          }
          try {
            await cancelSupplierOrder(relatedSupplierOrderSource.id);
            onSuccess(t('orders.messages.success.orderCancelled'));
            await onSupplierOrderCreated();
            setIsRelatedSupplierOrderModalOpen(false);
            setRelatedSupplierOrderSource(null);
            setRelatedSupplierOrderItemIndex(null);
          } catch (error) {
            onError(
              error instanceof Error
                ? error.message
                : t('orders.messages.errors.failedRemoveSupplierOrder'),
            );
          }
        }}
        onCancelItem={async (reason) => {
          if (
            !relatedSupplierOrderSource ||
            relatedSupplierOrderItemIndex === null
          ) {
            return;
          }
          try {
            await cancelSupplierOrderItem(relatedSupplierOrderSource.id, {
              itemIndex: relatedSupplierOrderItemIndex,
              reason,
            });
            onSuccess(t('orders.supplier.messages.success.itemCancelled'));
            await onSupplierOrderCreated();
            setIsRelatedSupplierOrderModalOpen(false);
            setRelatedSupplierOrderSource(null);
            setRelatedSupplierOrderItemIndex(null);
          } catch (error) {
            onError(
              error instanceof Error
                ? error.message
                : t('orders.messages.errors.failedRemoveSupplierOrder'),
            );
          }
        }}
        isItemScopedView={
          relatedSupplierOrderSource !== null &&
          relatedSupplierOrderSource.items.length > 1
        }
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
              sale.recordNumber ?? sale.id,
              sale.client.id,
            ),
            createdBy: relatedSupplierOrderSource.createdBy,
            status: relatedSupplierOrderSource.status,
            paymentStatus: relatedSupplierOrderSource.paymentStatus,
            items: mergedItems,
          });
          onSuccess(t('orders.messages.success.supplierOrderUpdated'));
          await onSupplierOrderCreated();
        }}
      />
    </article>
  );
};
