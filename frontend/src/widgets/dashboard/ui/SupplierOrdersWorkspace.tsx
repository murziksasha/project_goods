import { useEffect, useMemo, useRef, useState } from 'react';
import type { CatalogProduct, CatalogProductFormValues } from '../../../entities/catalog-product/model/types';
import { createPortal } from 'react-dom';
import type { Supplier, SupplierFormValues } from '../../../entities/supplier/model/types';
import {
  cancelSupplierOrder,
  createSupplierOrder,
  getSupplierOrders,
  takeOnChargeSupplierOrder,
  updateSupplierOrder,
} from '../../../entities/supplier-order/api/supplierOrderApi';
import { getWarehouseSettings } from '../../../entities/warehouse-settings/api/warehouseSettingsApi';
import type {
  SupplierOrder,
  SupplierOrderFormValues,
  SupplierOrderStatus,
  SupplierPaymentStatus,
} from '../../../entities/supplier-order/model/types';
import { formatCurrency } from '../../../shared/lib/format';
import { PaginationPanel } from '../../../shared/ui/PaginationPanel';
import { SupplierOrderModal, type SupplierOrderModalSubmitPayload } from './SupplierOrderModal';
import {
  buildSupplierOrderAnalytics,
  buildSupplierOrderItemNumber,
  type SupplierOrderProductStat,
  type SupplierOrderSupplierStat,
} from '../model/supplier-order-utils';

type OrdersTab =
  | 'orders'
  | 'sales'
  | 'supplierOrders'
  | 'supplierInformation';

type Props = {
  activeTab: OrdersTab;
  onActiveTabChange: (tab: OrdersTab) => void;
  suppliers: Supplier[];
  catalogProducts: CatalogProduct[];
  currentEmployeeName: string;
  onCreateSupplier: (payload: SupplierFormValues) => Promise<boolean>;
  onUpdateSupplier: (supplierId: string, payload: SupplierFormValues) => Promise<boolean>;
  onUpdateCatalogProduct: (catalogProductId: string, payload: CatalogProductFormValues) => Promise<boolean>;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

const tabs: Array<{ key: OrdersTab; label: string }> = [
  { key: 'orders', label: 'Orders' },
  { key: 'sales', label: 'Sales' },
  { key: 'supplierOrders', label: 'Supplier Order' },
  { key: 'supplierInformation', label: 'Information' },
];

const orderStatuses: Array<{ key: SupplierOrderStatus; label: string }> = [
  { key: 'request', label: 'Purchase request' },
  { key: 'ordered', label: 'Ordered' },
  { key: 'approved', label: 'Approved' },
  { key: 'stocked', label: 'Stocked' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'unavailable', label: 'Unavailable' },
];

const paymentStatuses: Array<{ key: SupplierPaymentStatus; label: string }> = [
  { key: 'pending', label: 'Awaiting payment' },
  { key: 'paid', label: 'Paid' },
  { key: 'without_payment', label: 'Issued without payment' },
  { key: 'cancelled', label: 'Cancelled' },
];

const supplierOrdersFiltersStorageKey = 'project-goods.supplier-orders-filters';
const supplierOrdersColumnsStorageKey = 'project-goods.supplier-orders-columns';
const supplierOrderDateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const getSupplierOrderStatusClass = (status: SupplierOrderStatus) =>
  `supplier-order-status-badge supplier-order-status-${status}`;

const getSupplierPaymentStatusClass = (status: SupplierPaymentStatus) =>
  `supplier-payment-status-badge supplier-payment-status-${status}`;

const getSupplierOrderStatusLabel = (status: SupplierOrderStatus) =>
  orderStatuses.find((item) => item.key === status)?.label ?? status;

const getSupplierPaymentStatusLabel = (status: SupplierPaymentStatus) =>
  paymentStatuses.find((item) => item.key === status)?.label ?? status;

const formatSupplierOrderDate = (value: string) =>
  supplierOrderDateFormatter.format(new Date(value));

const formatPercent = (value: number) => `${value.toFixed(value % 1 === 0 ? 0 : 2)}%`;

type SupplierOrdersColumnKey =
  | 'number'
  | 'product'
  | 'quantity'
  | 'price'
  | 'total'
  | 'paid'
  | 'supplier'
  | 'deliveryDate'
  | 'status'
  | 'paymentStatus';

const supplierOrdersAllColumns: SupplierOrdersColumnKey[] = [
  'number',
  'product',
  'quantity',
  'price',
  'total',
  'paid',
  'supplier',
  'deliveryDate',
  'status',
  'paymentStatus',
];

const supplierOrdersLockedColumns: SupplierOrdersColumnKey[] = ['number'];

const getSupplierOrdersColumnLabel = (columnKey: SupplierOrdersColumnKey) => {
  switch (columnKey) {
    case 'number':
      return 'No.';
    case 'product':
      return 'Product';
    case 'quantity':
      return 'Qty';
    case 'price':
      return 'Price';
    case 'total':
      return 'Total';
    case 'paid':
      return 'Paid';
    case 'supplier':
      return 'Supplier';
    case 'deliveryDate':
      return 'Delivery date';
    case 'status':
      return 'Status';
    case 'paymentStatus':
      return 'Payment status';
    default:
      return columnKey;
  }
};

const SupplierInformationMetric = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) => (
  <article className='supplier-information-card'>
    <span>{label}</span>
    <strong>{value}</strong>
    {hint ? <small>{hint}</small> : null}
  </article>
);

