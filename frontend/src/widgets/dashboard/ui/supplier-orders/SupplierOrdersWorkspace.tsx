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
} from '../../../../entities/supplier-order/model/types';
import { getWarehouseSettings } from '../../../../entities/warehouse-settings/api/warehouseSettingsApi';
import { applySupplierOrderStatusChange } from '../../model/apply-supplier-order-status-change';
import {
  buildSupplierOrderAnalytics,
  getPreviousDeliveryDateRange,
  resolveSupplierOrderErrorMessage,
} from '../../model/supplier-order-utils';
import {
  computeSupplierOrderStatusMenuPosition,
  emptySupplierOrdersFilters,
  filterSupplierOrders,
  getActiveSupplierOrdersFiltersCount,
  normalizeSupplierOrdersColumns,
  paginateSupplierOrders,
  parseSupplierOrdersFilters,
  supplierOrdersAllColumns,
  supplierOrdersColumnsStorageKey,
  supplierOrdersDefaultColumns,
  supplierOrdersFiltersStorageKey,
  supplierOrdersLockedColumns,
  summarizeFilteredSupplierOrders,
  type OrdersTab,
  type SupplierOrdersColumnKey,
  type SupplierOrdersFilters,
} from '../../model/supplier-orders-workspace';
import {
  createSavedFilter as createSavedFilterRequest,
  deleteSavedFilter as deleteSavedFilterRequest,
  listSavedFilters,
} from '../../../../entities/saved-filter/api/savedFilterApi';
import type { SavedFilterRecord } from '../../../../entities/saved-filter/model/types';
import { filterIconOptions } from '../orders/workspace/orders-workspace-shared';
import { SupplierOrderModal, type SupplierOrderModalSubmitPayload } from '../orders/modals/SupplierOrderModal';
import { SupplierOrdersActiveFilterChips } from './SupplierOrdersActiveFilterChips';
import { SupplierOrdersFilterPanel } from './SupplierOrdersFilterPanel';
import {
  CatalogProductEditModal,
  SupplierEditModal,
  SupplierInformationDashboard,
  SupplierOrderStatusMenuPortal,
  SupplierOrdersTable,
  SupplierOrdersToolbar,
} from './SupplierOrdersWorkspaceSections';

const notifyFinanceUpdated = () => {
  window.dispatchEvent(new Event('project-goods:finance-updated'));
};

