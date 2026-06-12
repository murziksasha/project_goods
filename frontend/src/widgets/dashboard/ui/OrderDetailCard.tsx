import { useEffect, useMemo, useState } from 'react';
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
import { NumberStepper } from '../../../shared/ui/NumberStepper';
import { normalizeDecimalInput, parseDecimal } from '../../../shared/lib/decimal';
import { SupplierOrderModal, type SupplierOrderModalSubmitPayload } from './SupplierOrderModal';
import { ProductModelModal } from './ProductModelModal';
import { getOrderLink } from './create-order-card-shared';
import type { WarehouseItem } from '../../../entities/warehouse-settings/model/types';
import { buildMissingServicePayload, shouldCreateMissingServiceOnSubmit } from '../model/missingService';
import { buildSupplierOrderItemNumber, mergeSupplierOrderItemUpdate } from '../model/supplier-order-utils';
import { canRemoveLineItemAfterPayment } from '../model/line-item-ops';
import {
  buildSerializedProductLineItem,
  getProductSerialAvailability,
  getSaleSerialUsage,
  normalizeSerialNumber,
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
  getStatusLabel,
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
  warrantyOptions,
  withSupplierOrderLinkNote,
  writeOrderDetailSectionsState,
  PrinterIcon,
  type OrderLineItem,
  type OrderLineItemKind,
  type OrderStatus,
  type OrdersTab,
  type RepairStatus,
  type TimelineEntry,
} from './orders-workspace-shared';
type OrderDetailCardProps = {
  sale: Sale;
  sales: Sale[];
  supplierOrders: SupplierOrder[];
  employees: Employee[];
  status: OrderStatus;
  statusOptions: Array<{ key: OrderStatus; label: string }>;
  comments: TimelineEntry[];
  lineItems: OrderLineItem[];
  products: Product[];
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
  onUpdateProductModel: (payload: ProductModelUpdatePayload) => Promise<boolean>;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  onSaveMainInfo: (payload: {
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
  onUpdateProductModel,
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
  const [relatedTab, setRelatedTab] = useState<OrdersTab>(
    getStoredOrderDetailRelatedTab,
  );
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
    setSerialNumberInput(getPrimaryDeviceSerial(sale));
    setMasterIdInput(sale.master?.id ?? '');
  }, [sale]);
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
      return 'Refund client payment for bound products and return them to stock first.';
    }
    if (
      hasRepairProductLineItems &&
      statusOption === 'issued' &&
      getRemainingPayment(sale, paidAmount, lineItems) > 0
    ) {
      return 'Accept full payment before issuing attached products.';
    }
    if (
      !isRepairOrder(sale) &&
      statusOption === 'returned' &&
      hasSaleReturnObligations(sale, lineItems)
    ) {
      return 'Return products to stock and refund client payment first.';
    }
    return '';
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
    sale.id,
    sale.recordNumber,
    sale.client.id,
    saleProductNames,
    supplierOrders,
  ]);
  const hasExplicitSaleSupplierLinks = useMemo(
    () =>
      relatedSupplierOrders.some(
        (order) => isSupplierOrderLinkedToSale(order, sale),
      ),
    [relatedSupplierOrders, sale.id, sale.recordNumber],
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
    <article
      className='order-detail-card'
      aria-label={isSaleCard ? 'Sale card' : 'Order card'}
    >
      <header className='order-detail-header'>
        <div className='order-detail-title'>
          <div className='order-detail-title-label-row'>
            <span className='section-label'>
              {isSaleCard ? 'Sale card' : 'Order card'}
            </span>
            <button
              type='button'
              className='toolbar-square-button order-print-icon-button order-header-print-button'
              onClick={onOpenPrint}
              aria-label={isSaleCard ? 'Print sale' : 'Print order'}
              title={isSaleCard ? 'Print sale' : 'Print order'}
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
            aria-label='Repair status'
            disabled={isReadOnly}
            title={
              isStatusDraftBlocked
                ? isSaleReturnStatusDraftBlocked
                  ? 'Return products to stock and refund client payment first.'
                  : isRepairIssuedDraftBlockedByPayment
                    ? 'Accept full payment before issuing attached products.'
                    : 'Refund client payment for bound products and return them to stock first.'
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
                  {statusOption.label}
                </option>
              );
            })}
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
                  <dd className='order-detail-serial-value'>
                    <span>{serialNumberInput || '-'}</span>
                  </dd>
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
                      isSavingMainInfo ||
                      isReadOnly ||
                      isStatusDraftBlocked
                    }
                    title={
                      isStatusDraftBlocked
                        ? isSaleReturnStatusDraftBlocked
                          ? 'Return products to stock and refund client payment first.'
                          : isRepairIssuedDraftBlockedByPayment
                            ? 'Accept full payment before issuing attached products.'
                            : 'Refund client payment for bound products and return them to stock first.'
                        : undefined
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
                  <small className={getTimelineMessageClassName(item)}>
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
              disabled={isCommentComposerDisabled}
            />
            <button
              type='button'
              className='primary-button'
              onClick={submitComment}
              disabled={!comment.trim() || isCommentComposerDisabled}
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
            onClick={() => {
              setIsProductsOpen((current) => !current);
            }}
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
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onAcceptPayment();
            }}
            disabled={remainingPayment <= 0 || isReadOnly || !canAcceptPayment}
          >
            {remainingPayment <= 0 ? 'Paid' : 'Accept payment'}
          </button>
          {paidAmount > 0 ? (
            <button
              type='button'
              className='secondary-button'
              onClick={onRefundPayment}
              disabled={!canRefundPayment || (isReadOnly && status !== 'issued')}
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
                  <dt>Orders (sales)</dt>
                  <dd>
                    {clientStats.salesCount} | {formatCurrency(clientStats.salesAmount)}
                  </dd>
                </div>
                <div>
                  <dt>Repair orders</dt>
                  <dd>
                    {clientStats.repairsCount} | {formatCurrency(clientStats.repairsAmount)}
                  </dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>
                    {clientStats.totalCount} | {formatCurrency(clientStats.totalAmount)}
                  </dd>
                </div>
                <div>
                  <dt>First contact</dt>
                  <dd>
                    {clientStats.firstContactAt
                      ? formatReadyDate(clientStats.firstContactAt)
                      : '-'}
                  </dd>
                </div>
                <div>
                  <dt>Last contact</dt>
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
                  ? 'No orders for this client.'
                  : 'No sales for this client.'}
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
                  <strong>{getSaleProductName(record, 'Product')}</strong>
                  <span>{formatCurrency(getOrderTotal(record))}</span>
                  <span>{formatReadyDate(record.createdAt)}</span>
                </a>
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
          const result = await takeOnChargeSupplierOrder(relatedSupplierOrderSource.id, {
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
                  sale.recordNumber ?? sale.id,
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
              sale.recordNumber ?? sale.id,
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
  title,
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
  const [productModelName, setProductModelName] = useState<string | null>(null);
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
  const selectedSerials = useMemo(
    () =>
      Array.from(
        new Set(
          serialsInput
            .split('\n')
            .map(normalizeSerialNumber)
            .filter(Boolean),
        ),
      ),
    [serialsInput],
  );
  const serialUsage = useMemo(() => {
    return getSaleSerialUsage(sales, currentSaleId);
  }, [currentSaleId, sales]);
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
  }, [currentSaleId, sales, serialsEditingItem]);
  const getProductSuggestionState = (product: Product) =>
    getProductSerialAvailability(product, serialUsage);
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
      return 'Bind sold serial number before stock return.';
    }
    if (isReadOnly) {
      return 'Use Return flow for shipped serialized product.';
    }
    if (!canRemoveItemAfterPayment(item)) {
      return 'Refund the line item amount before removing it.';
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
        currentSaleRecordNumber ?? currentSaleId,
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
  }, [occupiedSerials, serialsEditingItem]);

  useEffect(() => {
    setWarrantyPeriod(kind === 'service' ? '1' : '0');
  }, [kind]);

  const getCatalogDefaults = (catalogProduct: CatalogProduct) => {
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
  };

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
      onError(`Product cannot be selected: ${state.label}.`);
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
      onSuccess(`Product "${product.name}" with S/N ${serial} added.`);
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
        const settings = await getWarehouseSettings();
        setProductModelWarehouses(settings.warehouses);
        setProductModelName(item.name);
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
      onError(
        'Serialized products are sold one serial per line. Add each serial separately.',
      );
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
              </div>
              <div
                key={`${item.id}-price`}
                className='order-line-item-price-cell'
              >
                {item.kind === 'product' &&
                (item.serialNumbers ?? []).length > 0 ? (
                  <p className='muted-copy order-line-item-serials'>
                    {(item.serialNumbers ?? []).join(', ')}
                  </p>
                ) : null}
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
              <div key={`${item.id}-qty`}>
                <NumberStepper
                  className='line-item-inline-input'
                  min={1}
                  value={String(item.quantity)}
                  onChange={(value) => {
                    if (
                      item.kind === 'product' &&
                      (item.serialNumbers ?? []).length > 0
                    ) {
                      onError(
                        'Serialized products are sold one serial per line. Add another serial instead.',
                      );
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
              <div key={`${item.id}-warranty`}>
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
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div key={`${item.id}-action`}>
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
                      ? 'Return'
                      : 'Remove'
                    : 'Remove';
                  const actionBlockedReason =
                    isProduct && actionDisabled
                      ? getProductActionBlockedReason(item)
                      : !isProduct && actionDisabled
                        ? isReadOnly
                          ? 'Editing is blocked for current order status.'
                          : 'Refund the line item amount before removing it.'
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
                        : 'Editing is blocked for current order status.'
                    }
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
              setSelectedCatalogProductId(undefined);
            }}
            placeholder={`Add ${kind}`}
            disabled={isReadOnly}
          />
          <NumberStepper
            min={0}
            step={0.01}
            precision={2}
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
            {productSuggestions.map((suggestion) => {
              const isStockSuggestion = suggestion.type === 'stock';
              const product = isStockSuggestion ? suggestion.product : null;
              const state = product
                ? getProductSuggestionState(product)
                : { selectable: true, label: 'Product List' };
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
                  ? `${formatCurrency(suggestion.price)} / Product List`
                  : `${formatCurrency(suggestion.product.salePriceOptions[0] ?? suggestion.product.price ?? 0)} / ${suggestion.product.article} / ${suggestion.product.serialNumber} / ${state.label}`;
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
                  title={state.selectable ? undefined : state.label}
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
      {productModelName ? (
        <ProductModelModal
          name={productModelName}
          products={products}
          warehouses={productModelWarehouses}
          isSaving={isCatalogSaving}
          onClose={() => setProductModelName(null)}
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
                    .map(normalizeSerialNumber)
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
                  const conflictingSerials = uniqueSerials.filter(
                    (serial) => occupiedSerials.has(serial),
                  );
                  if (conflictingSerials.length > 0) {
                    onError(
                      `Serial already linked to another order: ${conflictingSerials.join(', ')}.`,
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
                      `Serial was not found in stock: ${missingSerials.join(', ')}.`,
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
                      `Serial has no free stock: ${unavailableSerials.join(', ')}.`,
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
                    onSuccess('Serial numbers updated.');
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
              step={0.01}
              precision={2}
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

