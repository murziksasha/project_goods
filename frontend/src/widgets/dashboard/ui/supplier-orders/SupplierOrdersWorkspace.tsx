import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CatalogProduct,
  CatalogProductFormValues,
} from '../../../../entities/catalog-product/model/types';
import type {
  Supplier,
  SupplierFormValues,
} from '../../../../entities/supplier/model/types';
import {
  useCancelSupplierOrderItemMutation,
  useCancelSupplierOrderMutation,
  useCreateSupplierOrderMutation,
  useSupplierOrdersQuery,
  useTakeOnChargeSupplierOrderMutation,
  useUpdateSupplierOrderFavoriteMutation,
  useUpdateSupplierOrderMutation,
} from '../../../../entities/supplier-order/api/supplierOrderApi';
import type {
  SupplierOrder,
  SupplierOrderFormValues,
  SupplierOrderStatus,
  SupplierPaymentStatus,
} from '../../../../entities/supplier-order/model/types';
import { getWarehouseSettings } from '../../../../entities/warehouse-settings/api/warehouseSettingsApi';
import {
  buildSupplierOrderAnalytics,
  resolveSupplierOrderErrorMessage,
} from '../../model/supplier-order-utils';
import {
  computeSupplierOrderStatusMenuPosition,
  filterSupplierOrders,
  getActiveSupplierOrderItems,
  isMultiItemSupplierOrder,
  normalizeSupplierOrdersColumns,
  paginateSupplierOrders,
  parseSupplierOrdersFilters,
  supplierOrderStatuses,
  supplierOrdersAllColumns,
  supplierOrdersColumnsStorageKey,
  supplierOrdersFiltersStorageKey,
  supplierOrdersLockedColumns,
  supplierPaymentStatuses,
  type OrdersTab,
  type SupplierOrdersColumnKey,
} from '../../model/supplier-orders-workspace';

const financeVisibilityStatuses: SupplierOrderStatus[] = [
  'approved',
  'partially_stocked',
  'partially_completed',
  'stocked',
  'cancelled',
];

const notifyFinanceUpdated = () => {
  window.dispatchEvent(new Event('project-goods:finance-updated'));
};
import { SupplierOrderModal, type SupplierOrderModalSubmitPayload } from '../orders/modals/SupplierOrderModal';
import {
  CatalogProductEditModal,
  SupplierEditModal,
  SupplierInformationDashboard,
  SupplierOrderStatusMenuPortal,
  SupplierOrdersDateFilterPanel,
  SupplierOrdersTable,
  SupplierOrdersToolbar,
} from './SupplierOrdersWorkspaceSections';

