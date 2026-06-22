import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CatalogProduct,
  CatalogProductFormValues,
} from '../../../entities/catalog-product/model/types';
import type {
  Supplier,
  SupplierFormValues,
} from '../../../entities/supplier/model/types';
import {
  cancelSupplierOrder,
  createSupplierOrder,
  getSupplierOrders,
  takeOnChargeSupplierOrder,
  updateSupplierOrder,
  updateSupplierOrderFavorite,
} from '../../../entities/supplier-order/api/supplierOrderApi';
import type {
  SupplierOrder,
  SupplierOrderFormValues,
  SupplierOrderStatus,
  SupplierPaymentStatus,
} from '../../../entities/supplier-order/model/types';
import { getWarehouseSettings } from '../../../entities/warehouse-settings/api/warehouseSettingsApi';
import { buildSupplierOrderAnalytics } from '../model/supplier-order-utils';
import {
  filterSupplierOrders,
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
} from '../model/supplier-orders-workspace';
import { SupplierOrderModal, type SupplierOrderModalSubmitPayload } from './SupplierOrderModal';
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
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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
      window.removeEventListener('scroll', closeStatusMenuOnOutsideScroll, true);
    };
  }, [openStatusOrder]);

  const refreshOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const loaded = await getSupplierOrders();
      setOrders(loaded);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('orders.supplier.messages.errors.failedLoad'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [onError, t]);

  useEffect(() => {
    void refreshOrders();
  }, [refreshOrders]);

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
      onSuccess(t('orders.supplier.messages.success.statusUpdated'));
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('orders.supplier.messages.errors.failedUpdateStatus'),
      );
    }
  };

  const toggleSupplierOrderFavorite = async (order: SupplierOrder) => {
    if (!canManageSupplierOrders) {
      onError(t('orders.supplier.messages.errors.noManagePermission'));
      return;
    }

    const nextIsFavorite = !order.isFavorite;
    setOrders((current) =>
      current.map((item) =>
        item.id === order.id ? { ...item, isFavorite: nextIsFavorite } : item,
      ),
    );

    try {
      const updated = await updateSupplierOrderFavorite(order.id, {
        isFavorite: nextIsFavorite,
      });
      setOrders((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (error) {
      setOrders((current) =>
        current.map((item) =>
          item.id === order.id ? { ...item, isFavorite: order.isFavorite } : item,
        ),
      );
      onError(
        error instanceof Error
          ? error.message
          : t('orders.supplier.messages.errors.failedUpdateStar'),
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
          filteredOrdersCount={filteredOrders.length}
          isLoading={isLoading}
          openStatusOrder={openStatusOrder}
          page={page}
          pageSize={pageSize}
          paginatedOrders={paginatedOrders}
          suppliers={suppliers}
          visibleColumns={visibleColumns}
          canViewSupplierOrders={canViewSupplierOrders}
          canManageSupplierOrders={canManageSupplierOrders}
          onError={onError}
          onEditOrder={(order) => {
            setEditingOrder(order);
            setIsModalOpen(true);
          }}
          onOpenCatalogProduct={setSelectedCatalogProductForEdit}
          onOpenSupplier={setSelectedSupplierForEdit}
          onToggleFavorite={(order) => void toggleSupplierOrderFavorite(order)}
          onOpenStatusOrder={(key, order, rect) => {
            if (!canManageSupplierOrders) {
              onError(t('orders.supplier.messages.errors.noManagePermission'));
              return;
            }
            setStatusMenuPosition({
              top: rect.bottom + 4,
              left: rect.left,
            });
            setOpenStatusOrder((current) =>
              current?.key === key ? null : { key, order },
            );
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
        forceReadOnly={Boolean(
          editingOrder &&
            (!canManageSupplierOrders ||
            (editingOrder.status === 'stocked' ||
              editingOrder.receiptStatus === 'received' ||
              editingOrder.status === 'cancelled' ||
              editingOrder.paymentStatus === 'cancelled' ||
              editingOrder.paymentStatus === 'paid' ||
              editingOrder.paymentStatus === 'without_payment')),
        )}
        onClose={() => {
          setIsModalOpen(false);
          setEditingOrder(null);
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
          const result = await takeOnChargeSupplierOrder(editingOrder.id, {
            autoGenerateSerialNumbers,
            serialNumbers,
            autoGenerateArticles,
            articleBase: articleBase.trim().toUpperCase(),
            warehouseId,
            locationId,
          });
          onSuccess(t('orders.supplier.messages.success.stocked'));
          window.dispatchEvent(new Event('project-goods:finance-updated'));
          window.dispatchEvent(new Event('project-goods:products-updated'));
          await refreshOrders();
          return result;
        }}
        onCancelOrder={async () => {
          if (!canManageSupplierOrders) return;
          if (!editingOrder) return;
          await cancelSupplierOrder(editingOrder.id);
          onSuccess(t('orders.supplier.messages.success.cancelled'));
          await refreshOrders();
        }}
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
              await createSupplierOrder({
                ...basePayload,
                orderBaseId: `SO-${Date.now()}`,
              });
              onSuccess(t('orders.supplier.messages.success.created'));
            } else {
              await updateSupplierOrder(editingOrder.id, {
                ...basePayload,
                orderBaseId: editingOrder.orderBaseId,
              });
              onSuccess(t('orders.supplier.messages.success.updated'));
            }
            await refreshOrders();
          } catch (error) {
            onError(
              error instanceof Error
                ? error.message
                : t('orders.supplier.messages.errors.failedSave'),
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
