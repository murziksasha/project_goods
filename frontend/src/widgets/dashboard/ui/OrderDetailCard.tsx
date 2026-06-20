import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Employee } from '../../../entities/employee/model/types';
import { hasEmployeePermission } from '../../../entities/employee/model/permissions';
import type { Sale } from '../../../entities/sale/model/types';
import { isRepairOrder } from '../../../entities/sale/lib/sale-kind';
import { getSaleProductName } from '../../../entities/sale/lib/sale-product';
import { formatCurrency, formatDateTime } from '../../../shared/lib/format';
import {
  createServiceCatalogItem,
  getServiceCatalogItems,
  updateServiceCatalogItem,
} from '../../../entities/service-catalog/api/serviceCatalogApi';
import { getClientDevices } from '../../../entities/client-device/api/clientDeviceApi';
import type { ServiceCatalogItem } from '../../../entities/service-catalog/model/types';
import {
  initialServiceCatalogForm,
  toServiceCatalogForm,
} from '../../../entities/service-catalog/model/forms';
import { getProducts } from '../../../entities/product/api/productApi';
import {
  cancelSupplierOrder,
  createSupplierOrder,
  takeOnChargeSupplierOrder,
  updateSupplierOrder,
} from '../../../entities/supplier-order/api/supplierOrderApi';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
import { getWarehouseSettings } from '../../../entities/warehouse-settings/api/warehouseSettingsApi';
import { createSupplier, getSuppliers } from '../../../entities/supplier/api/supplierApi';
import type { Supplier, SupplierFormValues } from '../../../entities/supplier/model/types';
import type { SupplierOrderFormValues } from '../../../entities/supplier-order/model/types';
import type { Product, ProductModelUpdatePayload } from '../../../entities/product/model/types';
import type { CatalogProduct } from '../../../entities/catalog-product/model/types';
import type { ClientDevice, ClientDeviceFormValues } from '../../../entities/client-device/model/types';
import { NumberStepper } from '../../../shared/ui/NumberStepper';
import { normalizeDecimalInput, parseDecimal } from '../../../shared/lib/decimal';
import { SupplierOrderModal, type SupplierOrderModalSubmitPayload } from './SupplierOrderModal';
import { ProductModelModal } from './ProductModelModal';
import {
  filterActiveDevicesByQuery,
  getOrderLink,
  toNameKey,
} from './create-order-card-shared';
import type { WarehouseItem } from '../../../entities/warehouse-settings/model/types';
import { buildMissingServicePayload, shouldCreateMissingServiceOnSubmit } from '../model/missingService';
import { buildSupplierOrderItemNumber, mergeSupplierOrderItemUpdate } from '../model/supplier-order-utils';
import { canRemoveLineItemAfterPayment } from '../model/line-item-ops';
import {
  buildSerializedProductLineItem,
  getProductSerialAvailability,
  getSaleSerialUsage,
  normalizeSerialNumber,
  type ProductSerialAvailability,
  type SerialUsage,
} from '../model/order-line-serials';
import {
  buildOrderNumber,
  canRefundFromStatus,
  extractLinkedClientIdFromSupplierOrder,
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
  buildCreatedOrderTimelineMessage,
  getSupplierOrderStatusLabel,
  hasSaleReturnObligations,
  isProductAvailableForOrder,
  isRepairDevicePlaceholderLineItem,
  isRepairStatusChangeLockedByStock,
  isSupplierOrderLinkedToSale,
  isSystemTimelineMessage,
  normalizeOrderStatus,
  normalizeProductLookupValue,
  orderDetailRelatedTabStorageKey,
  orderTabs,
  isOrderEditableStatus,
  readOrderDetailSectionsState,
  stockLockedRepairStatuses,
  getWarrantyOptions,
  withSupplierOrderLinkNote,
  writeOrderDetailSectionsState,
  type OrderLineItem,
  type OrderLineItemKind,
  type OrderStatus,
  type OrdersTab,
  type RepairStatus,
  type TimelineEntry,
} from './orders-workspace-shared';
import { PrinterIcon } from './PrinterIcon';
type OrderDetailCardProps = {
  sale: Sale;
  sales: Sale[];
  supplierOrders: SupplierOrder[];
  employees: Employee[];
  status: OrderStatus;
  statusOptions: Array<{ key: OrderStatus; labelKey: string }>;
  comments: TimelineEntry[];
  lineItems: OrderLineItem[];
  products: Product[];
  clientDevices: ClientDevice[];
  catalogProducts: CatalogProduct[];
  paidAmount: number;
  isReadOnly: boolean;
  canAddComment: boolean;
  canAcceptPayment: boolean;
  canRefundPayment: boolean;
  onClose: () => void;
  onAddComment: (comment: string) => void;
  onAddLineItem: (item: Omit<OrderLineItem, 'id'>) => void;
  onReplaceLineItem: (
    itemId: string,
    itemIndex: number | undefined,
    items: Array<Omit<OrderLineItem, 'id'>>,
  ) => void;
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
  onOpenPrint: () => void;
  onRefundPayment: () => void;
  onDiscountChange: (discount: {
    mode: 'percent' | 'amount';
    value: number;
  }) => void;
  onOpenClientCard: () => void;
  onSupplierOrderCreated: () => Promise<void>;
  onCreateClientDevice: (payload: ClientDeviceFormValues) => Promise<boolean>;
  onUpdateProductModel: (payload: ProductModelUpdatePayload) => Promise<boolean>;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  onSaveMainInfo: (payload: {
    deviceName: string;
    serialNumber: string;
    masterId: string;
    status: OrderStatus;
  }) => Promise<void>;
};

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
  clientDevices,
  catalogProducts,
  paidAmount,
  isReadOnly,
  canAddComment,
  canAcceptPayment,
  canRefundPayment: canRefundPaymentPermission,
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
  onUpdateProductModel,
  onError,
  onSuccess,
  onSaveMainInfo,
}: OrderDetailCardProps) => {
  const { t } = useTranslation();
  const isSaleCard = !isRepairOrder(sale);
  const [comment, setComment] = useState('');
  const [isProductsOpen, setIsProductsOpen] = useState(isSaleCard);
  const [isServicesOpen, setIsServicesOpen] = useState(
    isSaleCard ? false : true,
  );
  const [statusDraft, setStatusDraft] = useState<OrderStatus>(status);
  const [relatedTab, setRelatedTab] = useState<OrdersTab>(
    getStoredOrderDetailRelatedTab,
  );
  const [deviceNameInput, setDeviceNameInput] = useState('');
  const [serialNumberInput, setSerialNumberInput] = useState('');
  const [masterIdInput, setMasterIdInput] = useState('');
  const [isSavingMainInfo, setIsSavingMainInfo] = useState(false);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [clearSerialOnDeviceApply, setClearSerialOnDeviceApply] =
    useState(false);
  const [isCreatingDevice, setIsCreatingDevice] = useState(false);
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
  }, [sale.id, isSaleCard]);
  useEffect(() => {
    const current = readOrderDetailSectionsState();
    writeOrderDetailSectionsState({
      ...current,
      [sale.id]: {
        productsOpen: isProductsOpen,
        servicesOpen: isServicesOpen,
      },
    });
  }, [sale.id, isProductsOpen, isServicesOpen]);
  useEffect(() => {
    setStatusDraft(status);
  }, [status]);
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
      return isSupplierOrderLinkedToSale(order, sale);
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
  }, [
    sale,
    saleProductNames,
    supplierOrders,
  ]);
  const hasExplicitSaleSupplierLinks = useMemo(
    () =>
      relatedSupplierOrders.some(
        (order) => isSupplierOrderLinkedToSale(order, sale),
      ),
    [relatedSupplierOrders, sale],
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
          : t('orders.messages.errors.failedOpenSupplierModal'),
      );
    } finally {
      setIsRelatedSupplierOrderOpening(false);
    }
  };

  return (
    <article
      className='order-detail-card'
      aria-label={
        isSaleCard
          ? t('orders.detail.saleCard')
          : t('orders.detail.orderCard')
      }
    >
      <header className='order-detail-header'>
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
        </div>
        <div className='order-detail-actions'>
          <select
            value={statusDraft}
            onChange={(event) => {
              setStatusDraft(event.target.value as OrderStatus);
            }}
            aria-label={t('orders.detail.repairStatus')}
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
          <button
            type='button'
            className='create-order-close'
            onClick={onClose}
            aria-label={t('orders.detail.closeOrderCard')}
          >
            &times;
          </button>
        </div>
      </header>

      <div className='order-detail-grid'>
        <section className='order-detail-panel'>
          <h3>{t('orders.detail.mainInformation')}</h3>
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
            {isSaleCard ? (
              <div className='order-detail-notes-row'>
                <dt>{t('orders.detail.notes')}</dt>
                <dd>{sale.note || t('orders.detail.noNotesSale')}</dd>
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
                      try {
                        await onSaveMainInfo({
                          deviceName: deviceNameInput.trim(),
                          serialNumber: serialNumberInput.trim().toUpperCase(),
                          masterId: masterIdInput,
                          status: statusDraft,
                        });
                      } finally {
                        setIsSavingMainInfo(false);
                      }
                    }}
                  >
                    {isSavingMainInfo
                      ? t('orders.payment.saving')
                      : t('orders.detail.saveChanges')}
                  </button>
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className='order-detail-panel order-detail-live-panel'>
          <h3>{t('orders.detail.liveFeed')}</h3>
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
                  <small className={getTimelineMessageClassName(item)}>
                    {item.message}
                  </small>
                </p>
              </div>
            ))}
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
        </section>

        <section className='order-detail-panel order-detail-line-items-panel order-detail-products-panel'>
          <button
            type='button'
            className='order-detail-collapse-button'
            onClick={() => {
              setIsProductsOpen((current) => !current);
            }}
            aria-expanded={isProductsOpen}
          >
            <span>{t('orders.detail.products')}</span>
            <span className='order-detail-collapse-icon'>
              {isProductsOpen ? '⌃' : '⌄'}
            </span>
          </button>
          {isProductsOpen ? (
            <LineItemsPanel
              kind='product'
              sales={sales}
              currentSaleId={sale.id}
              currentSaleRecordNumber={sale.recordNumber ?? undefined}
              currentClientId={sale.client.id}
              currentStatus={status}
              items={productItems}
              allItems={lineItems}
              products={products}
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
            onClick={() => {
              setIsServicesOpen((current) => !current);
            }}
            aria-expanded={isServicesOpen}
          >
            <span>{t('orders.detail.services')}</span>
            <span className='order-detail-collapse-icon'>
              {isServicesOpen ? '⌃' : '⌄'}
            </span>
          </button>
          {isServicesOpen ? (
            <LineItemsPanel
              kind='service'
              sales={sales}
              currentSaleId={sale.id}
              currentSaleRecordNumber={sale.recordNumber ?? undefined}
              currentClientId={sale.client.id}
              currentStatus={status}
              items={serviceItems}
              allItems={lineItems}
              products={products}
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
                  <span className='payment-summary-discount-badge'>
                    {discount.mode === 'percent' ? '%' : '₴'}
                  </span>
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
                    onClick={() => {
                      const nextValue = parseDecimal(discountInput);
                      onDiscountChange({
                        mode:
                          discount.mode === 'percent'
                            ? 'amount'
                            : 'percent',
                        value: Number.isFinite(nextValue) && nextValue > 0
                          ? Math.round(nextValue * 100) / 100
                          : discount.value,
                      });
                    }}
                    aria-label={t('orders.payment.toggleDiscountMode')}
                    disabled={isReadOnly}
                  >
                    {discount.mode === 'percent' ? '%' : '₴'}
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

        {!isSaleCard ? (
          <section className='order-detail-panel order-detail-note'>
            <h3>{t('orders.detail.notes')}</h3>
            <p>{sale.note || t('orders.detail.noNotesOrder')}</p>
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
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
          <div className='order-related-list'>
            {relatedTab === 'supplierOrders' ? (
              relatedSupplierOrderItems.length === 0 ? (
                <p>{t('orders.detail.noSupplierOrdersLinked')}</p>
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
                    <span>
                      {buildSupplierOrderItemNumber(
                        order,
                        item.itemIndex,
                      )}
                    </span>
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
        <div
          className='modal-backdrop'
          role='presentation'
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsDeviceModalOpen(false);
            }
          }}
        >
          <section
            className='catalog-edit-modal order-device-change-modal'
            role='dialog'
            aria-modal='true'
            aria-label={t('orders.detail.changeDevice')}
          >
            <header className='catalog-edit-header'>
              <div className='catalog-edit-title'>
                <h2>{t('orders.detail.deviceModal.title')}</h2>
              </div>
              <button
                type='button'
                className='create-order-close'
                onClick={() => setIsDeviceModalOpen(false)}
                aria-label={t('orders.detail.close')}
              >
                &times;
              </button>
            </header>
            <div className='catalog-edit-body order-device-change-body'>
              <label className='field field-wide'>
                <span>{t('orders.detail.deviceModal.findDevice')}</span>
                <input
                  value={deviceSearch}
                  onChange={(event) => setDeviceSearch(event.target.value)}
                  placeholder={t('orders.detail.deviceModal.searchClientDevices')}
                />
              </label>
              <div className='order-device-options' role='list'>
                {isDeviceLookupLoading ? (
                  <p>{t('orders.detail.deviceModal.searchingDevices')}</p>
                ) : clientDeviceOptions.length === 0 ? (
                  <p>{t('orders.detail.deviceModal.noActiveDevices')}</p>
                ) : (
                  clientDeviceOptions.map((device) => (
                    <button
                      key={device.id}
                      type='button'
                      className='order-device-option'
                      onClick={() => applyDeviceName(device.name)}
                    >
                      <strong>{device.name}</strong>
                      {device.note ? <span>{device.note}</span> : null}
                    </button>
                  ))
                )}
              </div>
              <label className='field field-wide'>
                <span>{t('orders.detail.deviceModal.newDevice')}</span>
                <input
                  value={newDeviceName}
                  onChange={(event) => setNewDeviceName(event.target.value)}
                  placeholder={t('orders.detail.deviceModal.deviceName')}
                />
              </label>
              <label className='create-inline-checkbox order-device-clear-serial'>
                <input
                  type='checkbox'
                  checked={clearSerialOnDeviceApply}
                  onChange={(event) =>
                    setClearSerialOnDeviceApply(event.target.checked)
                  }
                />
                <span>{t('orders.detail.deviceModal.clearSerial')}</span>
              </label>
            </div>
            <footer className='catalog-edit-footer'>
              <button
                type='button'
                className='secondary-button'
                onClick={() => setIsDeviceModalOpen(false)}
              >
                {t('orders.detail.cancel')}
              </button>
              <button
                type='button'
                className='primary-button'
                disabled={isCreatingDevice || !canCreateDevice}
                onClick={() => void createAndApplyDevice()}
              >
                {isCreatingDevice
                  ? t('orders.detail.creating')
                  : t('orders.detail.createAndApply')}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      <SupplierOrderModal
        isOpen={isRelatedSupplierOrderModalOpen}
        suppliers={relatedSuppliers}
        editingOrder={selectedRelatedSupplierOrder}
        forceReadOnly={Boolean(
          selectedRelatedSupplierOrder &&
            (selectedRelatedSupplierOrder.status === 'stocked' ||
              selectedRelatedSupplierOrder.receiptStatus === 'received' ||
              selectedRelatedSupplierOrder.status === 'cancelled' ||
              selectedRelatedSupplierOrder.paymentStatus === 'cancelled' ||
              selectedRelatedSupplierOrder.paymentStatus === 'paid' ||
              selectedRelatedSupplierOrder.paymentStatus === 'without_payment'),
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
            if (relatedSupplierOrderSource.items.length <= 1) {
              await cancelSupplierOrder(relatedSupplierOrderSource.id);
              onSuccess(t('orders.messages.success.orderCancelled'));
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
                  sale.recordNumber ?? sale.id,
                  sale.client.id,
                ),
                createdBy: relatedSupplierOrderSource.createdBy,
                status: relatedSupplierOrderSource.status,
                paymentStatus:
                  relatedSupplierOrderSource.paymentStatus,
                items: nextItems,
              });
              onSuccess(t('orders.messages.success.supplierItemRemoved'));
            }
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

type LineItemsPanelProps = {
  kind: OrderLineItemKind;
  sales: Sale[];
  currentSaleId: string;
  currentSaleRecordNumber?: string;
  currentClientId: string;
  currentStatus: OrderStatus;
  items: OrderLineItem[];
  allItems: OrderLineItem[];
  products: Product[];
  catalogProducts: CatalogProduct[];
  onAddItem: (item: Omit<OrderLineItem, 'id'>) => void;
  onReplaceItem: (
    itemId: string,
    itemIndex: number | undefined,
    items: Array<Omit<OrderLineItem, 'id'>>,
  ) => void;
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
  paidAmount: number;
  discount: ReturnType<typeof getDiscount>;
  isReadOnly: boolean;
  onSupplierOrderCreated: () => Promise<void>;
  onUpdateProductModel: (payload: ProductModelUpdatePayload) => Promise<boolean>;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

type ProductEntrySuggestion =
  | { type: 'catalog'; catalogProduct: CatalogProduct; price: number; warrantyPeriod: number }
  | { type: 'stock'; product: Product };

const LineItemsPanel = ({
  kind,
  sales,
  currentSaleId,
  currentSaleRecordNumber,
  currentClientId,
  currentStatus,
  items,
  allItems,
  products,
  catalogProducts,
  onAddItem,
  onReplaceItem,
  onRemoveItem,
  onUpdateItem,
  onReturnItem,
  paidAmount,
  discount,
  isReadOnly,
  onSupplierOrderCreated,
  onUpdateProductModel,
  onError,
  onSuccess,
}: LineItemsPanelProps) => {
  const { t } = useTranslation();
  const warrantyOptions = getWarrantyOptions();
  const isProductKind = kind === 'product';

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
    ProductEntrySuggestion[]
  >([]);
  const [selectedServiceId, setSelectedServiceId] = useState<
    string | undefined
  >();
  const [selectedProductId, setSelectedProductId] = useState<
    string | undefined
  >();
  const [selectedCatalogProductId, setSelectedCatalogProductId] = useState<
    string | undefined
  >();
  const [isServiceLookupLoading, setIsServiceLookupLoading] =
    useState(false);
  const [isProductLookupLoading, setIsProductLookupLoading] =
    useState(false);
  const [selectedService, setSelectedService] =
    useState<ServiceCatalogItem | null>(null);
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
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
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
  const [productModelContext, setProductModelContext] = useState<{
    name: string;
    printProduct: Product | null;
  } | null>(null);
  const [productModelWarehouses, setProductModelWarehouses] = useState<
    WarehouseItem[]
  >([]);
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
  const selectedSerials = useMemo(() => {
    if (!isProductKind) return [];
    return Array.from(
      new Set(
        serialsInput
          .split('\n')
          .map(normalizeSerialNumber)
          .filter(Boolean),
      ),
    );
  }, [isProductKind, serialsInput]);
  const serialUsage = useMemo((): SerialUsage => {
    if (!isProductKind) return { current: new Set(), other: new Set() };
    return getSaleSerialUsage(sales, currentSaleId);
  }, [isProductKind, currentSaleId, sales]);
  const productsBySerial = useMemo(() => {
    if (!isProductKind) return new Map<string, Product>();
    const map = new Map<string, Product>();
    products.forEach((product) => {
      const serial = normalizeSerialNumber(product.serialNumber);
      if (serial && !map.has(serial)) {
        map.set(serial, product);
      }
    });
    return map;
  }, [isProductKind, products]);
  useEffect(() => {
    setPriceDrafts((current) => {
      const itemIds = new Set(items.map((item) => item.id));
      const nextEntries = Object.entries(current).filter(([itemId]) =>
        itemIds.has(itemId),
      );

      if (nextEntries.length === Object.keys(current).length) return current;

      return Object.fromEntries(nextEntries);
    });
  }, [items]);
  const occupiedSerials = useMemo(() => {
    if (!isProductKind) return new Set<string>();

    const occupied = new Set<string>();

    sales.forEach((candidateSale) => {
      const saleLevelSerial = normalizeSerialNumber(
        candidateSale.product?.serialNumber,
      );
      if (saleLevelSerial) {
        occupied.add(saleLevelSerial);
      }

      (candidateSale.lineItems ?? []).forEach((lineItem) => {
        if (lineItem.kind !== 'product') return;

        const isCurrentEditingLine =
          serialsEditingItem &&
          candidateSale.id === currentSaleId &&
          lineItem.id === serialsEditingItem.id;
        if (isCurrentEditingLine) return;

        (lineItem.serialNumbers ?? [])
          .map(normalizeSerialNumber)
          .filter(Boolean)
          .forEach((serial) => occupied.add(serial));
      });
    });

    return occupied;
  }, [isProductKind, currentSaleId, sales, serialsEditingItem]);
  const getProductSuggestionState = useCallback(
    (product: Product): ProductSerialAvailability => {
      if (!isProductKind) return { labelKey: 'orders.serialAvailability.free', selectable: true };
      return getProductSerialAvailability(product, serialUsage);
    },
    [isProductKind, serialUsage],
  );
  const canRemoveItemAfterPayment = (item: OrderLineItem) =>
    canRemoveLineItemAfterPayment(
      allItems,
      item.id,
      undefined,
      paidAmount,
      discount,
    );
  const canRemoveServiceItem = (item: OrderLineItem) =>
    !isReadOnly && canRemoveItemAfterPayment(item);
  const isIssuedSale = currentStatus === 'issued';
  const canDirectRemoveProductItem = (item: OrderLineItem) =>
    item.kind === 'product' &&
    !isReadOnly &&
    canRemoveItemAfterPayment(item) &&
    (item.serialNumbers ?? []).length === 0;
  const isRepairFinalStockStatus =
    stockLockedRepairStatuses.has(currentStatus as RepairStatus);
  const canReturnIssuedProductItem = (item: OrderLineItem) =>
    item.kind === 'product' &&
    (isIssuedSale || isRepairFinalStockStatus) &&
    (item.serialNumbers ?? []).length > 0;
  const getProductActionBlockedReason = (item: OrderLineItem) => {
    if (canDirectRemoveProductItem(item)) return '';
    if (canReturnIssuedProductItem(item)) return '';
    if (
      isIssuedSale &&
      (item.serialNumbers ?? []).length === 0
    ) {
      return t('orders.messages.errors.bindSerialBeforeReturnDetail');
    }
    if (isReadOnly) {
      return t('orders.messages.errors.useReturnFlow');
    }
    if (!canRemoveItemAfterPayment(item)) {
      return t('orders.messages.errors.refundBeforeRemoveItem');
    }
    if ((item.serialNumbers ?? []).length > 0) {
      return t('orders.messages.errors.unbindSerialsFirst');
    }
    return t('orders.messages.errors.actionUnavailable');
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
          : t('orders.messages.errors.failedLoadSuppliers'),
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
          : t('orders.messages.errors.failedCreateSupplier'),
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
        currentSaleRecordNumber ?? currentSaleId,
        currentClientId,
      ),
      createdBy: t('common.administrator'),
      orderBaseId: `SO-${Date.now()}`,
      status: 'request',
      paymentStatus: 'pending',
      items: payload.items,
    };
    await createSupplierOrder(createPayload);
    await onSupplierOrderCreated();
    onSuccess(t('orders.messages.success.supplierOrderCreated'));
  };

  useEffect(() => {
    if (!isProductKind || !serialsEditingItem) {
      setAvailableSerialProducts([]);
      setIsSerialLookupLoading(false);
      return;
    }

    let isActive = true;
    const normalizeNameForMatch = (value: string) =>
      normalizeProductLookupValue(value)
        .replace(/\([^)]*\)/g, '')
        .replace(/[^a-z0-9\u0400-\u04ff\s-]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const loadAvailableSerials = async () => {
      setIsSerialLookupLoading(true);
      try {
        const lineProductId =
          serialsEditingItem.quantity === 1 &&
          (serialsEditingItem.serialNumbers ?? []).length > 0
            ? (serialsEditingItem.productId?.trim() ?? '')
            : '';
        const normalizedLineName = normalizeNameForMatch(
          serialsEditingItem.name,
        );
        const products = lineProductId
          ? await getProducts('')
          : await getProducts(serialsEditingItem.name);
        if (!isActive) return;

        const filtered = products.filter((product) => {
          if (!product.isActive) return false;
          if (!product.serialNumber?.trim()) return false;
          if (product.freeQuantity <= 0) return false;
          if (lineProductId) {
            return product.id === lineProductId;
          }
          return (
            normalizeNameForMatch(product.name) === normalizedLineName
          );
        });

        const sorted = [...filtered]
          .filter((product) => {
            const serial = normalizeSerialNumber(product.serialNumber);
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
  }, [isProductKind, occupiedSerials, serialsEditingItem]);

  useEffect(() => {
    setWarrantyPeriod(kind === 'service' ? '1' : '0');
  }, [kind]);

  const getCatalogDefaults = useCallback((catalogProduct: CatalogProduct) => {
    const matchingStockProduct = products.find(
      (product) =>
        normalizeProductLookupValue(product.name) ===
        normalizeProductLookupValue(catalogProduct.name),
    );
    return {
      price:
        matchingStockProduct?.salePriceOptions[0] ??
        matchingStockProduct?.price ??
        0,
      warrantyPeriod: matchingStockProduct?.warrantyPeriod ?? 0,
    };
  }, [products]);

  useEffect(() => {
    if (
      kind !== 'product' ||
      name.trim().length < 2 ||
      Boolean(selectedProductId) ||
      Boolean(selectedCatalogProductId)
    ) {
      setProductSuggestions([]);
      setIsProductLookupLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsProductLookupLoading(true);
      const normalizedQuery = normalizeProductLookupValue(name);
      const catalogMatches = catalogProducts
        .filter((catalogProduct) => {
          if (!catalogProduct.isActive) return false;
          return [catalogProduct.name, catalogProduct.note].some((field) =>
            normalizeProductLookupValue(field ?? '').includes(normalizedQuery),
          );
        })
        .sort((first, second) => {
          const firstName = normalizeProductLookupValue(first.name);
          const secondName = normalizeProductLookupValue(second.name);
          const firstExact = firstName === normalizedQuery ? 0 : 1;
          const secondExact = secondName === normalizedQuery ? 0 : 1;
          if (firstExact !== secondExact) return firstExact - secondExact;
          return first.name.localeCompare(second.name);
        })
        .slice(0, 6)
        .map((catalogProduct): ProductEntrySuggestion => ({
          type: 'catalog',
          catalogProduct,
          ...getCatalogDefaults(catalogProduct),
        }));
      const stockSerialMatches = products
        .filter((product) => {
          if (!getProductSuggestionState(product).selectable) return false;
          return (
            normalizeProductLookupValue(product.serialNumber) ===
            normalizedQuery
          );
        })
        .slice(0, 2)
        .map((product): ProductEntrySuggestion => ({ type: 'stock', product }));
      setProductSuggestions([...catalogMatches, ...stockSerialMatches]);
      setIsProductLookupLoading(false);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [
    catalogProducts,
    getCatalogDefaults,
    getProductSuggestionState,
    kind,
    name,
    products,
    selectedCatalogProductId,
    selectedProductId,
    serialUsage,
  ]);

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

  const applyProductSuggestion = (suggestion: ProductEntrySuggestion) => {
    if (suggestion.type === 'catalog') {
      setName(suggestion.catalogProduct.name);
      setPrice(String(suggestion.price));
      setWarrantyPeriod(String(suggestion.warrantyPeriod));
      setSelectedCatalogProductId(suggestion.catalogProduct.id);
      setSelectedProductId(undefined);
      setProductSuggestions([]);
      return;
    }

    const { product } = suggestion;
    const state = getProductSuggestionState(product);
    if (!state.selectable) {
      onError(
        t('orders.messages.errors.productNotSelectable', {
          reason: t(state.labelKey),
        }),
      );
      return;
    }
    const suggestedPrice =
      product.salePriceOptions[0] ?? product.price ?? 0;
    const serial = normalizeSerialNumber(product.serialNumber);
    const normalizedQuery = normalizeProductLookupValue(name);
    const isSerialPick =
      serial &&
      normalizeProductLookupValue(serial).includes(normalizedQuery);

    if (isSerialPick) {
      onAddItem({
        ...buildSerializedProductLineItem({
          product,
          price: suggestedPrice,
          warrantyPeriod: 0,
        }),
      });
      setName('');
      setPrice('');
      setQuantity('1');
      setWarrantyPeriod('0');
      setSelectedProductId(undefined);
      setSelectedCatalogProductId(undefined);
      setProductSuggestions([]);
      onSuccess(
        t('orders.messages.success.productWithSerialAdded', {
          name: product.name,
          serial,
        }),
      );
      return;
    }

    setName(product.name);
    setPrice(String(suggestedPrice));
    setQuantity('1');
    setWarrantyPeriod('0');
    setSelectedProductId(product.id);
    setSelectedCatalogProductId(undefined);
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
      onSuccess(t('orders.messages.success.serviceSaved'));
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('orders.messages.errors.failedSaveService'),
      );
    } finally {
      setIsCreateServiceSaving(false);
    }
  };

  const openProductModelModal = async (
    name: string,
    printProduct: Product | null,
  ) => {
    const settings = await getWarehouseSettings();
    setProductModelWarehouses(settings.warehouses);
    setProductModelContext({ name, printProduct });
  };

  const openLineItemModal = async (item: OrderLineItem) => {
    setEditingItemId(item.id);
    try {
      if (item.kind === 'product') {
        await openProductModelModal(item.name, null);
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
        onError(t('orders.messages.errors.serviceNotFound'));
        return;
      }
      setSelectedService(service);
      setServiceForm(toServiceCatalogForm(service));
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('orders.messages.errors.failedLoadCatalogItem'),
      );
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
      onSuccess(t('orders.messages.success.serviceUpdated'));
      setSelectedService(null);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('orders.messages.errors.failedUpdateService'),
      );
    } finally {
      setIsCatalogSaving(false);
    }
  };

  const submitItem = async () => {
    const normalizedName = name.trim();
    const normalizedPrice = parseDecimal(price);
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
        onSuccess(t('orders.messages.success.serviceSaved'));
      } catch (error) {
        onError(
          error instanceof Error
            ? error.message
            : t('orders.messages.errors.failedSaveService'),
        );
        return;
      }
    }
    const suggestedStockProduct = productSuggestions.find(
      (candidate): candidate is Extract<ProductEntrySuggestion, { type: 'stock' }> =>
        candidate.type === 'stock' && candidate.product.name === normalizedName,
    );
    const selectedProduct =
      kind === 'product'
        ? products.find(
            (product) =>
              product.id ===
              (selectedProductId ?? suggestedStockProduct?.product.id),
          )
        : null;
    const suggestedCatalogProduct = productSuggestions.find(
      (candidate): candidate is Extract<ProductEntrySuggestion, { type: 'catalog' }> =>
        candidate.type === 'catalog' &&
        candidate.catalogProduct.name === normalizedName,
    );
    const selectedCatalogProduct =
      kind === 'product'
        ? catalogProducts.find(
            (catalogProduct) =>
              catalogProduct.id ===
              (selectedCatalogProductId ??
                suggestedCatalogProduct?.catalogProduct.id),
          )
        : null;
    const selectedProductSerial = normalizeSerialNumber(
      selectedProduct?.serialNumber,
    );
    if (
      kind === 'product' &&
      selectedProductSerial &&
      normalizedQuantity > 1
    ) {
      onError(t('orders.messages.errors.oneSerialPerLineAddSeparately'));
      return;
    }

    onAddItem({
      kind,
      productId:
        kind === 'product'
          ? selectedProduct?.id
          : undefined,
      catalogProductId:
        kind === 'product'
          ? selectedCatalogProduct?.id
          : undefined,
      serviceId:
        kind === 'service'
          ? nextServiceId
          : undefined,
      name: normalizedName,
      price: normalizedPrice,
      quantity: normalizedQuantity,
      warrantyPeriod: Number(warrantyPeriod),
      serialNumbers:
        kind === 'product' && selectedProductSerial
          ? [selectedProductSerial]
          : undefined,
    });
    setName('');
    setPrice('');
    setQuantity('1');
    setWarrantyPeriod(kind === 'service' ? '1' : '0');
    setSelectedServiceId(undefined);
    setSelectedProductId(undefined);
    setSelectedCatalogProductId(undefined);
    setServiceSuggestions([]);
    setProductSuggestions([]);
  };
  const handleLineItemPriceChange = (item: OrderLineItem, value: string) => {
    setPriceDrafts((current) => ({
      ...current,
      [item.id]: value,
    }));

    if (value === '') return;

    const parsedPrice = parseDecimal(value);
    if (!Number.isFinite(parsedPrice)) return;

    onUpdateItem(item.id, undefined, {
      price: Math.round(parsedPrice * 100) / 100,
    });
  };

  const showSerialColumn = isProductKind;
  const gridTemplateColumns = showSerialColumn
    ? 'minmax(0, 1fr) 150px 140px 104px 120px 110px'
    : 'minmax(0, 1fr) 140px 104px 120px 110px';

  return (
    <div className='order-line-items'>
      <div
        className='order-detail-table order-detail-table-wide'
        style={{ gridTemplateColumns }}
      >
        <div className="order-detail-table-header">
          {t('orders.detail.lineItems.name')}
        </div>
        {showSerialColumn ? (
          <div className="order-detail-table-header">
            {t('orders.detail.lineItems.serialNumber')}
          </div>
        ) : null}
        <div className="order-detail-table-header">
          {t('orders.detail.lineItems.price')}
        </div>
        <div className="order-detail-table-header">
          {t('orders.detail.lineItems.qty')}
        </div>
        <div className="order-detail-table-header">
          {t('orders.detail.lineItems.warranty')}
        </div>
        <div className="order-detail-table-header">
          {t('orders.detail.lineItems.action')}
        </div>
        {items.length === 0 ? (
          <div className='order-line-items-empty'>
            {isProductKind
              ? t('orders.detail.lineItems.noProductsAdded')
              : t('orders.detail.lineItems.noServicesAdded')}
          </div>
        ) : (
          items.map((item, itemIndex) => {
            const isLastRow = itemIndex === items.length - 1;
            const lastRowClass = isLastRow ? 'order-detail-table-last-row' : '';
            return (
            <div
              key={`${item.id || 'line-item'}-${itemIndex}`}
              className='order-detail-table-row'
            >
              <div
                key={`${item.id}-name`}
                className={lastRowClass || undefined}
              >
                <button
                  type='button'
                  className='order-line-item-name-button'
                  onClick={() => void openLineItemModal(item)}
                  disabled={isReadOnly}
                >
                  {item.name}
                </button>
              </div>
              {showSerialColumn ? (
                <div
                  key={`${item.id}-serial`}
                  className={`order-line-item-serial-cell${lastRowClass ? ` ${lastRowClass}` : ''}`}
                >
                  {item.kind === 'product' &&
                  (item.serialNumbers ?? []).length > 0 ? (
                    <p className='muted-copy order-line-item-serials'>
                      {(item.serialNumbers ?? []).map((serial) => {
                        const normalizedSerial = normalizeSerialNumber(serial);
                        const serialProduct = productsBySerial.get(normalizedSerial);
                        if (!serialProduct) {
                          return (
                            <span key={serial}>
                              {serial}
                            </span>
                          );
                        }

                        return (
                          <button
                            key={serial}
                            type='button'
                            className='order-line-item-serial-button'
                            onClick={() =>
                              void openProductModelModal(
                                serialProduct.name,
                                serialProduct,
                              )
                            }
                          >
                            {serial}
                          </button>
                        );
                      })}
                    </p>
                  ) : (
                    <span className='muted-copy'>-</span>
                  )}
                </div>
              ) : null}
              <div
                key={`${item.id}-price`}
                className={`order-line-item-price-cell${lastRowClass ? ` ${lastRowClass}` : ''}`}
              >
                <NumberStepper
                  className='line-item-inline-input'
                  min={0}
                  step={0.01}
                  precision={2}
                  value={priceDrafts[item.id] ?? String(item.price)}
                  onChange={(value) => handleLineItemPriceChange(item, value)}
                  disabled={isReadOnly}
                />
              </div>
              <div
                key={`${item.id}-qty`}
                className={lastRowClass || undefined}
              >
                <NumberStepper
                  className='line-item-inline-input'
                  min={1}
                  value={String(item.quantity)}
                  onChange={(value) => {
                    if (
                      item.kind === 'product' &&
                      (item.serialNumbers ?? []).length > 0
                    ) {
                      onError(t('orders.messages.errors.oneSerialPerLine'));
                      return;
                    }
                    onUpdateItem(item.id, undefined, {
                      quantity: Math.max(1, Number(value) || 1),
                    });
                  }}
                  disabled={
                    isReadOnly ||
                    (item.kind === 'product' &&
                      (item.serialNumbers ?? []).length > 0)
                  }
                />
              </div>
              <div
                key={`${item.id}-warranty`}
                className={lastRowClass || undefined}
              >
                <select
                  className='line-item-inline-input'
                  value={item.warrantyPeriod}
                  onChange={(event) =>
                    onUpdateItem(item.id, undefined, {
                      warrantyPeriod: Number(event.target.value),
                    })
                  }
                  disabled={isReadOnly}
                >
                  {warrantyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </select>
              </div>
              <div
                key={`${item.id}-action`}
                className={lastRowClass || undefined}
              >
                {(() => {
                  const isProduct = item.kind === 'product';
                  const hasBoundSerials =
                    (item.serialNumbers ?? []).length > 0;
                  const canDirectRemove = canDirectRemoveProductItem(item);
                  const canReturnIssued = canReturnIssuedProductItem(item);
                  const canRemoveService = canRemoveServiceItem(item);
                  const canOpenSerials = !isReadOnly || hasBoundSerials;
                  const actionDisabled = isProduct
                    ? !canDirectRemove && !canReturnIssued
                    : !canRemoveService;
                  const actionLabel = isProduct
                    ? canReturnIssued
                      ? t('orders.detail.lineItems.return')
                      : t('orders.detail.lineItems.remove')
                    : t('orders.detail.lineItems.remove');
                  const actionBlockedReason =
                    isProduct && actionDisabled
                      ? getProductActionBlockedReason(item)
                      : !isProduct && actionDisabled
                        ? isReadOnly
                          ? t('orders.messages.errors.editingBlocked')
                          : t('orders.messages.errors.refundBeforeRemoveItem')
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
                    disabled={!canOpenSerials}
                    title={
                      canOpenSerials
                        ? undefined
                        : t('orders.messages.errors.editingBlocked')
                    }
                  >
                    <span>{t('orders.detail.lineItems.serials')}</span>
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
                        ? onRemoveItem(item.id, undefined)
                        : onReturnItem(item)
                      : onRemoveItem(item.id, undefined)
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
            );
          })
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
              setSelectedCatalogProductId(undefined);
            }}
            placeholder={
              isProductKind
                ? t('orders.detail.lineItems.addProductPlaceholder')
                : t('orders.detail.lineItems.addServicePlaceholder')
            }
            disabled={isReadOnly}
          />
          <NumberStepper
            min={0}
            step={0.01}
            precision={2}
            value={price}
            onChange={setPrice}
            placeholder={t('orders.detail.lineItems.price')}
            disabled={isReadOnly}
          />
          <NumberStepper
            min={1}
            value={quantity}
            onChange={setQuantity}
            placeholder={t('orders.detail.lineItems.qty')}
            disabled={isReadOnly}
          />
          <select
            value={warrantyPeriod}
            onChange={(event) => setWarrantyPeriod(event.target.value)}
            disabled={isReadOnly}
          >
            {warrantyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
          <button
            type='button'
            className='primary-button'
            onClick={() => void submitItem()}
            disabled={isReadOnly}
          >
            {isProductKind
              ? t('orders.detail.lineItems.addProduct')
              : t('orders.detail.lineItems.addService')}
          </button>
        </div>
        {kind === 'product' &&
        (productSuggestions.length > 0 || isProductLookupLoading) ? (
          <div className='create-suggestions line-item-suggestions'>
            {isProductLookupLoading ? (
              <p>{t('orders.detail.lineItems.searchingProducts')}</p>
            ) : null}
            {productSuggestions.map((suggestion) => {
              const isStockSuggestion = suggestion.type === 'stock';
              const product = isStockSuggestion ? suggestion.product : null;
              const state = product
                ? getProductSuggestionState(product)
                : {
                    selectable: true,
                    labelKey: 'orders.detail.lineItems.productList',
                  };
              const suggestionKey =
                suggestion.type === 'catalog'
                  ? `catalog-${suggestion.catalogProduct.id}`
                  : `stock-${suggestion.product.id}`;
              const suggestionName =
                suggestion.type === 'catalog'
                  ? suggestion.catalogProduct.name
                  : suggestion.product.name;
              const suggestionDetails =
                suggestion.type === 'catalog'
                  ? `${formatCurrency(suggestion.price)} / ${t('orders.detail.lineItems.productList')}`
                  : `${formatCurrency(suggestion.product.salePriceOptions[0] ?? suggestion.product.price ?? 0)} / ${suggestion.product.article} / ${suggestion.product.serialNumber} / ${t(state.labelKey)}`;
              return (
                <button
                  key={suggestionKey}
                  type='button'
                  className='create-suggestion-item'
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applyProductSuggestion(suggestion);
                  }}
                  onClick={() => applyProductSuggestion(suggestion)}
                  disabled={isReadOnly || !state.selectable}
                  title={state.selectable ? undefined : t(state.labelKey)}
                >
                  <strong>{suggestionName}</strong>
                  <span>{suggestionDetails}</span>
                </button>
              );
            })}
          </div>
        ) : null}
        {kind === 'service' &&
        (serviceSuggestions.length > 0 || isServiceLookupLoading) ? (
          <div className='create-suggestions line-item-suggestions'>
            {isServiceLookupLoading ? (
              <p>{t('orders.detail.lineItems.searchingServices')}</p>
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
            {t('orders.detail.lineItems.addServiceButton')}
          </button>
        ) : null}
      </div>
      {isCreateServiceOpen ? (
        <CatalogServiceEditorModal
          title={t('orders.detail.lineItems.createService')}
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
      {productModelContext ? (
        <ProductModelModal
          name={productModelContext.name}
          products={products}
          warehouses={productModelWarehouses}
          printProduct={productModelContext.printProduct}
          isSaving={isCatalogSaving}
          onClose={() => setProductModelContext(null)}
          onSave={async (payload) => {
            setIsCatalogSaving(true);
            try {
              return await onUpdateProductModel(payload);
            } finally {
              setIsCatalogSaving(false);
            }
          }}
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
      {isProductKind && serialsEditingItem ? (
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
              <h3>{t('orders.detail.lineItems.bindSerialNumbers')}</h3>
              <p>
                {t('orders.detail.lineItems.selectSerialsUpTo', {
                  count: serialsEditingItem.quantity,
                })}
              </p>
              <div className='modal-actions'>
                <button
                  type='button'
                  className='secondary-button'
                  onClick={() => {
                    const oldestSerials = availableSerialProducts
                      .map((product) =>
                        normalizeSerialNumber(product.serialNumber),
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
                  {t('orders.detail.lineItems.autoSelectOldest')}
                </button>
              </div>
              <div className='create-suggestions line-item-suggestions'>
                {isSerialLookupLoading ? (
                  <p>{t('orders.detail.lineItems.loadingAvailableSerials')}</p>
                ) : null}
                {!isSerialLookupLoading &&
                availableSerialProducts.length === 0 ? (
                  <p>{t('orders.detail.lineItems.noAvailableSerials')}</p>
                ) : null}
                {availableSerialProducts.map((product) => {
                  const serial = normalizeSerialNumber(product.serialNumber);
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
                            t('orders.messages.errors.serialCountExceedsQty'),
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
                        {t('orders.detail.lineItems.dateLabel', {
                          date: formatDateTime(
                            product.purchaseDate ?? product.createdAt,
                          ),
                        })}
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedSerials.length > 0 ? (
                <div className='modal-actions'>
                  <span>
                    {t('orders.detail.lineItems.selectedCount', {
                      count: selectedSerials.length,
                    })}
                  </span>
                  <button
                    type='button'
                    className='secondary-button'
                    onClick={() => setSerialsInput('')}
                  >
                    {t('orders.detail.lineItems.clearSelected')}
                  </button>
                </div>
              ) : null}
              {selectedSerials.length > 0 ? (
                <div className='serial-bind-selected-list'>
                  {selectedSerials.map((serial) => (
                    <div
                      key={`selected-${serial}`}
                      className='serial-bind-selected-item'
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
                        {t('orders.detail.lineItems.remove')}
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className='modal-actions serial-bind-modal-footer'>
              <button
                type='button'
                className='primary-button'
                onClick={() => void openSupplierOrderModalForSerialItem()}
                disabled={isSuppliersLoading}
              >
                {isSuppliersLoading
                  ? t('orders.detail.lineItems.loading')
                  : t('orders.detail.lineItems.order')}
              </button>
              <button
                type='button'
                className='secondary-button'
                onClick={() => setSerialsEditingItem(null)}
              >
                {t('orders.detail.cancel')}
              </button>
              <button
                type='button'
                className='primary-button'
                onClick={() => {
                  const uniqueSerials = selectedSerials;
                  if (
                    uniqueSerials.length >
                    serialsEditingItem.quantity
                  ) {
                    onError(
                      t('orders.messages.errors.serialCountExceedsQty'),
                    );
                    return;
                  }
                  const conflictingSerials = uniqueSerials.filter(
                    (serial) => occupiedSerials.has(serial),
                  );
                  if (conflictingSerials.length > 0) {
                    onError(
                      t('orders.messages.errors.serialAlreadyLinked', {
                        serials: conflictingSerials.join(', '),
                      }),
                    );
                    return;
                  }
                  const serialProducts = uniqueSerials.map((serial) => {
                    const product = products.find(
                      (candidate) =>
                        normalizeSerialNumber(candidate.serialNumber) ===
                        serial,
                    );
                    return { serial, product };
                  });
                  const missingSerials = serialProducts
                    .filter(({ product }) => !product)
                    .map(({ serial }) => serial);
                  if (missingSerials.length > 0) {
                    onError(
                      t('orders.messages.errors.serialNotInStock', {
                        serials: missingSerials.join(', '),
                      }),
                    );
                    return;
                  }
                  const unavailableSerials = serialProducts
                    .filter(({ product }) => {
                      if (!product) return false;
                      if (
                        product.id ===
                        (serialsEditingItem.productId ?? '').trim()
                      ) {
                        return false;
                      }
                      return !isProductAvailableForOrder(product);
                    })
                    .map(({ serial }) => serial);
                  if (unavailableSerials.length > 0) {
                    onError(
                      t('orders.messages.errors.serialNoFreeStock', {
                        serials: unavailableSerials.join(', '),
                      }),
                    );
                    return;
                  }
                  const shouldSplitSerializedLine =
                    serialsEditingItem.quantity > 1 ||
                    uniqueSerials.length > 1;
                  if (shouldSplitSerializedLine) {
                    onReplaceItem(
                      serialsEditingItem.id,
                      undefined,
                      serialProducts.map(({ serial, product }) => ({
                        ...(product
                          ? buildSerializedProductLineItem({
                              product,
                              price: serialsEditingItem.price,
                              warrantyPeriod:
                                serialsEditingItem.warrantyPeriod,
                            })
                          : {
                              kind: 'product' as const,
                              productId: undefined,
                              name: serialsEditingItem.name,
                              price: serialsEditingItem.price,
                              quantity: 1,
                              warrantyPeriod:
                                serialsEditingItem.warrantyPeriod,
                              serialNumbers: [serial],
                            }),
                      })),
                    );
                    onSuccess(t('orders.messages.success.serialsUpdated'));
                    setSerialsEditingItem(null);
                    return;
                  }
                  onUpdateItem(
                    serialsEditingItem.id,
                    undefined,
                    {
                      productId:
                        serialProducts[0]?.product?.id ??
                        serialsEditingItem.productId,
                      name:
                        serialProducts[0]?.product?.name ??
                        serialsEditingItem.name,
                      quantity: 1,
                      serialNumbers: uniqueSerials,
                    },
                  );
                  onSuccess(t('orders.messages.success.serialsUpdated'));
                  setSerialsEditingItem(null);
                }}
              >
                {t('orders.detail.lineItems.save')}
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {isProductKind ? (
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
      ) : null}
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
  const { t } = useTranslation();
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
            <span>
              {service
                ? t('orders.detail.serviceEditor.service')
                : t('orders.detail.serviceEditor.newService')}
            </span>
            <h2>{title}</h2>
          </div>
          <button
            type='button'
            className='create-order-close'
            onClick={onClose}
            aria-label={t('orders.detail.close')}
          >
            &times;
          </button>
        </header>
        <div className='catalog-edit-body'>
          <h3>{t('orders.detail.mainInformation')}</h3>
          <label className='field'>
            <span>{t('orders.detail.lineItems.name')}</span>
            <input
              value={form.name}
              onChange={(event) =>
                onChange('name', event.target.value)
              }
            />
          </label>
          <fieldset className='catalog-type-field'>
            <legend>{t('orders.detail.serviceEditor.itemType')}</legend>
            <label>
              <input type='radio' disabled />{' '}
              {t('orders.detail.serviceEditor.product')}
            </label>
            <label>
              <input type='radio' checked readOnly />{' '}
              {t('orders.detail.serviceEditor.service')}
            </label>
          </fieldset>
          <label className='field'>
            <span>{t('orders.detail.serviceEditor.retailPrice')}</span>
            <NumberStepper
              min={0}
              step={0.01}
              precision={2}
              value={form.price}
              onChange={(value) => onChange('price', value)}
            />
          </label>
          <label className='field field-wide'>
            <span>{t('orders.detail.serviceEditor.note')}</span>
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
            {t('orders.detail.cancel')}
          </button>
          <button
            type='button'
            className='primary-button'
            onClick={onSubmit}
            disabled={isSaving || !isEditing}
          >
            {isSaving
              ? t('orders.payment.saving')
              : t('orders.detail.lineItems.save')}
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