const SupplierInformationProductList = ({
  title,
  items,
  valueLabel,
  getValue,
}: {
  title: string;
  items: SupplierOrderProductStat[];
  valueLabel: string;
  getValue: (item: SupplierOrderProductStat) => string;
}) => (
  <section className='supplier-information-panel'>
    <h2>{title}</h2>
    <div className='supplier-information-list'>
      {items.length > 0 ? (
        items.map((item) => (
          <div key={`${title}-${item.productName}`}>
            <span>{item.productName}</span>
            <strong>{getValue(item)}</strong>
            <small>
              {`${item.quantity} pcs | ${valueLabel}: ${formatCurrency(item.total)}`}
            </small>
          </div>
        ))
      ) : (
        <p className='orders-empty'>No product data.</p>
      )}
    </div>
  </section>
);

const SupplierInformationSupplierList = ({
  title,
  items,
  getValue,
}: {
  title: string;
  items: SupplierOrderSupplierStat[];
  getValue: (item: SupplierOrderSupplierStat) => string;
}) => (
  <section className='supplier-information-panel'>
    <h2>{title}</h2>
    <div className='supplier-information-list'>
      {items.length > 0 ? (
        items.map((item) => (
          <div key={`${title}-${item.supplierId}-${item.supplierName}`}>
            <span>{item.supplierName}</span>
            <strong>{getValue(item)}</strong>
            <small>{`${item.orderCount} orders | paid ${formatCurrency(item.paid)}`}</small>
          </div>
        ))
      ) : (
        <p className='orders-empty'>No supplier data.</p>
      )}
    </div>
  </section>
);