type Props = {
  activeTab: OrdersTab;
  onActiveTabChange: (tab: OrdersTab) => void;
  visibleTabs: OrdersTab[];
  suppliers: Supplier[];
  catalogProducts: CatalogProduct[];
  currentEmployeeName: string;
  canViewSupplierOrders: boolean;
  canManageSupplierOrders: boolean;
  onCreateSupplier: (payload: SupplierFormValues) => Promise<boolean>;
  onUpdateSupplier: (
    supplierId: string,
    payload: SupplierFormValues,
  ) => Promise<boolean>;
  onUpdateCatalogProduct: (
    catalogProductId: string,
    payload: CatalogProductFormValues,
  ) => Promise<boolean>;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export const SupplierOrdersWorkspace = ({
  activeTab,
  onActiveTabChange,
  visibleTabs,
  suppliers,
  catalogProducts,
  currentEmployeeName,
  canViewSupplierOrders,
  canManageSupplierOrders,
  onCreateSupplier,
  onUpdateSupplier,
  onUpdateCatalogProduct,
  onSuccess,
  onError,
}: Props) => {
  const { t } = useTranslation();
  const supplierOrdersQuery = useSupplierOrdersQuery(canViewSupplierOrders);
  const createSupplierOrderMutation = useCreateSupplierOrderMutation();
  const updateSupplierOrderMutation = useUpdateSupplierOrderMutation();
  const updateSupplierOrderFavoriteMutation =
    useUpdateSupplierOrderFavoriteMutation();
  const cancelSupplierOrderMutation = useCancelSupplierOrderMutation();
  const cancelSupplierOrderItemMutation =
    useCancelSupplierOrderItemMutation();
  const takeOnChargeSupplierOrderMutation =
    useTakeOnChargeSupplierOrderMutation();
  const orders = supplierOrdersQuery.data ?? [];
  const isLoading = supplierOrdersQuery.isLoading;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const initialFilters = useMemo(
    () =>
      parseSupplierOrdersFilters(
        window.localStorage.getItem(supplierOrdersFiltersStorageKey),
      ),
    [],
  );
  const [query, setQuery] = useState(initialFilters.query);
  const [selectedStatuses, setSelectedStatuses] = useState<
    SupplierOrderStatus[]
  >(initialFilters.selectedStatuses);
  const [paymentStatus, setPaymentStatus] = useState<
    SupplierPaymentStatus | 'all'
  >(initialFilters.paymentStatus);
  const [deliveryDateFrom, setDeliveryDateFrom] = useState(
    initialFilters.deliveryDateFrom,
  );
  const [deliveryDateTo, setDeliveryDateTo] = useState(
    initialFilters.deliveryDateTo,
  );
  const [favoritesOnly, setFavoritesOnly] = useState(
    initialFilters.favoritesOnly,
  );
  const [isFilterBarOpen, setIsFilterBarOpen] = useState(false);
  const [isOrderStatusOpen, setIsOrderStatusOpen] = useState(false);
  const [isPaymentStatusOpen, setIsPaymentStatusOpen] = useState(false);
  const [isColumnsMenuOpen, setIsColumnsMenuOpen] = useState(false);
  const [openStatusOrder, setOpenStatusOrder] = useState<{
    key: string;
    order: SupplierOrder;
    itemIndex: number | null;
  } | null>(null);
  const [expandedSupplierOrderIds, setExpandedSupplierOrderIds] = useState<
    Set<string>
  >(() => new Set());
  const [statusMenuPosition, setStatusMenuPosition] = useState<{
    top: number;
    left: number;
    maxHeight: number;
    placement: 'below' | 'above';
  } | null>(null);
  const [statusQuery, setStatusQuery] = useState('');
  const [paymentQuery, setPaymentQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SupplierOrder | null>(null);
  const [editingOrderSource, setEditingOrderSource] =
    useState<SupplierOrder | null>(null);
  const [editingOrderItemIndex, setEditingOrderItemIndex] = useState<
    number | null
  >(null);
  const orderStatusFilterRef = useRef<HTMLDivElement | null>(null);
  const paymentStatusFilterRef = useRef<HTMLDivElement | null>(null);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);
  const supplierOrdersTableWrapRef = useRef<HTMLDivElement | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<
    SupplierOrdersColumnKey[]
  >(() =>
    normalizeSupplierOrdersColumns(
      window.localStorage.getItem(supplierOrdersColumnsStorageKey),
    ),
  );

  const [selectedSupplierForEdit, setSelectedSupplierForEdit] =
    useState<Supplier | null>(null);
  const [selectedCatalogProductForEdit, setSelectedCatalogProductForEdit] =
    useState<CatalogProduct | null>(null);
  const [supplierEditForm, setSupplierEditForm] = useState({
    name: '',
    phone: '',
    note: '',
    isActive: true,
  });
  const [productEditForm, setProductEditForm] = useState({
    name: '',
    note: '',
    isActive: true,
  });
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

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    const tableWrap = supplierOrdersTableWrapRef.current;
    const previousTableWrapOverflow = tableWrap?.style.overflow ?? '';

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    if (tableWrap) {
      tableWrap.style.overflow = 'hidden';
    }

    const preventBackgroundScroll = (event: WheelEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.supplier-order-status-menu-portal')) return;
      event.preventDefault();
    };

    document.addEventListener('wheel', preventBackgroundScroll, {
      passive: false,
    });
    document.addEventListener('touchmove', preventBackgroundScroll, {
      passive: false,
    });

    const closeStatusMenu = () => {
      setOpenStatusOrder(null);
    };

    window.addEventListener('resize', closeStatusMenu);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
      if (tableWrap) {
        tableWrap.style.overflow = previousTableWrapOverflow;
      }
      document.removeEventListener('wheel', preventBackgroundScroll);
      document.removeEventListener('touchmove', preventBackgroundScroll);
      window.removeEventListener('resize', closeStatusMenu);
    };
  }, [openStatusOrder]);

  const refreshOrders = useCallback(async () => {
    try {
      await supplierOrdersQuery.refetch();
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('orders.supplier.messages.errors.failedLoad'),
      );
    }
  }, [onError, supplierOrdersQuery, t]);

  useEffect(() => {
    if (!supplierOrdersQuery.error) return;
    onError(
      supplierOrdersQuery.error instanceof Error
        ? supplierOrdersQuery.error.message
        : t('orders.supplier.messages.errors.failedLoad'),
    );
  }, [onError, supplierOrdersQuery.error, t]);

  useEffect(() => {
    void (async () => {
      try {
        const settings = await getWarehouseSettings();
        const activeWarehouses = settings.warehouses.filter(
          (warehouse) => warehouse.isActive,
        );
        const defaultWarehouse = activeWarehouses[0];
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

  const filteredOrders = useMemo(
    () =>
      filterSupplierOrders(orders, {
        query,
        selectedStatuses,
        paymentStatus,
        deliveryDateFrom,
        deliveryDateTo,
        favoritesOnly,
      }),
    [
      deliveryDateFrom,
      deliveryDateTo,
      favoritesOnly,
      orders,
      paymentStatus,
      query,
      selectedStatuses,
    ],
  );

  const filteredOrderStatuses = useMemo(() => {
    const normalized = statusQuery.trim().toLowerCase();
    return normalized
      ? supplierOrderStatuses.filter((item) =>
          t(item.labelKey).toLowerCase().includes(normalized),
        )
      : supplierOrderStatuses;
  }, [statusQuery, t]);

  const filteredPaymentStatuses = useMemo(() => {
    const normalized = paymentQuery.trim().toLowerCase();
    return normalized
      ? supplierPaymentStatuses.filter((item) =>
          t(item.labelKey).toLowerCase().includes(normalized),
        )
      : supplierPaymentStatuses;
  }, [paymentQuery, t]);

  const paginatedOrders = useMemo(
    () => paginateSupplierOrders(filteredOrders, page, pageSize),
    [filteredOrders, page, pageSize],
  );
  const isInformationTab = activeTab === 'supplierInformation';
  const supplierInformation = useMemo(
    () => buildSupplierOrderAnalytics(filteredOrders),
    [filteredOrders],
  );

  const toggleStatus = (status: SupplierOrderStatus) => {
    setSelectedStatuses((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status],
    );
    setPage(1);
  };

  useEffect(() => {
    window.localStorage.setItem(
      supplierOrdersFiltersStorageKey,
      JSON.stringify({
        query,
        selectedStatuses,
        paymentStatus,
        deliveryDateFrom,
        deliveryDateTo,
        favoritesOnly,
      }),
    );
  }, [
    deliveryDateFrom,
    deliveryDateTo,
    favoritesOnly,
    paymentStatus,
    query,
    selectedStatuses,
  ]);

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

  const toggleSupplierOrderExpanded = useCallback((orderId: string) => {
    setExpandedSupplierOrderIds((current) => {
      const next = new Set(current);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }, []);

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
          onError(t('orders.supplier.messages.errors.defaultWarehouseNotFound'));
          return;
        }

        const takeOnChargePayload = {
          autoGenerateSerialNumbers: true,
          serialNumbers: [] as string[],
          autoGenerateArticles: false,
          articleBase: '',
          warehouseId: defaultTakeOnChargeWarehouse.warehouseId,
          locationId: defaultTakeOnChargeWarehouse.locationId,
        };

        const requestedItemIndex = openStatusOrder?.itemIndex ?? undefined;
        const isBulkParent =
          requestedItemIndex === undefined &&
          openStatusOrder?.itemIndex === null &&
          isMultiItemSupplierOrder(order);

        const runTakeOnCharge = (itemIndex?: number) =>
          takeOnChargeSupplierOrderMutation.mutateAsync({
            supplierOrderId: order.id,
            payload: {
              ...takeOnChargePayload,
              ...(itemIndex === undefined ? {} : { itemIndex }),
            },
          });

        let takeOnChargeResult: SupplierOrder;
        if (isBulkParent) {
          const activeItems = getActiveSupplierOrderItems(order);
          if (activeItems.length === 0) {
            onError(t('orders.supplier.messages.errors.failedUpdateStatus'));
            return;
          }

          const hasReceivedItems = order.items.some(
            (item) => item.receiptStatus === 'received',
          );

          if (!hasReceivedItems && activeItems.length > 1) {
            takeOnChargeResult = await runTakeOnCharge();
          } else {
            let lastResult: SupplierOrder | undefined;
            for (const item of activeItems) {
              lastResult = await runTakeOnCharge(item.itemIndex);
            }
            if (!lastResult) {
              onError(t('orders.supplier.messages.errors.failedUpdateStatus'));
              return;
            }
            takeOnChargeResult = lastResult;
          }
        } else {
          takeOnChargeResult = await runTakeOnCharge(requestedItemIndex);
        }

        notifyFinanceUpdated();
        setOpenStatusOrder(null);
        onSuccess(
          takeOnChargeResult.status === 'partially_stocked'
            ? t('orders.supplier.messages.success.partiallyStocked')
            : t('orders.supplier.messages.success.stocked'),
        );
        return;
      } else {
        await updateSupplierOrderMutation.mutateAsync({
          supplierOrderId: order.id,
          payload: {
            orderBaseId: order.orderBaseId,
            supplierId: order.supplierId,
            deliveryDate: order.deliveryDate.slice(0, 10),
            supplyType: order.supplyType,
            number: order.number,
            note: order.note,
            createdBy: order.createdBy,
            status: nextStatus,
            items: order.items,
          },
        });
        if (financeVisibilityStatuses.includes(nextStatus)) {
          notifyFinanceUpdated();
        }
      }
      setOpenStatusOrder(null);
      onSuccess(t('orders.supplier.messages.success.statusUpdated'));
    } catch (error) {
      onError(
        resolveSupplierOrderErrorMessage(
          error,
          t,
          'orders.supplier.messages.errors.failedUpdateStatus',
        ),
      );
    }
  };

  const toggleSupplierOrderFavorite = async (order: SupplierOrder) => {
    if (!canManageSupplierOrders) {
      onError(t('orders.supplier.messages.errors.noManagePermission'));
      return;
    }

    const nextIsFavorite = order.isFavorite !== true;

    try {
      await updateSupplierOrderFavoriteMutation.mutateAsync({
        supplierOrderId: order.id,
        payload: {
          isFavorite: nextIsFavorite,
        },
      });
    } catch (error) {
      onError(
        resolveSupplierOrderErrorMessage(
          error,
          t,
          'orders.supplier.messages.errors.failedUpdateStar',
        ),
      );
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

  const saveSelectedSupplier = async () => {
    if (!selectedSupplierForEdit) return;
    setIsSupplierSaving(true);
    const ok = await onUpdateSupplier(selectedSupplierForEdit.id, {
      name: supplierEditForm.name.trim(),
      phone: supplierEditForm.phone.trim(),
      note: supplierEditForm.note.trim(),
      supplierOrder: selectedSupplierForEdit.supplierOrder,
      isActive: supplierEditForm.isActive,
    });
    setIsSupplierSaving(false);
    if (!ok) return;
    onSuccess(t('orders.supplier.messages.success.supplierUpdated'));
    await refreshOrders();
    setSelectedSupplierForEdit(null);
  };

  const saveSelectedCatalogProduct = async () => {
    if (!selectedCatalogProductForEdit) return;
    setIsProductSaving(true);
    const ok = await onUpdateCatalogProduct(selectedCatalogProductForEdit.id, {
      name: productEditForm.name.trim(),
      note: productEditForm.note.trim(),
      isActive: productEditForm.isActive,
    });
    setIsProductSaving(false);
    if (!ok) return;
    onSuccess(t('orders.supplier.messages.success.productUpdated'));
    await refreshOrders();
    setSelectedCatalogProductForEdit(null);
  };

  return (
    <section className='orders-page'>
      <SupplierOrdersToolbar
        activeTab={activeTab}
        dateFiltersCount={dateFiltersCount}
        filteredOrdersCount={filteredOrders.length}
        filteredOrderStatuses={filteredOrderStatuses}
        filteredPaymentStatuses={filteredPaymentStatuses}
        isColumnsMenuOpen={isColumnsMenuOpen}
        isFilterBarOpen={isFilterBarOpen}
        isInformationTab={isInformationTab}
        isOrderStatusOpen={isOrderStatusOpen}
        isPaymentStatusOpen={isPaymentStatusOpen}
        orderStatusFilterRef={orderStatusFilterRef}
        paymentStatusFilterRef={paymentStatusFilterRef}
        columnsMenuRef={columnsMenuRef}
        paymentQuery={paymentQuery}
        paymentStatus={paymentStatus}
        page={page}
        pageSize={pageSize}
        query={query}
        selectedStatuses={selectedStatuses}
        statusQuery={statusQuery}
        favoritesOnly={favoritesOnly}
        visibleColumns={visibleColumns}
        visibleTabs={visibleTabs}
        canManageSupplierOrders={canManageSupplierOrders}
        onActiveTabChange={onActiveTabChange}
        onCreateOrder={() => {
          if (!canManageSupplierOrders) {
            onError(t('orders.supplier.messages.errors.noManagePermission'));
            return;
          }
          setEditingOrder(null);
          setIsModalOpen(true);
        }}
        onColumnsMenuOpenChange={setIsColumnsMenuOpen}
        onFilterBarOpenChange={setIsFilterBarOpen}
        onOrderStatusOpenChange={setIsOrderStatusOpen}
        onPaymentStatusOpenChange={setIsPaymentStatusOpen}
        onPaymentQueryChange={setPaymentQuery}
        onPaymentStatusChange={setPaymentStatus}
        onPageChange={setPage}
        onQueryChange={(nextQuery) => {
          setQuery(nextQuery);
          setPage(1);
        }}
        onSelectedStatusesChange={setSelectedStatuses}
        onStatusQueryChange={setStatusQuery}
        onFavoritesOnlyChange={() => {
          setFavoritesOnly((current) => !current);
          setPage(1);
        }}
        onToggleColumnVisibility={toggleColumnVisibility}
        onToggleStatus={toggleStatus}
      />

      <SupplierOrdersDateFilterPanel
        deliveryDateFrom={deliveryDateFrom}
        deliveryDateTo={deliveryDateTo}
        isOpen={isFilterBarOpen}
        onDeliveryDateFromChange={(value) => {
          setDeliveryDateFrom(value);
          setPage(1);
        }}
        onDeliveryDateToChange={(value) => {
          setDeliveryDateTo(value);
          setPage(1);
        }}
        onClearDates={() => {
          setDeliveryDateFrom('');
          setDeliveryDateTo('');
          setPage(1);
        }}
      />

      {isInformationTab ? (
        <SupplierInformationDashboard
          filteredOrdersCount={filteredOrders.length}
          isLoading={isLoading}
          supplierInformation={supplierInformation}
        />
      ) : (
        <SupplierOrdersTable
          catalogProducts={catalogProducts}
          expandedOrderIds={expandedSupplierOrderIds}
          filteredOrdersCount={filteredOrders.length}
          isLoading={isLoading}
          openStatusOrder={openStatusOrder}
          page={page}
          pageSize={pageSize}
          paginatedOrders={paginatedOrders}
          suppliers={suppliers}
          tableWrapRef={supplierOrdersTableWrapRef}
          visibleColumns={visibleColumns}
          canViewSupplierOrders={canViewSupplierOrders}
          canManageSupplierOrders={canManageSupplierOrders}
          onError={onError}
          onEditOrder={(order, sourceOrder, itemIndex) => {
            setEditingOrder(order);
            setEditingOrderSource(sourceOrder ?? order);
            setEditingOrderItemIndex(itemIndex);
            setIsModalOpen(true);
          }}
          onOpenCatalogProduct={setSelectedCatalogProductForEdit}
          onOpenSupplier={setSelectedSupplierForEdit}
          onToggleFavorite={(order) => void toggleSupplierOrderFavorite(order)}
          onToggleOrderExpanded={toggleSupplierOrderExpanded}
          onOpenStatusOrder={(key, order, itemIndex, rect) => {
            if (!canManageSupplierOrders) {
              onError(t('orders.supplier.messages.errors.noManagePermission'));
              return;
            }
            if (openStatusOrder?.key === key) {
              setOpenStatusOrder(null);
              return;
            }
            setStatusMenuPosition(
              computeSupplierOrderStatusMenuPosition(rect),
            );
            setOpenStatusOrder({ key, order, itemIndex });
          }}
          onPageChange={setPage}
          onPageSizeChange={(nextSize) => {
            setPageSize(nextSize);
            setPage(1);
          }}
        />
      )}

      <SupplierOrderStatusMenuPortal
        openStatusOrder={openStatusOrder}
        statusMenuPosition={statusMenuPosition}
        onUpdateStatus={(order, status) =>
          void updateSupplierOrderStatus(order, status)
        }
      />

      <SupplierOrderModal
        isOpen={isModalOpen}
        suppliers={suppliers}
        editingOrder={editingOrder}
        forceReadOnly={!canManageSupplierOrders}
        onClose={() => {
          setIsModalOpen(false);
          setEditingOrder(null);
          setEditingOrderSource(null);
          setEditingOrderItemIndex(null);
        }}
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
          if (!canManageSupplierOrders) return;
          if (!editingOrder) return;
          const orderId =
            editingOrderSource?.id ?? editingOrder.id;
          const result = await takeOnChargeSupplierOrderMutation.mutateAsync({
            supplierOrderId: orderId,
            payload: {
              autoGenerateSerialNumbers,
              serialNumbers,
              autoGenerateArticles,
              articleBase: articleBase.trim().toUpperCase(),
              itemIndex:
                editingOrderItemIndex === null
                  ? undefined
                  : editingOrderItemIndex,
              warehouseId,
              locationId,
            },
          });
          onSuccess(t('orders.supplier.messages.success.stocked'));
          notifyFinanceUpdated();
          window.dispatchEvent(new Event('project-goods:products-updated'));
          return result;
        }}
        onCancelOrder={async () => {
          if (!canManageSupplierOrders) return;
          if (!editingOrder) return;
          const orderId =
            editingOrderSource?.id ?? editingOrder.id;
          await cancelSupplierOrderMutation.mutateAsync(orderId);
          onSuccess(t('orders.supplier.messages.success.cancelled'));
          notifyFinanceUpdated();
        }}
        onCancelItem={async (reason) => {
          if (!canManageSupplierOrders) return;
          if (!editingOrder) return;
          if (editingOrderItemIndex === null) return;
          const orderId =
            editingOrderSource?.id ?? editingOrder.id;
          await cancelSupplierOrderItemMutation.mutateAsync({
            supplierOrderId: orderId,
            payload: {
              itemIndex: editingOrderItemIndex,
              reason,
            },
          });
          onSuccess(t('orders.supplier.messages.success.itemCancelled'));
          notifyFinanceUpdated();
        }}
        isItemScopedView={
          editingOrderItemIndex !== null &&
          (editingOrderSource?.items.length ?? editingOrder?.items.length ?? 0) >
            1
        }
        onSubmit={async (payload: SupplierOrderModalSubmitPayload) => {
          if (!canManageSupplierOrders) {
            onError(t('orders.supplier.messages.errors.noManagePermission'));
            return;
          }
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
              await createSupplierOrderMutation.mutateAsync({
                ...basePayload,
                orderBaseId: `SO-${Date.now()}`,
              });
              onSuccess(t('orders.supplier.messages.success.created'));
            } else {
              await updateSupplierOrderMutation.mutateAsync({
                supplierOrderId: editingOrder.id,
                payload: {
                  ...basePayload,
                  orderBaseId: editingOrder.orderBaseId,
                },
              });
              onSuccess(t('orders.supplier.messages.success.updated'));
            }
          } catch (error) {
            onError(
              resolveSupplierOrderErrorMessage(
                error,
                t,
                'orders.supplier.messages.errors.failedSave',
              ),
            );
          }
        }}
      />

      {selectedSupplierForEdit ? (
        <SupplierEditModal
          form={supplierEditForm}
          isSaving={isSupplierSaving}
          onClose={() => setSelectedSupplierForEdit(null)}
          onFormChange={setSupplierEditForm}
          onSave={() => void saveSelectedSupplier()}
        />
      ) : null}

      {selectedCatalogProductForEdit ? (
        <CatalogProductEditModal
          form={productEditForm}
          isSaving={isProductSaving}
          onClose={() => setSelectedCatalogProductForEdit(null)}
          onFormChange={setProductEditForm}
          onSave={() => void saveSelectedCatalogProduct()}
        />
      ) : null}
    </section>
  );
};