type Props = {
  activeTab: OrdersTab;
  onActiveTabChange: (tab: OrdersTab) => void;
  onToggleTabVisibility?: (tab: OrdersTab) => void;
  visibleTabs: OrdersTab[];
  permittedTabs?: OrdersTab[];
  suppliers: Supplier[];
  catalogProducts: CatalogProduct[];
  currentEmployeeName: string;
  currentEmployeeId?: string;
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
  onToggleTabVisibility,
  visibleTabs,
  permittedTabs,
  suppliers,
  catalogProducts,
  currentEmployeeName,
  currentEmployeeId,
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
  const orders = useMemo(
    () => supplierOrdersQuery.data ?? [],
    [supplierOrdersQuery.data],
  );
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
  const [appliedFilters, setAppliedFilters] =
    useState<SupplierOrdersFilters>(initialFilters);
  const [draftFilters, setDraftFilters] =
    useState<SupplierOrdersFilters>(initialFilters);
  const [isFilterBarOpen, setIsFilterBarOpen] = useState(false);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const [isPaymentFilterOpen, setIsPaymentFilterOpen] = useState(false);
  const [isColumnsMenuOpen, setIsColumnsMenuOpen] = useState(false);
  const [savedFilters, setSavedFilters] = useState<
    SavedFilterRecord<SupplierOrdersFilters>[]
  >([]);
  const [newFilterName, setNewFilterName] = useState('');
  const [newFilterIcon, setNewFilterIcon] = useState(filterIconOptions[0] ?? '?');
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SupplierOrder | null>(null);
  const [editingOrderSource, setEditingOrderSource] =
    useState<SupplierOrder | null>(null);
  const [editingOrderItemIndex, setEditingOrderItemIndex] = useState<
    number | null
  >(null);
  const statusFilterRef = useRef<HTMLDivElement | null>(null);
  const paymentFilterRef = useRef<HTMLDivElement | null>(null);
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
        isStatusFilterOpen &&
        statusFilterRef.current &&
        !statusFilterRef.current.contains(target)
      ) {
        setIsStatusFilterOpen(false);
      }

      if (
        isPaymentFilterOpen &&
        paymentFilterRef.current &&
        !paymentFilterRef.current.contains(target)
      ) {
        setIsPaymentFilterOpen(false);
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
  }, [isColumnsMenuOpen, isPaymentFilterOpen, isStatusFilterOpen, openStatusOrder]);

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
    () => filterSupplierOrders(orders, appliedFilters),
    [appliedFilters, orders],
  );

  const paginatedOrders = useMemo(
    () => paginateSupplierOrders(filteredOrders, page, pageSize),
    [filteredOrders, page, pageSize],
  );
  const filteredTotals = useMemo(
    () => summarizeFilteredSupplierOrders(filteredOrders),
    [filteredOrders],
  );
  const isInformationTab = activeTab === 'supplierInformation';
  const previousRange = useMemo(
    () =>
      getPreviousDeliveryDateRange(
        appliedFilters.dateFrom,
        appliedFilters.dateTo,
      ),
    [appliedFilters.dateFrom, appliedFilters.dateTo],
  );
  const previousOrders = useMemo(() => {
    if (!previousRange) return undefined;
    return filterSupplierOrders(orders, {
      ...appliedFilters,
      dateFrom: previousRange.dateFrom,
      dateTo: previousRange.dateTo,
    });
  }, [appliedFilters, orders, previousRange]);
  const supplierInformation = useMemo(
    () =>
      buildSupplierOrderAnalytics(filteredOrders, new Date(), {
        previousOrders,
      }),
    [filteredOrders, previousOrders],
  );

  useEffect(() => {
    window.localStorage.setItem(
      supplierOrdersFiltersStorageKey,
      JSON.stringify(appliedFilters),
    );
  }, [appliedFilters]);

  useEffect(() => {
    window.localStorage.setItem(
      supplierOrdersColumnsStorageKey,
      JSON.stringify(visibleColumns),
    );
  }, [visibleColumns]);

  const activeFiltersCount = getActiveSupplierOrdersFiltersCount(appliedFilters);
  const query = appliedFilters.query;
  const favoritesOnly = appliedFilters.favoritesOnly;
  const canManageSavedFilters = Boolean(currentEmployeeId);
  const createdByOptions = useMemo(() => {
    const names = new Set<string>();
    for (const order of orders) {
      const name = order.createdBy.trim();
      if (name) names.add(name);
    }
    return [...names].sort((first, second) => first.localeCompare(second));
  }, [orders]);
  const supplierLabelById = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier.name])),
    [suppliers],
  );
  const visibleSavedFilters = useMemo(
    () =>
      savedFilters.filter(
        (item) =>
          item.tab === 'supplierOrders' &&
          (!currentEmployeeId || item.employeeId === currentEmployeeId),
      ),
    [currentEmployeeId, savedFilters],
  );

  const commitFilters = useCallback(
    (next: SupplierOrdersFilters) => {
      const sanitized: SupplierOrdersFilters = {
        ...next,
        query: next.query,
        orderNumber: next.orderNumber.trim(),
        product: next.product.trim(),
        createdBy: next.createdBy.trim(),
        supplierId: next.supplierId,
      };
      setAppliedFilters(sanitized);
      setDraftFilters(sanitized);
      setPage(1);
    },
    [],
  );

  const applyFilters = () => {
    commitFilters({
      ...draftFilters,
      query: appliedFilters.query,
      favoritesOnly: appliedFilters.favoritesOnly,
    });
    setIsStatusFilterOpen(false);
    setIsPaymentFilterOpen(false);
    if (isFilterBarOpen) {
      setIsFilterBarOpen(false);
    }
  };

  const resetFilters = () => {
    commitFilters({
      ...emptySupplierOrdersFilters,
      query: appliedFilters.query,
    });
    setIsStatusFilterOpen(false);
    setIsPaymentFilterOpen(false);
  };

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

  const resetColumns = () => {
    setVisibleColumns(supplierOrdersDefaultColumns);
  };

  useEffect(() => {
    if (!currentEmployeeId) {
      setSavedFilters([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const remote = await listSavedFilters<SupplierOrdersFilters>('orders');
        if (!cancelled) {
          setSavedFilters(remote);
        }
      } catch (error) {
        if (!cancelled) {
          onError(
            error instanceof Error
              ? error.message
              : t('orders.supplier.messages.errors.failedLoad'),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentEmployeeId, onError, t]);

  const saveCurrentFilter = () => {
    if (!currentEmployeeId) {
      onError(t('orders.messages.errors.employeeRequiredForFilters'));
      return;
    }
    const name = newFilterName.trim();
    if (!name) {
      onError(t('orders.messages.errors.enterFilterName'));
      return;
    }
    const payload: SupplierOrdersFilters = {
      ...draftFilters,
      query: '',
      orderNumber: draftFilters.orderNumber.trim(),
      product: draftFilters.product.trim(),
      createdBy: draftFilters.createdBy.trim(),
    };
    void (async () => {
      try {
        const created = await createSavedFilterRequest({
          scope: 'orders',
          tab: 'supplierOrders',
          name,
          icon: newFilterIcon,
          filters: payload,
        });
        setSavedFilters((current) => [created, ...current]);
        setNewFilterName('');
        onSuccess(t('orders.messages.success.filterSaved'));
      } catch (error) {
        onError(
          error instanceof Error
            ? error.message
            : t('orders.supplier.messages.errors.failedLoad'),
        );
      }
    })();
  };

  const applySavedFilter = (filterId: string) => {
    const saved = savedFilters.find((item) => item.id === filterId);
    if (!saved) return;
    commitFilters({
      ...parseSupplierOrdersFilters(saved.filters),
      query: appliedFilters.query,
    });
    setIsFilterBarOpen(false);
  };

  const removeSavedFilter = (filterId: string) => {
    void (async () => {
      try {
        await deleteSavedFilterRequest(filterId);
        setSavedFilters((current) =>
          current.filter((item) => item.id !== filterId),
        );
      } catch (error) {
        onError(
          error instanceof Error
            ? error.message
            : t('orders.supplier.messages.errors.failedLoad'),
        );
      }
    })();
  };

  const openSingleMatch = () => {
    const match = filteredOrders[0];
    if (!match || filteredOrders.length !== 1) return;
    setEditingOrder(match);
    setEditingOrderSource(match);
    setEditingOrderItemIndex(match.items.length === 1 ? 0 : null);
    setIsModalOpen(true);
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
    await applySupplierOrderStatusChange({
      order,
      nextStatus,
      // Keep `null` for multi-item parent rows (bulk take-on-charge).
      itemIndex: openStatusOrder ? openStatusOrder.itemIndex : undefined,
      defaultWarehouse: defaultTakeOnChargeWarehouse,
      takeOnCharge: async ({
        supplierOrderId,
        autoGenerateSerialNumbers,
        serialNumbers,
        autoGenerateArticles,
        articleBase,
        warehouseId,
        locationId,
        itemIndex,
      }) =>
        takeOnChargeSupplierOrderMutation.mutateAsync({
          supplierOrderId,
          payload: {
            autoGenerateSerialNumbers,
            serialNumbers,
            autoGenerateArticles,
            articleBase,
            warehouseId,
            locationId,
            ...(itemIndex === undefined ? {} : { itemIndex }),
          },
        }),
      updateOrder: async ({ supplierOrderId, order: source, nextStatus: status }) => {
        await updateSupplierOrderMutation.mutateAsync({
          supplierOrderId,
          payload: {
            orderBaseId: source.orderBaseId,
            supplierId: source.supplierId,
            deliveryDate: source.deliveryDate.slice(0, 10),
            supplyType: source.supplyType,
            number: source.number,
            note: source.note,
            createdBy: source.createdBy,
            status,
            items: source.items,
          },
        });
      },
      translate: t,
      onSuccess,
      onError,
      notifyFinanceUpdated,
    });
    setOpenStatusOrder(null);
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
        activeFiltersCount={activeFiltersCount}
        filteredOrdersCount={filteredOrders.length}
        isColumnsMenuOpen={isColumnsMenuOpen}
        isFilterBarOpen={isFilterBarOpen}
        isInformationTab={isInformationTab}
        columnsMenuRef={columnsMenuRef}
        page={page}
        pageSize={pageSize}
        query={query}
        favoritesOnly={favoritesOnly}
        visibleColumns={visibleColumns}
        visibleTabs={visibleTabs}
        permittedTabs={permittedTabs}
        canManageSupplierOrders={canManageSupplierOrders}
        onActiveTabChange={onActiveTabChange}
        onToggleTabVisibility={onToggleTabVisibility}
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
        onPageChange={setPage}
        onQueryChange={(nextQuery) => {
          commitFilters({ ...appliedFilters, query: nextQuery });
        }}
        onFavoritesOnlyChange={() => {
          commitFilters({
            ...appliedFilters,
            favoritesOnly: !appliedFilters.favoritesOnly,
          });
        }}
        onToggleColumnVisibility={toggleColumnVisibility}
        onResetColumns={resetColumns}
        onOpenSingleMatch={openSingleMatch}
      />

      <SupplierOrdersFilterPanel
        isOpen={isFilterBarOpen}
        isStatusFilterOpen={isStatusFilterOpen}
        isPaymentFilterOpen={isPaymentFilterOpen}
        canManageSavedFilters={canManageSavedFilters}
        draftFilters={draftFilters}
        savedFilters={visibleSavedFilters}
        suppliers={suppliers}
        createdByOptions={createdByOptions}
        newFilterName={newFilterName}
        newFilterIcon={newFilterIcon}
        statusFilterRef={statusFilterRef}
        paymentFilterRef={paymentFilterRef}
        setDraftFilters={setDraftFilters}
        setIsStatusFilterOpen={setIsStatusFilterOpen}
        setIsPaymentFilterOpen={setIsPaymentFilterOpen}
        setNewFilterName={setNewFilterName}
        setNewFilterIcon={setNewFilterIcon}
        onApplyFilters={applyFilters}
        onResetFilters={resetFilters}
        onSaveCurrentFilter={saveCurrentFilter}
        onApplySavedFilter={applySavedFilter}
        onRemoveSavedFilter={removeSavedFilter}
      />

      <SupplierOrdersActiveFilterChips
        filters={appliedFilters}
        supplierLabelById={supplierLabelById}
        onChangeFilters={commitFilters}
        onClearAll={resetFilters}
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
          totals={filteredTotals}
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
          const itemIndex =
            editingOrderItemIndex ??
            (editingOrder.items.length === 1
              ? (editingOrder.items[0]?.itemIndex ?? 0)
              : null);
          if (itemIndex === null) return;
          const orderId =
            editingOrderSource?.id ?? editingOrder.id;
          await cancelSupplierOrderItemMutation.mutateAsync({
            supplierOrderId: orderId,
            payload: {
              itemIndex,
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