export const SupplierOrdersWorkspace = ({
  activeTab,
  onActiveTabChange,
  suppliers,
  catalogProducts,
  currentEmployeeName,
  onCreateSupplier,
  onUpdateSupplier,
  onUpdateCatalogProduct,
  onSuccess,
  onError,
}: Props) => {
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [query, setQuery] = useState(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(supplierOrdersFiltersStorageKey) ?? '{}') as Partial<{ query: string }>;
      return parsed.query ?? '';
    } catch {
      return '';
    }
  });
  const [selectedStatuses, setSelectedStatuses] = useState<SupplierOrderStatus[]>(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(supplierOrdersFiltersStorageKey) ?? '{}') as Partial<{ selectedStatuses: SupplierOrderStatus[] }>;
      return Array.isArray(parsed.selectedStatuses) ? parsed.selectedStatuses : [];
    } catch {
      return [];
    }
  });
  const [paymentStatus, setPaymentStatus] = useState<SupplierPaymentStatus | 'all'>(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(supplierOrdersFiltersStorageKey) ?? '{}') as Partial<{ paymentStatus: SupplierPaymentStatus | 'all' }>;
      return parsed.paymentStatus === 'pending' || parsed.paymentStatus === 'paid' || parsed.paymentStatus === 'without_payment' || parsed.paymentStatus === 'cancelled' || parsed.paymentStatus === 'all'
        ? parsed.paymentStatus
        : 'all';
    } catch {
      return 'all';
    }
  });
  const [deliveryDateFrom, setDeliveryDateFrom] = useState(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(supplierOrdersFiltersStorageKey) ?? '{}') as Partial<{ deliveryDate: string; deliveryDateFrom: string }>;
      return parsed.deliveryDateFrom ?? parsed.deliveryDate ?? '';
    } catch {
      return '';
    }
  });
  const [deliveryDateTo, setDeliveryDateTo] = useState(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(supplierOrdersFiltersStorageKey) ?? '{}') as Partial<{ deliveryDate: string; deliveryDateTo: string }>;
      return parsed.deliveryDateTo ?? parsed.deliveryDate ?? '';
    } catch {
      return '';
    }
  });
  const [isFilterBarOpen, setIsFilterBarOpen] = useState(false);
  const [isOrderStatusOpen, setIsOrderStatusOpen] = useState(false);
  const [isPaymentStatusOpen, setIsPaymentStatusOpen] = useState(false);
  const [isColumnsMenuOpen, setIsColumnsMenuOpen] = useState(false);
  const [openStatusOrder, setOpenStatusOrder] = useState<{
    key: string;
    order: SupplierOrder;
  } | null>(null);
  const [statusMenuPosition, setStatusMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [statusQuery, setStatusQuery] = useState('');
  const [paymentQuery, setPaymentQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SupplierOrder | null>(null);
  const orderStatusFilterRef = useRef<HTMLDivElement | null>(null);
  const paymentStatusFilterRef = useRef<HTMLDivElement | null>(null);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<SupplierOrdersColumnKey[]>(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(supplierOrdersColumnsStorageKey) ?? '[]') as SupplierOrdersColumnKey[];
      if (!Array.isArray(parsed) || parsed.length === 0) return supplierOrdersAllColumns;
      const normalized = supplierOrdersAllColumns.filter((key) => parsed.includes(key));
      return normalized.length > 0 ? normalized : supplierOrdersAllColumns;
    } catch {
      return supplierOrdersAllColumns;
    }
  });

  const [selectedSupplierForEdit, setSelectedSupplierForEdit] = useState<Supplier | null>(null);
  const [selectedCatalogProductForEdit, setSelectedCatalogProductForEdit] = useState<CatalogProduct | null>(null);
  const [supplierEditForm, setSupplierEditForm] = useState({ name: '', phone: '', note: '', isActive: true });
  const [productEditForm, setProductEditForm] = useState({ name: '', note: '', isActive: true });
  const [isSupplierSaving, setIsSupplierSaving] = useState(false);
  const [isProductSaving, setIsProductSaving] = useState(false);
  const [defaultTakeOnChargeWarehouse, setDefaultTakeOnChargeWarehouse] =
    useState<{ warehouseId: string; locationId: string } | null>(null);

  useEffect(() => {
    const closeMenusOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (
        isOrderStatusOpen &&
        orderStatusFilterRef.current &&
        !orderStatusFilterRef.current.contains(target)
      ) {
        setIsOrderStatusOpen(false);
      }

      if (
        isPaymentStatusOpen &&
        paymentStatusFilterRef.current &&
        !paymentStatusFilterRef.current.contains(target)
      ) {
        setIsPaymentStatusOpen(false);
      }

      if (
        openStatusOrder &&
        !target.closest('.supplier-order-status-picker') &&
        !target.closest('.supplier-order-status-menu-portal')
      ) {
        setOpenStatusOrder(null);
      }

      if (
        isColumnsMenuOpen &&
        columnsMenuRef.current &&
        !columnsMenuRef.current.contains(target)
      ) {
        setIsColumnsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', closeMenusOnOutsideClick);
    return () => {
      document.removeEventListener('mousedown', closeMenusOnOutsideClick);
    };
  }, [isColumnsMenuOpen, isOrderStatusOpen, isPaymentStatusOpen, openStatusOrder]);

  useEffect(() => {
    if (!openStatusOrder) {
      setStatusMenuPosition(null);
      return;
    }

    const closeStatusMenu = () => {
      setOpenStatusOrder(null);
    };

    const closeStatusMenuOnOutsideScroll = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.supplier-order-status-menu-portal')) {
        return;
      }
      closeStatusMenu();
    };

    window.addEventListener('resize', closeStatusMenu);
    window.addEventListener('scroll', closeStatusMenuOnOutsideScroll, true);
    return () => {
      window.removeEventListener('resize', closeStatusMenu);
      window.removeEventListener(
        'scroll',
        closeStatusMenuOnOutsideScroll,
        true,
      );
    };
  }, [openStatusOrder]);

  const refreshOrders = async () => {
    setIsLoading(true);
    try {
      const loaded = await getSupplierOrders();
      setOrders(loaded);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to load supplier orders.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshOrders();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const settings = await getWarehouseSettings();
        const activeWarehouses = settings.warehouses.filter(
          (warehouse) => warehouse.isActive,
        );
        const sourceWarehouses =
          activeWarehouses.length > 0
            ? activeWarehouses
            : settings.warehouses;
        const defaultWarehouse = sourceWarehouses[0];
        const defaultLocation = defaultWarehouse?.locations[0];
        if (!defaultWarehouse?.id || !defaultLocation?.id) {
          setDefaultTakeOnChargeWarehouse(null);
          return;
        }
        setDefaultTakeOnChargeWarehouse({
          warehouseId: defaultWarehouse.id,
          locationId: defaultLocation.id,
        });
      } catch {
        setDefaultTakeOnChargeWarehouse(null);
      }
    })();
  }, []);

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (normalized) {
        const matchesNumber =
          order.number.toLowerCase().includes(normalized) ||
          order.orderBaseId.toLowerCase().includes(normalized);
        const matchesProduct = order.items.some((item) =>
          item.productName.toLowerCase().includes(normalized),
        );
        const matchesSupplier =
          order.supplierName.toLowerCase().includes(normalized);

        if (!matchesNumber && !matchesProduct && !matchesSupplier) {
          return false;
        }
      }
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(order.status)) return false;
      if (paymentStatus !== 'all' && order.paymentStatus !== paymentStatus) return false;
      const orderDate = order.deliveryDate.slice(0, 10);
      if (deliveryDateFrom && orderDate < deliveryDateFrom) return false;
      if (deliveryDateTo && orderDate > deliveryDateTo) return false;
      return true;
    });
  }, [deliveryDateFrom, deliveryDateTo, orders, paymentStatus, query, selectedStatuses]);

  const filteredOrderStatuses = useMemo(() => {
    const normalized = statusQuery.trim().toLowerCase();
    return normalized ? orderStatuses.filter((item) => item.label.toLowerCase().includes(normalized)) : orderStatuses;
  }, [statusQuery]);

  const filteredPaymentStatuses = useMemo(() => {
    const normalized = paymentQuery.trim().toLowerCase();
    return normalized ? paymentStatuses.filter((item) => item.label.toLowerCase().includes(normalized)) : paymentStatuses;
  }, [paymentQuery]);

  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, page, pageSize]);
  const isInformationTab = activeTab === 'supplierInformation';
  const supplierInformation = useMemo(
    () => buildSupplierOrderAnalytics(filteredOrders),
    [filteredOrders],
  );

  const toggleStatus = (status: SupplierOrderStatus) => {
    setSelectedStatuses((current) => (current.includes(status) ? current.filter((item) => item !== status) : [...current, status]));
    setPage(1);
  };

  useEffect(() => {
    window.localStorage.setItem(supplierOrdersFiltersStorageKey, JSON.stringify({ query, selectedStatuses, paymentStatus, deliveryDateFrom, deliveryDateTo }));
  }, [deliveryDateFrom, deliveryDateTo, paymentStatus, query, selectedStatuses]);

  useEffect(() => {
    window.localStorage.setItem(
      supplierOrdersColumnsStorageKey,
      JSON.stringify(visibleColumns),
    );
  }, [visibleColumns]);

  const dateFiltersCount =
    (deliveryDateFrom ? 1 : 0) + (deliveryDateTo ? 1 : 0);

  const toggleColumnVisibility = (columnKey: SupplierOrdersColumnKey) => {
    if (supplierOrdersLockedColumns.includes(columnKey)) return;
    setVisibleColumns((current) =>
      current.includes(columnKey)
        ? current.filter((key) => key !== columnKey)
        : supplierOrdersAllColumns.filter(
            (key) => key === columnKey || current.includes(key),
          ),
    );
  };

  const updateSupplierOrderStatus = async (
    order: SupplierOrder,
    nextStatus: SupplierOrderStatus,
  ) => {
    try {
      if (nextStatus === order.status) {
        setOpenStatusOrder(null);
        return;
      }

      if (nextStatus === 'stocked') {
        if (!defaultTakeOnChargeWarehouse) {
          onError('Default warehouse or location for stock receipt was not found.');
          return;
        }
        await takeOnChargeSupplierOrder(order.id, {
          autoGenerateSerialNumbers: true,
          serialNumbers: [],
          autoGenerateArticles: false,
          articleBase: '',
          warehouseId: defaultTakeOnChargeWarehouse.warehouseId,
          locationId: defaultTakeOnChargeWarehouse.locationId,
        });
      } else {
        await updateSupplierOrder(order.id, {
          orderBaseId: order.orderBaseId,
          supplierId: order.supplierId,
          deliveryDate: order.deliveryDate.slice(0, 10),
          supplyType: order.supplyType,
          number: order.number,
          note: order.note,
          createdBy: order.createdBy,
          paymentStatus: order.paymentStatus,
          status: nextStatus,
          items: order.items,
        });
      }
      setOpenStatusOrder(null);
      await refreshOrders();
      onSuccess('Supplier order status updated.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to update supplier order status.');
    }
  };

  useEffect(() => {
    if (!selectedSupplierForEdit) return;
    setSupplierEditForm({
      name: selectedSupplierForEdit.name,
      phone: selectedSupplierForEdit.phone,
      note: selectedSupplierForEdit.note,
      isActive: selectedSupplierForEdit.isActive,
    });
  }, [selectedSupplierForEdit]);

  useEffect(() => {
    if (!selectedCatalogProductForEdit) return;
    setProductEditForm({
      name: selectedCatalogProductForEdit.name,
      note: selectedCatalogProductForEdit.note,
      isActive: selectedCatalogProductForEdit.isActive,
    });
  }, [selectedCatalogProductForEdit]);

  const groupedOrderView = (order: SupplierOrder) =>
    order.items.map((item) => ({
      id: buildSupplierOrderItemNumber(order, item.itemIndex),
      item,
      order,
    }));

  return (
    <section className='orders-page'>
      <div className='orders-tabs' role='tablist' aria-label='Order categories'>
        {tabs.map((tab) => (
          <button key={tab.key} type='button' className={tab.key === activeTab ? 'orders-tab orders-tab-active' : 'orders-tab'} onClick={() => onActiveTabChange(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className='orders-toolbar'>
        <div className='orders-toolbar-left supplier-orders-toolbar-left'>
          <button
            type='button'
            className='toolbar-filter-button toolbar-filter-toggle-button'
            aria-expanded={isFilterBarOpen}
            onClick={() => setIsFilterBarOpen((current) => !current)}
          >
            Data
            {dateFiltersCount > 0 ? (
              <span className='toolbar-filter-count'>{dateFiltersCount}</span>
            ) : null}
          </button>

          {!isInformationTab ? (
            <div className='toolbar-settings' ref={columnsMenuRef}>
              <button
                type='button'
                className='toolbar-square-button'
                aria-label='Toggle table columns'
                aria-expanded={isColumnsMenuOpen}
                onClick={() => setIsColumnsMenuOpen((current) => !current)}
              >
                <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' className='toolbar-square-button-icon' fill='currentColor'>
                  <path d='M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.03 7.03 0 0 0-1.69-.98l-.38-2.65A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.49.42l-.38 2.65c-.63.25-1.21.57-1.75.95l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.14.24.42.33.68.22l2.49-1c.54.38 1.12.7 1.75.95l.38 2.65c.04.27.26.47.49.47h4c.27 0 .5-.2.54-.47l.38-2.65c.63-.25 1.21-.57 1.75-.95l2.49 1c.26.11.54.02.68-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z' />
                </svg>
              </button>
              {isColumnsMenuOpen ? (
                <div className='toolbar-settings-menu'>
                  {supplierOrdersAllColumns.map((columnKey) => (
                    <label key={columnKey} className='toolbar-settings-option'>
                      <input
                        type='checkbox'
                        checked={visibleColumns.includes(columnKey)}
                        disabled={supplierOrdersLockedColumns.includes(columnKey)}
                        onChange={() => toggleColumnVisibility(columnKey)}
                      />
                      <span>{getSupplierOrdersColumnLabel(columnKey)}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className='supplier-orders-quick-filters'>
            <div className='orders-search-group orders-search-group-clearable'>
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder='Search by number, product, supplier' />
            {query ? (
              <span
                role='button'
                tabIndex={0}
                className='orders-search-clear'
                aria-label='Clear search text'
                onClick={() => { setQuery(''); setPage(1); }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setQuery('');
                    setPage(1);
                  }
                }}
              >
                x
              </span>
            ) : null}
            </div>

            <div className='orders-filter-field orders-filter-status-field' ref={orderStatusFilterRef}>
            <button type='button' className='orders-filter-status-toggle' aria-expanded={isOrderStatusOpen} onClick={() => setIsOrderStatusOpen((current) => !current)}>
              {selectedStatuses.length > 0
                ? `${selectedStatuses.length} order statuses`
                : 'Order status'}
            </button>
            {isOrderStatusOpen ? (
              <div className='orders-filter-status-menu'>
                <input value={statusQuery} onChange={(event) => setStatusQuery(event.target.value)} placeholder='Search' />
                <label className='orders-filter-status-all'>
                  <input type='checkbox' checked={selectedStatuses.length === orderStatuses.length} onChange={() => setSelectedStatuses((current) => current.length === orderStatuses.length ? [] : orderStatuses.map((item) => item.key))} />
                  <span>Select all</span>
                </label>
                {filteredOrderStatuses.map((status) => (
                  <label key={status.key}><input type='checkbox' checked={selectedStatuses.includes(status.key)} onChange={() => toggleStatus(status.key)} /><span>{status.label}</span></label>
                ))}
              </div>
            ) : null}
            </div>

            <div className='orders-filter-field orders-filter-status-field' ref={paymentStatusFilterRef}>
            <button type='button' className='orders-filter-status-toggle' aria-expanded={isPaymentStatusOpen} onClick={() => setIsPaymentStatusOpen((current) => !current)}>
              {paymentStatus === 'all' ? 'All payment statuses' : getSupplierPaymentStatusLabel(paymentStatus)}
            </button>
            {isPaymentStatusOpen ? (
              <div className='orders-filter-status-menu'>
                <input value={paymentQuery} onChange={(event) => setPaymentQuery(event.target.value)} placeholder='Search' />
                <label><input type='radio' checked={paymentStatus === 'all'} onChange={() => setPaymentStatus('all')} /><span>All payment statuses</span></label>
                {filteredPaymentStatuses.map((status) => (
                  <label key={status.key}><input type='radio' checked={paymentStatus === status.key} onChange={() => setPaymentStatus(status.key)} /><span>{status.label}</span></label>
                ))}
              </div>
            ) : null}
            </div>

          </div>
        </div>

        <div className='orders-toolbar-actions'>
          <button type='button' className='orders-create-button' onClick={() => { setEditingOrder(null); setIsModalOpen(true); }}>
            Order from supplier
          </button>
        </div>
      </div>

      <section
        className={
          isFilterBarOpen
            ? 'orders-filter-panel orders-filter-panel-open'
            : 'orders-filter-panel'
        }
        aria-hidden={!isFilterBarOpen}
      >
        <div className='orders-filter-grid'>
          <label className='orders-filter-field supplier-orders-date-filter'>
            <span>Date from</span>
            <input
              type='date'
              value={deliveryDateFrom}
              onChange={(event) => {
                setDeliveryDateFrom(event.target.value);
                setPage(1);
              }}
            />
          </label>

          <label className='orders-filter-field supplier-orders-date-filter'>
            <span>Date to</span>
            <input
              type='date'
              value={deliveryDateTo}
              onChange={(event) => {
                setDeliveryDateTo(event.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>

        <div className='orders-filter-actions'>
          <button
            type='button'
            className='toolbar-filter-button'
            onClick={() => {
              setDeliveryDateFrom('');
              setDeliveryDateTo('');
              setPage(1);
            }}
          >
            Clear dates
          </button>
        </div>
      </section>

      {isInformationTab ? (
        <section className='supplier-information-dashboard'>
          {isLoading ? <p className='orders-empty'>Loading...</p> : null}
          {!isLoading && filteredOrders.length === 0 ? (
            <p className='orders-empty'>
              No supplier-order information for the selected filters.
            </p>
          ) : null}

          <div className='supplier-information-summary'>
            <SupplierInformationMetric
              label='Supplier orders'
              value={String(supplierInformation.orderCount)}
              hint={`${supplierInformation.totalQuantity} pcs ordered`}
            />
            <SupplierInformationMetric
              label='Total value'
              value={formatCurrency(supplierInformation.totalValue)}
              hint='Filtered procurement spend'
            />
            <SupplierInformationMetric
              label='Paid'
              value={formatCurrency(supplierInformation.paidAmount)}
              hint={`${formatPercent(supplierInformation.paymentCoveragePercent)} covered`}
            />
            <SupplierInformationMetric
              label='Outstanding'
              value={formatCurrency(supplierInformation.outstandingAmount)}
              hint='Still pending payment'
            />
            <SupplierInformationMetric
              label='Average order'
              value={formatCurrency(supplierInformation.averageOrderValue)}
              hint='Mean supplier-order value'
            />
            <SupplierInformationMetric
              label='Stocked rate'
              value={formatPercent(supplierInformation.stockedRate)}
              hint='Stocked or received orders'
            />
          </div>

          <div className='supplier-information-grid'>
            <SupplierInformationProductList
              title='Most popular goods'
              items={supplierInformation.topProductsByQuantity}
              valueLabel='value'
              getValue={(item) => `${item.quantity} pcs`}
            />
            <SupplierInformationProductList
              title='Highest purchase value'
              items={supplierInformation.topProductsByValue}
              valueLabel='value'
              getValue={(item) => formatCurrency(item.total)}
            />
            <SupplierInformationProductList
              title='Most frequent goods'
              items={supplierInformation.topProductsByFrequency}
              valueLabel='value'
              getValue={(item) => `${item.orderCount} orders`}
            />
            <section className='supplier-information-panel'>
              <h2>Price analysis</h2>
              <div className='supplier-information-price-grid'>
                <div>
                  <span>Lowest price</span>
                  <strong>
                    {supplierInformation.lowestPricePosition
                      ? formatCurrency(supplierInformation.lowestPricePosition.price)
                      : '-'}
                  </strong>
                  <small>
                    {supplierInformation.lowestPricePosition
                      ? `${supplierInformation.lowestPricePosition.productName} | ${supplierInformation.lowestPricePosition.orderNumber}`
                      : 'No product positions'}
                  </small>
                </div>
                <div>
                  <span>Highest price</span>
                  <strong>
                    {supplierInformation.highestPricePosition
                      ? formatCurrency(supplierInformation.highestPricePosition.price)
                      : '-'}
                  </strong>
                  <small>
                    {supplierInformation.highestPricePosition
                      ? `${supplierInformation.highestPricePosition.productName} | ${supplierInformation.highestPricePosition.orderNumber}`
                      : 'No product positions'}
                  </small>
                </div>
              </div>
              <div className='supplier-information-list'>
                {supplierInformation.productPriceRanges.length > 0 ? (
                  supplierInformation.productPriceRanges.map((item) => (
                    <div key={`range-${item.productName}`}>
                      <span>{item.productName}</span>
                      <strong>{`${formatCurrency(item.minPrice)} - ${formatCurrency(item.maxPrice)}`}</strong>
                      <small>{`Avg ${formatCurrency(item.averagePrice)} | ${item.lineCount} lines`}</small>
                    </div>
                  ))
                ) : (
                  <p className='orders-empty'>No repeated price ranges.</p>
                )}
              </div>
            </section>
            <SupplierInformationSupplierList
              title='Top suppliers by spend'
              items={supplierInformation.topSuppliersBySpend}
              getValue={(item) => formatCurrency(item.total)}
            />
            <SupplierInformationSupplierList
              title='Suppliers by pending amount'
              items={supplierInformation.topSuppliersByPending}
              getValue={(item) => formatCurrency(item.outstanding)}
            />
            <section className='supplier-information-panel supplier-information-signals'>
              <h2>Business signals</h2>
              <div className='supplier-information-signal-list'>
                <div>
                  <span>Overdue orders</span>
                  <strong>{supplierInformation.overdueCount}</strong>
                </div>
                <div>
                  <span>Late risk in 3 days</span>
                  <strong>{supplierInformation.lateRiskCount}</strong>
                </div>
                <div>
                  <span>Cancelled / unavailable</span>
                  <strong>
                    {formatPercent(supplierInformation.cancelledUnavailableRate)}
                  </strong>
                </div>
                <div>
                  <span>Payment coverage</span>
                  <strong>
                    {formatPercent(supplierInformation.paymentCoveragePercent)}
                  </strong>
                </div>
              </div>
            </section>
          </div>
        </section>
      ) : (
        <>
          <div className='orders-table-wrap'>
            <table className='orders-table supplier-orders-table'>
              <thead>
                <tr>
                  {visibleColumns.includes('number') ? <th className='supplier-orders-col-number'>No.</th> : null}
                  {visibleColumns.includes('product') ? <th className='supplier-orders-col-product'>Product</th> : null}
                  {visibleColumns.includes('quantity') ? <th className='supplier-orders-col-quantity'>Qty</th> : null}
                  {visibleColumns.includes('price') ? <th className='supplier-orders-col-money'>Price</th> : null}
                  {visibleColumns.includes('total') ? <th className='supplier-orders-col-money'>Total</th> : null}
                  {visibleColumns.includes('paid') ? <th className='supplier-orders-col-money'>Paid</th> : null}
                  {visibleColumns.includes('supplier') ? <th className='supplier-orders-col-supplier'>Supplier</th> : null}
                  {visibleColumns.includes('deliveryDate') ? <th className='supplier-orders-col-date'>Delivery date</th> : null}
                  {visibleColumns.includes('status') ? <th className='supplier-orders-col-status'>Status</th> : null}
                  {visibleColumns.includes('paymentStatus') ? <th className='supplier-orders-col-payment'>Payment status</th> : null}
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.flatMap((order) =>
                  groupedOrderView(order).map(({ id, item }) => (
                    <tr key={id}>
                      {visibleColumns.includes('number') ? <td><button type='button' className='catalog-name-button' onClick={() => { if (order.paymentStatus === 'paid' || order.paymentStatus === 'without_payment') return; setEditingOrder(order); setIsModalOpen(true); }}>{id}</button></td> : null}
                      {visibleColumns.includes('product') ? <td>
                        <button type='button' className='catalog-name-button' onClick={() => {
                          const matchedProduct = item.catalogProductId
                            ? catalogProducts.find(
                                (product) =>
                                  product.id === item.catalogProductId,
                              )
                            : catalogProducts.find((product) => product.name.trim().toLowerCase() === item.productName.trim().toLowerCase());
                          if (!matchedProduct) {
                            onError('Product was not found in the Products catalog.');
                            return;
                          }
                          setSelectedCatalogProductForEdit(matchedProduct);
                        }}>{item.productName}</button>
                      </td> : null}
                      {visibleColumns.includes('quantity') ? <td>{item.quantity} pcs</td> : null}
                      {visibleColumns.includes('price') ? <td>{formatCurrency(item.price)}</td> : null}
                      {visibleColumns.includes('total') ? <td>{formatCurrency(item.quantity * item.price)}</td> : null}
                      {visibleColumns.includes('paid') ? <td>{formatCurrency(order.paid)}</td> : null}
                      {visibleColumns.includes('supplier') ? <td>
                        <button type='button' className='catalog-name-button' onClick={() => {
                          const matchedSupplier = suppliers.find((supplier) => supplier.id === order.supplierId);
                          if (!matchedSupplier) {
                            onError('Supplier was not found.');
                            return;
                          }
                          setSelectedSupplierForEdit(matchedSupplier);
                        }}>{order.supplierName}</button>
                      </td> : null}
                      {visibleColumns.includes('deliveryDate') ? <td>{formatSupplierOrderDate(order.deliveryDate)}</td> : null}
                      {visibleColumns.includes('status') ? <td>
                        <div className='supplier-order-status-picker'>
                          <button
                            type='button'
                            className={getSupplierOrderStatusClass(order.status)}
                            disabled={order.paymentStatus === 'cancelled'}
                            aria-expanded={openStatusOrder?.key === id}
                            onClick={(event) => {
                              const rect = event.currentTarget.getBoundingClientRect();
                              setStatusMenuPosition({
                                top: rect.bottom + 4,
                                left: rect.left,
                              });
                              setOpenStatusOrder((current) =>
                                current?.key === id ? null : { key: id, order },
                              );
                            }}
                          >
                            {getSupplierOrderStatusLabel(order.status)}
                          </button>
                        </div>
                      </td> : null}
                      {visibleColumns.includes('paymentStatus') ? <td>
                        <span className={getSupplierPaymentStatusClass(order.paymentStatus)}>
                          {getSupplierPaymentStatusLabel(order.paymentStatus)}
                        </span>
                      </td> : null}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
            {isLoading ? <p className='orders-empty'>Loading...</p> : null}
            {!isLoading && paginatedOrders.length === 0 ? <p className='orders-empty'>No supplier orders found.</p> : null}
          </div>

          <PaginationPanel totalItems={filteredOrders.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(nextSize) => { setPageSize(nextSize); setPage(1); }} />
        </>
      )}

      {openStatusOrder &&
      statusMenuPosition &&
      typeof document !== 'undefined'
        ? createPortal(
            <div
              className='supplier-order-status-menu supplier-order-status-menu-portal'
              style={{
                top: statusMenuPosition.top,
                left: statusMenuPosition.left,
              }}
            >
              {orderStatuses.map((status) => (
                <button
                  key={status.key}
                  type='button'
                  className={
                    status.key === openStatusOrder.order.status
                      ? 'supplier-order-status-option supplier-order-status-option-active'
                      : 'supplier-order-status-option'
                  }
                  onClick={() =>
                    void updateSupplierOrderStatus(
                      openStatusOrder.order,
                      status.key,
                    )
                  }
                >
                  {status.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}

      <SupplierOrderModal
        isOpen={isModalOpen}
        suppliers={suppliers}
        editingOrder={editingOrder}
        forceReadOnly={Boolean(
          editingOrder &&
            (editingOrder.status === 'stocked' ||
              editingOrder.receiptStatus === 'received' ||
              editingOrder.status === 'cancelled' ||
              editingOrder.paymentStatus === 'cancelled'),
        )}
        onClose={() => { setIsModalOpen(false); setEditingOrder(null); }}
        onCreateSupplier={onCreateSupplier}
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
          if (!editingOrder) return;
          const result = await takeOnChargeSupplierOrder(editingOrder.id, {
            autoGenerateSerialNumbers,
            serialNumbers,
            autoGenerateArticles,
            articleBase: articleBase.trim().toUpperCase(),
            warehouseId,
            locationId,
          });
          onSuccess('Supplier order stocked.');
          window.dispatchEvent(new Event('project-goods:finance-updated'));
          window.dispatchEvent(new Event('project-goods:products-updated'));
          await refreshOrders();
          return result;
        }}
        onCancelOrder={async () => {
          if (!editingOrder) return;
          await cancelSupplierOrder(editingOrder.id);
          onSuccess('Supplier order cancelled.');
          await refreshOrders();
        }}
        onSubmit={async (payload: SupplierOrderModalSubmitPayload) => {
          try {
            const basePayload: SupplierOrderFormValues = {
              supplierId: payload.supplierId,
              deliveryDate: payload.deliveryDate,
              supplyType: payload.supplyType,
              number: payload.number,
              note: payload.note,
              createdBy: currentEmployeeName,
              items: payload.items,
            };

            if (!editingOrder) {
              await createSupplierOrder({ ...basePayload, orderBaseId: `SO-${Date.now()}` });
              onSuccess('Supplier order created.');
            } else {
              await updateSupplierOrder(editingOrder.id, { ...basePayload, orderBaseId: editingOrder.orderBaseId });
              onSuccess('Supplier order updated.');
            }
            await refreshOrders();
          } catch (error) {
            onError(error instanceof Error ? error.message : 'Failed to save supplier order.');
          }
        }}
      />

      {selectedSupplierForEdit ? (
        <div className='modal-backdrop' role='presentation' onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedSupplierForEdit(null); }}>
          <section className='catalog-edit-modal' role='dialog' aria-modal='true'>
            <header className='catalog-edit-header'><div className='catalog-edit-title'><h2>Supplier</h2></div><button type='button' className='create-order-close' onClick={() => setSelectedSupplierForEdit(null)} aria-label='Close'>&times;</button></header>
            <div className='catalog-edit-body'>
              <label className='field'><span>Name</span><input value={supplierEditForm.name} onChange={(event) => setSupplierEditForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label className='field'><span>Phone</span><input value={supplierEditForm.phone} onChange={(event) => setSupplierEditForm((current) => ({ ...current, phone: event.target.value }))} /></label>
              <label className='field field-wide'><span>Note</span><textarea rows={3} value={supplierEditForm.note} onChange={(event) => setSupplierEditForm((current) => ({ ...current, note: event.target.value }))} /></label>
            </div>
            <footer className='catalog-edit-footer'>
              <button
                type='button'
                className='primary-button'
                disabled={isSupplierSaving || supplierEditForm.name.trim().length < 2 || supplierEditForm.phone.trim().length < 3}
                onClick={async () => {
                  if (!selectedSupplierForEdit) return;
                  setIsSupplierSaving(true);
                  const ok = await onUpdateSupplier(selectedSupplierForEdit.id, { name: supplierEditForm.name.trim(), phone: supplierEditForm.phone.trim(), note: supplierEditForm.note.trim(), supplierOrder: selectedSupplierForEdit.supplierOrder, isActive: supplierEditForm.isActive });
                  setIsSupplierSaving(false);
                  if (!ok) return;
                  onSuccess('Supplier updated.');
                  await refreshOrders();
                  setSelectedSupplierForEdit(null);
                }}
              >
                {isSupplierSaving ? 'Saving...' : 'Save'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {selectedCatalogProductForEdit ? (
        <div className='modal-backdrop' role='presentation' onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedCatalogProductForEdit(null); }}>
          <section className='catalog-edit-modal' role='dialog' aria-modal='true'>
            <header className='catalog-edit-header'><div className='catalog-edit-title'><h2>Product</h2></div><button type='button' className='create-order-close' onClick={() => setSelectedCatalogProductForEdit(null)} aria-label='Close'>&times;</button></header>
            <div className='catalog-edit-body'>
              <label className='field'><span>Product name</span><input value={productEditForm.name} onChange={(event) => setProductEditForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label className='field field-wide'><span>Note</span><textarea rows={3} value={productEditForm.note} onChange={(event) => setProductEditForm((current) => ({ ...current, note: event.target.value }))} /></label>
            </div>
            <footer className='catalog-edit-footer'>
              <button
                type='button'
                className='primary-button'
                disabled={isProductSaving || productEditForm.name.trim().length < 2}
                onClick={async () => {
                  if (!selectedCatalogProductForEdit) return;
                  setIsProductSaving(true);
                  const ok = await onUpdateCatalogProduct(selectedCatalogProductForEdit.id, { name: productEditForm.name.trim(), note: productEditForm.note.trim(), isActive: productEditForm.isActive });
                  setIsProductSaving(false);
                  if (!ok) return;
                  onSuccess('Product updated.');
                  await refreshOrders();
                  setSelectedCatalogProductForEdit(null);
                }}
              >
                {isProductSaving ? 'Saving...' : 'Save'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
};

