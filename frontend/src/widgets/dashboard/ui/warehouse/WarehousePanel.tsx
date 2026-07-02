import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { CatalogProduct } from '../../../../entities/catalog-product/model/types';
import type { Product } from '../../../../entities/product/model/types';
import { printSerialNumbers } from '../../../../shared/lib/serialPrint';
import { normalizeDecimalInput, parseDecimal } from '../../../../shared/lib/decimal';
import { PaginationPanel } from '../../../../shared/ui/PaginationPanel';
import {
  useCancelSupplierOrderMutation,
  useCreateSupplierOrderMutation,
  useSupplierOrdersQuery,
  useTakeOnChargeSupplierOrderMutation,
  useUpdateSupplierOrderFavoriteMutation,
  useUpdateSupplierOrderMutation,
} from '../../../../entities/supplier-order/api/supplierOrderApi';
import {
  SupplierOrderModal,
  type SupplierOrderModalSubmitPayload,
} from '../orders/modals/SupplierOrderModal';
import type { Supplier } from '../../../../entities/supplier/model/types';
import type {
  SupplierOrder,
  SupplierOrderFormValues,
} from '../../../../entities/supplier-order/model/types';
import {
  useUpdateWarehouseSettingsMutation,
  useWarehouseSettingsQuery,
} from '../../../../entities/warehouse-settings/api/warehouseSettingsApi';
import {
  buildSupplierOrderItemNumber,
  mergeSupplierOrderItemUpdate,
} from '../../model/supplier-order-utils';
import {
  buildSalesByProductId,
  buildSupplierOrdersByProductId,
  buildProductWarehouseMetaById,
  filterStockProducts,
} from '../../model/stock-balance';
import { buildLocationUsageByWarehouse } from '../../model/warehouse-information';
import { ProductModelModal } from '../orders/modals/ProductModelModal';
import { ModalShell } from './WarehouseModalShell';
import { WarehouseSettings } from './WarehouseSettingsSection';
import { ServiceCenterModal, WarehouseEditModal } from './WarehouseSettingsModals';
import { WarehouseInformationPanel } from './WarehouseInformationPanel';
import { StockTable, ReceiptsTable } from './WarehouseTables';
import { TransferWorkspace } from './WarehouseTransferWorkspace';
import { WarehouseToolbar } from './WarehouseToolbar';
import {
  availableWarehouseColumns,
  defaultWarehouseVisibleColumns,
  emptySupplierOrders,
  filterReceiptRows,
  initialAdministrators,
  initialServiceCenters,
  initialWarehouseFilters,
  initialWarehouses,
  lockedWarehouseColumns,
  normalizeProductName,
  receiptStatusFilterOptions,
  savedWarehouseFiltersStorageKey,
  tabs,
  toServiceCenterForm,
  toWarehouseForm,
  transferPageSize,
  warehouseColumnsStorageKey,
  warehouseFilterIconOptions,
  warehouseFiltersStorageKey,
  type Administrator,
  type ReceiptRow,
  type ReceiptsColumnKey,
  type SavedWarehouseFilter,
  type ServiceCenter,
  type ServiceCenterFormState,
  type SettingsTab,
  type StockColumnKey,
  type TransferFormState,
  type TransferHistoryRow,
  type WarehouseColumnVisibility,
  type WarehouseColumnsTab,
  type WarehouseFilters,
  type WarehouseFormState,
  type WarehouseItem,
  type WarehousePanelProps,
  type WarehouseSearchMode,
  type WarehouseTab,
} from '../../model/warehouse-panel';
export const WarehousePanel = ({
  printForms,
  products,
  sales,
  catalogProducts,
  employees,
  canViewSupplierOrders,
  canManageSupplierOrders,
  isLoading,
  isProductSaving,
  onProductChange,
  onProductSubmit,
  onProductEdit,
  onProductDelete,
  onProductTransfer,
  suppliers,
  onCreateSupplier,
  onUpdateSupplier,
  onUpdateCatalogProduct,
  onUpdateProductModel,
  currentEmployeeName,
  onSuccess,
  onError,
  onOpenSaleCard,
}: WarehousePanelProps) => {
  const { t, i18n } = useTranslation();
  const supplierOrdersQuery = useSupplierOrdersQuery(canViewSupplierOrders);
  const warehouseSettingsQuery = useWarehouseSettingsQuery();
  const createSupplierOrderMutation = useCreateSupplierOrderMutation();
  const updateSupplierOrderMutation = useUpdateSupplierOrderMutation();
  const updateSupplierOrderFavoriteMutation =
    useUpdateSupplierOrderFavoriteMutation();
  const cancelSupplierOrderMutation = useCancelSupplierOrderMutation();
  const takeOnChargeSupplierOrderMutation =
    useTakeOnChargeSupplierOrderMutation();
  const updateWarehouseSettingsMutation =
    useUpdateWarehouseSettingsMutation();
  const supplierOrders =
    supplierOrdersQuery.data ?? emptySupplierOrders;
  const isWarehouseSettingsSaving =
    updateWarehouseSettingsMutation.isPending;
  const normalizeWarehouseFilters = (
    filters?: Partial<WarehouseFilters>,
  ): WarehouseFilters => ({
    ...initialWarehouseFilters,
    ...(filters ?? {}),
    status:
      filters?.status &&
      receiptStatusFilterOptions.includes(filters.status)
        ? filters.status
        : '',
    favoritesOnly: filters?.favoritesOnly === true,
  });
  const [selectedProductModelContext, setSelectedProductModelContext] =
    useState<{ name: string; printProduct: Product | null } | null>(null);
  const [selectedStockProductIds, setSelectedStockProductIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<WarehouseTab>(() => {
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem(warehouseFiltersStorageKey) ??
          '{}',
      ) as Partial<{ activeTab: WarehouseTab }>;
      return parsed.activeTab === 'stock' ||
        parsed.activeTab === 'receipts' ||
        parsed.activeTab === 'transfers' ||
        parsed.activeTab === 'information' ||
        parsed.activeTab === 'settings'
        ? parsed.activeTab
        : 'stock';
    } catch {
      return 'stock';
    }
  });
  const [query, setQuery] = useState(() => {
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem(warehouseFiltersStorageKey) ??
          '{}',
      ) as Partial<{ query: string }>;
      return parsed.query ?? '';
    } catch {
      return '';
    }
  });
  const [searchMode, setSearchMode] = useState<WarehouseSearchMode>(
    () => {
      try {
        const parsed = JSON.parse(
          window.localStorage.getItem(warehouseFiltersStorageKey) ??
            '{}',
        ) as Partial<{ searchMode: WarehouseSearchMode }>;
        return parsed.searchMode === 'serial' ||
          parsed.searchMode === 'name' ||
          parsed.searchMode === 'article' ||
          parsed.searchMode === 'supplier' ||
          parsed.searchMode === 'warehouse'
          ? parsed.searchMode
          : 'serial';
      } catch {
        return 'serial';
      }
    },
  );
  const [currentPage, setCurrentPage] = useState(() => {
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem(warehouseFiltersStorageKey) ??
          '{}',
      ) as Partial<{ currentPage: number }>;
      return Number.isFinite(parsed.currentPage) &&
        (parsed.currentPage ?? 0) > 0
        ? Math.floor(parsed.currentPage as number)
        : 1;
    } catch {
      return 1;
    }
  });
  const [pageSize, setPageSize] = useState(() => {
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem(warehouseFiltersStorageKey) ??
          '{}',
      ) as Partial<{ pageSize: number }>;
      return Number.isFinite(parsed.pageSize) &&
        (parsed.pageSize ?? 0) > 0
        ? Math.floor(parsed.pageSize as number)
        : 30;
    } catch {
      return 30;
    }
  });
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isColumnsMenuOpen, setIsColumnsMenuOpen] = useState(false);
  const [isSaveFilterDrawerOpen, setIsSaveFilterDrawerOpen] =
    useState(false);
  const [visibleColumns, setVisibleColumns] =
    useState<WarehouseColumnVisibility>(() => {
      try {
        const parsed = JSON.parse(
          window.localStorage.getItem(warehouseColumnsStorageKey) ??
            '{}',
        ) as Partial<WarehouseColumnVisibility>;
        const normalizeStock = Array.isArray(parsed.stock)
          ? availableWarehouseColumns.stock.filter((columnKey) =>
              parsed.stock?.includes(columnKey),
            )
          : defaultWarehouseVisibleColumns.stock;
        const normalizeReceipts = Array.isArray(parsed.receipts)
          ? availableWarehouseColumns.receipts.filter((columnKey) =>
              parsed.receipts?.includes(columnKey),
            )
          : defaultWarehouseVisibleColumns.receipts;
        return {
          stock:
            normalizeStock.length > 0
              ? normalizeStock
              : defaultWarehouseVisibleColumns.stock,
          receipts:
            normalizeReceipts.length > 0
              ? normalizeReceipts
              : defaultWarehouseVisibleColumns.receipts,
        };
      } catch {
        return defaultWarehouseVisibleColumns;
      }
    });
  const [draftFilters, setDraftFilters] = useState<WarehouseFilters>(
    normalizeWarehouseFilters(),
  );
  const [appliedFilters, setAppliedFilters] = useState<WarehouseFilters>(
    normalizeWarehouseFilters(),
  );
  const [savedFilters, setSavedFilters] = useState<
    SavedWarehouseFilter[]
  >(() => {
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem(savedWarehouseFiltersStorageKey) ??
          '[]',
      ) as SavedWarehouseFilter[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [newFilterName, setNewFilterName] = useState('');
  const [newFilterIcon, setNewFilterIcon] = useState(
    warehouseFilterIconOptions[0],
  );
  const [settingsTab, setSettingsTab] = useState<SettingsTab>(() => {
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem(warehouseFiltersStorageKey) ??
          '{}',
      ) as Partial<{ settingsTab: SettingsTab }>;
      return parsed.settingsTab === 'service-centers' ||
        parsed.settingsTab === 'warehouses' ||
        parsed.settingsTab === 'administrators'
        ? parsed.settingsTab
        : 'service-centers';
    } catch {
      return 'service-centers';
    }
  });
  const [serviceCenters, setServiceCenters] =
    useState<ServiceCenter[]>(initialServiceCenters) || [];
  const [warehouses, setWarehouses] =
    useState<WarehouseItem[]>(initialWarehouses);
  const [administrators, setAdministrators] = useState<
    Administrator[]
  >(initialAdministrators);
  const [serviceCenterModalId, setServiceCenterModalId] = useState<
    string | null
  >(null);
  const [serviceCenterForm, setServiceCenterForm] =
    useState<ServiceCenterFormState>(toServiceCenterForm());
  const [warehouseModalId, setWarehouseModalId] = useState<
    string | null
  >(null);
  const [warehouseForm, setWarehouseForm] =
    useState<WarehouseFormState>(toWarehouseForm());
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isSupplierOrderModalOpen, setIsSupplierOrderModalOpen] =
    useState(false);
  const [editingSupplierOrder, setEditingSupplierOrder] =
    useState<SupplierOrder | null>(null);
  const [editingSupplierOrderSource, setEditingSupplierOrderSource] =
    useState<SupplierOrder | null>(null);
  const [
    editingSupplierOrderItemIndex,
    setEditingSupplierOrderItemIndex,
  ] = useState<number | null>(null);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);
  const didInitPaginationRef = useRef(false);
  const [selectedSupplierForEdit, setSelectedSupplierForEdit] =
    useState<Supplier | null>(null);
  const [
    selectedCatalogProductForEdit,
    setSelectedCatalogProductForEdit,
  ] = useState<CatalogProduct | null>(null);
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
  const [isProductSavingInline, setIsProductSavingInline] =
    useState(false);
  const [receiptForm, setReceiptForm] = useState({
    supplierId: '',
    productName: '',
    price: '0',
    quantity: '1',
    note: '',
  });
  const [manualReceiptRows, setManualReceiptRows] = useState<ReceiptRow[]>([]);
  const [transferForm, setTransferForm] = useState<TransferFormState>({
    productId: '',
    toWarehouseId: '',
    toLocationId: '',
    note: '',
  });
  const [transferHistory, setTransferHistory] = useState<
    TransferHistoryRow[]
  >([]);
  const persistWarehouseSettings = async (payload?: {
    serviceCenters?: ServiceCenter[];
    warehouses?: WarehouseItem[];
    administrators?: Administrator[];
    successMessage?: string;
  }) => {
    const nextServiceCenters = payload?.serviceCenters ?? serviceCenters;
    const nextWarehouses = payload?.warehouses ?? warehouses;
    const nextAdministrators = payload?.administrators ?? administrators;

    try {
      const saved = await updateWarehouseSettingsMutation.mutateAsync({
        serviceCenters: nextServiceCenters,
        warehouses: nextWarehouses,
        administrators: nextAdministrators,
      });
      setServiceCenters(saved.serviceCenters);
      setWarehouses(saved.warehouses);
      setAdministrators(saved.administrators);
      if (payload?.successMessage) {
        onSuccess(payload.successMessage);
      }
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : i18n.t('warehouse.messages.errors.failedSaveSettings'),
      );
    }
  };

  const buildReceiptRows = (orders: SupplierOrder[]): ReceiptRow[] => {
    return orders.flatMap((order) =>
      order.items.map((item) => ({
        id: `${order.id}-${item.itemIndex}`,
        supplierOrderId: order.id,
        supplierOrderItemIndex: item.itemIndex,
        catalogProductId: item.catalogProductId,
        supplierOrderIsFavorite: order.isFavorite,
        number: buildSupplierOrderItemNumber(order, item.itemIndex),
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        amount: item.price * item.quantity,
        paid: order.paid,
        supplierName: order.supplierName || 'Supplier',
        createdAt: order.createdAt,
        acceptedBy: order.createdBy || t('common.administrator'),
        approvedBy:
          (item.receiptStatus ?? 'new') === 'new'
            ? '-'
            : order.createdBy || t('common.administrator'),
        acceptedAt: order.updatedAt,
        status:
          order.status === 'cancelled' ||
          order.status === 'unavailable' ||
          order.paymentStatus === 'cancelled'
            ? 'cancelled'
            : item.receiptStatus ?? 'new',
        paymentStatus: order.paymentStatus,
        note: order.note || '',
      })),
    );
  };

  const receiptHistory = useMemo(
    () => [
      ...buildReceiptRows(supplierOrders).map((row) => ({
        ...row,
        id: `so-${row.id}`,
      })),
      ...manualReceiptRows,
    ],
    [manualReceiptRows, supplierOrders],
  );

  const refreshSupplierOrders = useCallback(async () => {
    if (!canViewSupplierOrders) return;
    await supplierOrdersQuery.refetch();
  }, [canViewSupplierOrders, supplierOrdersQuery]);

  const syncCatalogRenameToSupplierOrders = async (
    catalogProductId: string,
    nextName: string,
  ) => {
    if (!canManageSupplierOrders) return;
    const nextNormalized = normalizeProductName(nextName);
    if (!catalogProductId || !nextNormalized) return;

    const ordersToUpdate = supplierOrders.filter((order) =>
      order.items.some(
        (item) => item.catalogProductId === catalogProductId,
      ),
    );
    if (ordersToUpdate.length === 0) return;

    await Promise.all(
      ordersToUpdate.map((order) =>
        updateSupplierOrderMutation.mutateAsync({
          supplierOrderId: order.id,
          payload: {
            orderBaseId: order.orderBaseId,
            supplierId: order.supplierId,
            deliveryDate: order.deliveryDate,
            supplyType: order.supplyType,
            number: order.number,
            note: order.note,
            createdBy: order.createdBy,
            status: order.status,
            paymentStatus: order.paymentStatus,
            items: order.items.map((item) =>
              item.catalogProductId === catalogProductId
                ? { ...item, productName: nextName }
                : item,
            ),
          },
        }),
      ),
    );
  };
  const syncSupplierOrderRenameToCatalog = async (
    catalogProductId: string | undefined,
    nextName: string,
  ) => {
    const nextNormalized = normalizeProductName(nextName);
    if (!catalogProductId || !nextNormalized) return;

    const catalogProduct = catalogProducts.find(
      (item) => item.id === catalogProductId,
    );
    if (!catalogProduct) return;
    if (normalizeProductName(catalogProduct.name) === nextNormalized)
      return;

    await onUpdateCatalogProduct(catalogProduct.id, {
      name: nextName,
      note: catalogProduct.note,
      isActive: catalogProduct.isActive,
    });
  };

  useEffect(() => {
    const refreshOnFinanceUpdate = () => {
      void refreshSupplierOrders().catch(() => undefined);
    };
    window.addEventListener('project-goods:finance-updated', refreshOnFinanceUpdate);
    return () => {
      window.removeEventListener('project-goods:finance-updated', refreshOnFinanceUpdate);
    };
  }, [refreshSupplierOrders]);
  useEffect(() => {
    if (!warehouseSettingsQuery.data) return;
    setServiceCenters(warehouseSettingsQuery.data.serviceCenters);
    setWarehouses(warehouseSettingsQuery.data.warehouses);
    setAdministrators(warehouseSettingsQuery.data.administrators);
  }, [setServiceCenters, warehouseSettingsQuery.data]);
  useEffect(() => {
    if (!warehouseSettingsQuery.error) return;
    onError(
      warehouseSettingsQuery.error instanceof Error
        ? warehouseSettingsQuery.error.message
        : i18n.t('warehouse.messages.errors.failedLoadSettings'),
    );
  }, [onError, warehouseSettingsQuery.error]);
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
  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.isActive),
    [employees],
  );
  const buyerOptions = useMemo(
    () =>
      Array.from(
        new Set(
          employees
            .map((employee) => employee.name.trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [employees],
  );
  const supplierOptions = useMemo(
    () =>
      Array.from(
        new Set(
          suppliers
            .filter((supplier) => supplier.isActive)
            .map((supplier) => supplier.name.trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [suppliers],
  );
  const buyersByProductName = useMemo(() => {
    return receiptHistory.reduce<Record<string, string[]>>(
      (acc, receipt) => {
        const key = receipt.productName.trim().toLowerCase();
        if (!key) return acc;
        const current = acc[key] ?? [];
        if (!current.includes(receipt.acceptedBy)) {
          acc[key] = [...current, receipt.acceptedBy];
        }
        return acc;
      },
      {},
    );
  }, [receiptHistory]);
  const warehouseOptions = useMemo(
    () =>
      warehouses.map((warehouse) => ({
        id: warehouse.id,
        name: warehouse.name,
      })),
    [warehouses],
  );
  const locationOptionsByWarehouseId = useMemo(
    () =>
      warehouses.reduce<Record<string, Array<{ id: string; name: string }>>>(
        (acc, warehouse) => {
          acc[warehouse.id] = warehouse.locations.map((location) => ({
            id: location.id,
            name: location.name,
          }));
          return acc;
        },
        {},
      ),
    [warehouses],
  );
  const takeOnChargeWarehouseOptions = useMemo(
    () =>
      warehouses
        .filter((warehouse) => warehouse.isActive)
        .map((warehouse) => ({
          id: warehouse.id,
          name: warehouse.name,
          locations: warehouse.locations.map((location) => ({
            id: location.id,
            name: location.name,
          })),
        })),
    [warehouses],
  );
  const availableLocationOptions = useMemo(() => {
    const selectedWarehouse = warehouseOptions.find(
      (option) => option.name === draftFilters.warehouse,
    );
    if (selectedWarehouse) {
      return locationOptionsByWarehouseId[selectedWarehouse.id] ?? [];
    }
    return Array.from(
      new Map(
        warehouseOptions.flatMap((warehouse) =>
          (locationOptionsByWarehouseId[warehouse.id] ?? []).map(
            (location) => [location.name, location] as const,
          ),
        ),
      ).values(),
    );
  }, [
    draftFilters.warehouse,
    locationOptionsByWarehouseId,
    warehouseOptions,
  ]);
  const productWarehouseMetaById = useMemo(
    () => buildProductWarehouseMetaById(products, warehouses),
    [products, warehouses],
  );
  const filteredReceipts = useMemo(() => {
    return filterReceiptRows({
      receipts: receiptHistory,
      query,
      filters: appliedFilters,
    });
  }, [appliedFilters, query, receiptHistory]);
  const salesByProductId = useMemo(
    () => buildSalesByProductId(products, sales),
    [products, sales],
  );
  const supplierOrdersByProductId = useMemo(() => {
    return buildSupplierOrdersByProductId({ products, supplierOrders });
  }, [products, supplierOrders]);
  const filteredProducts = useMemo(
    () =>
      filterStockProducts({
        products,
        sales,
        query,
        searchMode,
        filters: appliedFilters,
        productWarehouseMetaById,
        supplierOrdersByProductId,
        buyersByProductName,
      }),
    [
      appliedFilters,
      buyersByProductName,
      productWarehouseMetaById,
      products,
      query,
      sales,
      searchMode,
      supplierOrdersByProductId,
    ],
  );
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [currentPage, filteredProducts, pageSize]);
  const selectedStockProducts = useMemo(
    () =>
      products.filter((product) =>
        selectedStockProductIds.includes(product.id),
      ),
    [products, selectedStockProductIds],
  );
  const selectedStockProductsWithSerials = useMemo(
    () =>
      selectedStockProducts.filter((product) =>
        product.serialNumber.trim(),
      ),
    [selectedStockProducts],
  );
  const printSelectedStockSerials = useCallback(() => {
    if (selectedStockProductsWithSerials.length === 0) return;

    printSerialNumbers(
      selectedStockProductsWithSerials.map((product) => ({
        name: product.name,
        article: product.article,
        serialNumber: product.serialNumber,
      })),
      printForms,
      i18n.t('warehouse.print.serialNumbersTitle'),
    );
  }, [i18n, printForms, selectedStockProductsWithSerials]);

  useEffect(() => {
    setSelectedStockProductIds((current) => {
      const next = current.filter((productId) =>
        filteredProducts.some((product) => product.id === productId),
      );
      return next.length === current.length ? current : next;
    });
  }, [filteredProducts]);
  const paginatedTransferProducts = useMemo(() => {
    const start = (currentPage - 1) * transferPageSize;
    return filteredProducts.slice(start, start + transferPageSize);
  }, [currentPage, filteredProducts]);
  const activeTransferProduct = useMemo(
    () =>
      filteredProducts.find(
        (product) => product.id === transferForm.productId,
      ) ?? null,
    [filteredProducts, transferForm.productId],
  );
  const transferLocationOptions = useMemo(
    () => locationOptionsByWarehouseId[transferForm.toWarehouseId] ?? [],
    [locationOptionsByWarehouseId, transferForm.toWarehouseId],
  );
  const employeeSavedFilters = useMemo(
    () =>
      savedFilters.filter(
        (savedFilter) =>
          savedFilter.employeeName === currentEmployeeName &&
          savedFilter.tab === activeTab,
      ),
    [activeTab, currentEmployeeName, savedFilters],
  );
  const totalItems =
    activeTab === 'receipts'
      ? filteredReceipts.length
      : filteredProducts.length;
  const activePageSize =
    activeTab === 'transfers' ? transferPageSize : pageSize;
  const activeColumnsTab: WarehouseColumnsTab | null =
    activeTab === 'stock' || activeTab === 'receipts'
      ? activeTab
      : null;
  const visibleColumnKeys =
    activeColumnsTab === 'stock'
      ? visibleColumns.stock
      : activeColumnsTab === 'receipts'
        ? visibleColumns.receipts
        : [];
  const visibleColumnKeySet = new Set<string>(
    visibleColumnKeys as string[],
  );
  const searchPlaceholder =
    activeTab === 'receipts'
      ? t('warehouse.search.receipts')
      : t(`warehouse.search.${searchMode}`);
  const activeFilterCount = Object.values(appliedFilters).filter((value) =>
    typeof value === 'boolean' ? value : value.trim(),
  ).length;
  const stockSummaryText =
    activeTab === 'stock'
      ? t('warehouse.summary.stockRows', { count: filteredProducts.length })
      : activeTab === 'transfers'
        ? t('warehouse.summary.movableRows', { count: filteredProducts.length })
        : t('warehouse.summary.receiptRows', { count: filteredReceipts.length });
  const paginatedReceipts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReceipts.slice(start, start + pageSize);
  }, [currentPage, filteredReceipts, pageSize]);

  const warehousesByServiceCenter = useMemo(
    () =>
      warehouses.reduce<Record<string, number>>((acc, warehouse) => {
        acc[warehouse.serviceCenterId] =
          (acc[warehouse.serviceCenterId] ?? 0) + 1;
        return acc;
      }, {}),
    [warehouses],
  );
  const activeWarehousesByServiceCenter = useMemo(
    () =>
      warehouses.reduce<Record<string, number>>((acc, warehouse) => {
        if (!warehouse.isActive) return acc;
        acc[warehouse.serviceCenterId] =
          (acc[warehouse.serviceCenterId] ?? 0) + 1;
        return acc;
      }, {}),
    [warehouses],
  );
  const warehouseProductCounts = useMemo(
    () =>
      products.reduce<Record<string, number>>((acc, product) => {
        const warehouseId = product.warehouseId?.trim();
        if (!warehouseId) return acc;
        acc[warehouseId] = (acc[warehouseId] ?? 0) + 1;
        return acc;
      }, {}),
    [products],
  );
  const locationUsageByWarehouse = useMemo(
    () => buildLocationUsageByWarehouse(products),
    [products],
  );

  useEffect(() => {
    if (isLoading) return;
    const totalItems =
      activeTab === 'receipts'
        ? filteredReceipts.length
        : filteredProducts.length;
    const activePageSize =
      activeTab === 'transfers' ? transferPageSize : pageSize;
    const pageCount = Math.max(1, Math.ceil(totalItems / activePageSize));
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [
    activeTab,
    currentPage,
    filteredProducts.length,
    filteredReceipts.length,
    isLoading,
    pageSize,
  ]);

  useEffect(() => {
    if (!didInitPaginationRef.current) {
      didInitPaginationRef.current = true;
      return;
    }
    setCurrentPage(1);
  }, [activeTab, searchMode]);
  useEffect(() => {
    window.localStorage.setItem(
      warehouseColumnsStorageKey,
      JSON.stringify(visibleColumns),
    );
  }, [visibleColumns]);
  useEffect(() => {
    if (!isColumnsMenuOpen) return;
    const handleDocumentClick = (event: MouseEvent) => {
      if (
        columnsMenuRef.current &&
        !columnsMenuRef.current.contains(event.target as Node)
      ) {
        setIsColumnsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () =>
      document.removeEventListener('mousedown', handleDocumentClick);
  }, [isColumnsMenuOpen]);
  useEffect(() => {
    if (!draftFilters.warehouse || !draftFilters.location) return;
    const hasLocation = availableLocationOptions.some(
      (location) => location.name === draftFilters.location,
    );
    if (hasLocation) return;
    setDraftFilters((current) => ({ ...current, location: '' }));
  }, [
    availableLocationOptions,
    draftFilters.location,
    draftFilters.warehouse,
  ]);
  useEffect(() => {
    window.localStorage.setItem(
      savedWarehouseFiltersStorageKey,
      JSON.stringify(savedFilters),
    );
  }, [savedFilters]);

  useEffect(() => {
    window.localStorage.setItem(
      warehouseFiltersStorageKey,
      JSON.stringify({
        activeTab,
        query,
        searchMode,
        settingsTab,
        currentPage,
        pageSize,
      }),
    );
  }, [
    activeTab,
    currentPage,
    pageSize,
    query,
    searchMode,
    settingsTab,
  ]);

  useEffect(() => {
    setAdministrators((current) => {
      const currentByEmployee = current.reduce<
        Record<string, Administrator>
      >((acc, administrator) => {
        acc[administrator.employeeId] = administrator;
        return acc;
      }, {});
      const firstActiveWarehouse =
        warehouses.find((warehouse) => warehouse.isActive) ?? null;
      return activeEmployees.map(
        (employee) =>
          currentByEmployee[employee.id] ?? {
            employeeId: employee.id,
            warehouseIds: firstActiveWarehouse
              ? [firstActiveWarehouse.id]
              : [],
            defaultWarehouseId: firstActiveWarehouse?.id ?? '',
            defaultLocationId:
              firstActiveWarehouse?.locations[0]?.id ?? '',
          },
      );
    });
  }, [activeEmployees, warehouses]);

  const saveServiceCenter = () => {
    const normalizedName = serviceCenterForm.name.trim();
    if (!normalizedName) return;
    const nextServiceCenters =
      serviceCenterModalId === 'new'
        ? [
            ...serviceCenters,
            {
              id: `sc-${Date.now()}`,
              name: normalizedName,
              color: serviceCenterForm.color,
              address: serviceCenterForm.address.trim(),
              phone: serviceCenterForm.phone.trim(),
            },
          ]
        : serviceCenters.map((x) =>
            x.id === serviceCenterModalId
              ? {
                  ...x,
                  name: normalizedName,
                  color: serviceCenterForm.color,
                  address: serviceCenterForm.address.trim(),
                  phone: serviceCenterForm.phone.trim(),
                }
              : x,
          );
    setServiceCenters(nextServiceCenters);
    setServiceCenterModalId(null);
    void persistWarehouseSettings({
      serviceCenters: nextServiceCenters,
      successMessage: i18n.t('warehouse.messages.success.serviceCenterSaved'),
    });
  };

  const normalizeAdministratorsForWarehouses = (
    currentAdministrators: Administrator[],
    nextWarehouses: WarehouseItem[],
  ) => {
    const warehouseById = new Map(
      nextWarehouses.map((warehouse) => [warehouse.id, warehouse]),
    );
    return currentAdministrators.map((administrator) => {
      const warehouseIds = administrator.warehouseIds.filter((warehouseId) =>
        warehouseById.has(warehouseId),
      );
      const activeWarehouseIds = warehouseIds.filter(
        (warehouseId) => warehouseById.get(warehouseId)?.isActive,
      );
      const defaultWarehouse = warehouseById.get(
        administrator.defaultWarehouseId,
      );
      const hasValidDefaultWarehouse =
        defaultWarehouse?.isActive &&
        warehouseIds.includes(administrator.defaultWarehouseId);
      const hasValidDefaultLocation =
        hasValidDefaultWarehouse &&
        defaultWarehouse.locations.some(
          (location) => location.id === administrator.defaultLocationId,
        );

      if (hasValidDefaultWarehouse && hasValidDefaultLocation) {
        return { ...administrator, warehouseIds };
      }

      const fallbackWarehouseId = activeWarehouseIds[0] ?? '';
      const fallbackWarehouse = warehouseById.get(fallbackWarehouseId);
      return {
        ...administrator,
        warehouseIds,
        defaultWarehouseId: fallbackWarehouseId,
        defaultLocationId: fallbackWarehouse?.locations[0]?.id ?? '',
      };
    });
  };

  const saveWarehouse = () => {
    const normalizedName = warehouseForm.name.trim();
    const normalizedLocations = warehouseForm.locations
      .map((location, index) => ({
        id: location.id || `l-${Date.now()}-${index}`,
        name: location.name.trim(),
      }))
      .filter((location) => location.name);
    const uniqueLocationNames = new Set(
      normalizedLocations.map((location) => location.name.toLowerCase()),
    );
    if (
      !normalizedName ||
      !warehouseForm.serviceCenterId ||
      normalizedLocations.length === 0 ||
      uniqueLocationNames.size !== normalizedLocations.length
    )
      return;
    const locations = normalizedLocations;
    const nextWarehouses =
      warehouseModalId === 'new'
        ? [
            ...warehouses,
            {
              id: `w-${Date.now()}`,
              name: normalizedName,
              isActive: warehouseForm.isActive,
              serviceCenterId: warehouseForm.serviceCenterId,
              receiptAddress: warehouseForm.receiptAddress.trim(),
              receiptPhone: warehouseForm.receiptPhone.trim(),
              locations,
            },
          ]
        : warehouses.map((x) =>
            x.id === warehouseModalId
              ? {
                  ...x,
                  name: normalizedName,
                  isActive: warehouseForm.isActive,
                  serviceCenterId: warehouseForm.serviceCenterId,
                  receiptAddress: warehouseForm.receiptAddress.trim(),
                  receiptPhone: warehouseForm.receiptPhone.trim(),
                  locations,
                }
              : x,
          );
    const nextAdministrators = normalizeAdministratorsForWarehouses(
      administrators,
      nextWarehouses,
    );
    setWarehouses(nextWarehouses);
    setAdministrators(nextAdministrators);
    setWarehouseModalId(null);
    void persistWarehouseSettings({
      warehouses: nextWarehouses,
      administrators: nextAdministrators,
      successMessage: i18n.t('warehouse.messages.success.warehouseSaved'),
    });
  };
  const createReceipt = () => {
    if (!receiptForm.supplierId || !receiptForm.productName.trim())
      return;
    const supplier = suppliers.find(
      (item) => item.id === receiptForm.supplierId,
    );
    const quantity = Number(receiptForm.quantity) || 0;
    const price = parseDecimal(receiptForm.price) || 0;
    if (quantity <= 0 || price < 0) return;

    const amount = quantity * price;
    const now = new Date().toISOString();
    setManualReceiptRows((current) => [
      {
        id: `manual-${Date.now()}`,
        number: `R-${23000 + current.length + 1}`,
        productName: receiptForm.productName.trim(),
        quantity,
        price,
        amount,
        paid: amount,
        supplierName: supplier?.name || 'Supplier',
        createdAt: now,
        acceptedBy: t('common.administrator'),
        approvedBy: '-',
        acceptedAt: now,
        status: 'new',
        paymentStatus: 'pending',
        note: receiptForm.note.trim() || 'L',
      },
      ...current,
    ]);

    onProductChange('name', receiptForm.productName.trim());
    onProductChange('article', '');
    onProductChange(
      'serialNumber',
      `REC-${Date.now().toString().slice(-6)}`,
    );
    onProductChange('price', String(price));
    onProductChange('quantity', String(quantity));
    onProductChange(
      'purchasePlace',
      supplier?.name || i18n.t('common.supplier'),
    );
    onProductChange('purchaseDate', now.slice(0, 10));
    onProductChange('note', receiptForm.note.trim());
    onProductSubmit();

    setReceiptForm({
      supplierId: '',
      productName: '',
      price: '0',
      quantity: '1',
      note: '',
    });
    setIsReceiptModalOpen(false);
  };
  const applyFilters = () => {
    setAppliedFilters({
      ...draftFilters,
      name: draftFilters.name.trim(),
      serial: draftFilters.serial.trim(),
      article: draftFilters.article.trim(),
      warehouse: draftFilters.warehouse.trim(),
      supplier: draftFilters.supplier.trim(),
      buyer: draftFilters.buyer.trim(),
      favoritesOnly: draftFilters.favoritesOnly,
    });
    setCurrentPage(1);
    setIsFilterPanelOpen(false);
  };
  const resetFilters = () => {
    setDraftFilters(initialWarehouseFilters);
    setAppliedFilters(initialWarehouseFilters);
    setCurrentPage(1);
  };
  const toggleReceiptFavoritesOnly = () => {
    const nextFilters = {
      ...appliedFilters,
      favoritesOnly: !appliedFilters.favoritesOnly,
    };
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setCurrentPage(1);
  };
  const toggleReceiptFavorite = async (receipt: ReceiptRow) => {
    if (!receipt.supplierOrderId) return;
    if (!canManageSupplierOrders) {
      onError(
        i18n.t('orders.supplierOrders.messages.errors.noManagePermission'),
      );
      return;
    }

    try {
      await updateSupplierOrderFavoriteMutation.mutateAsync({
        supplierOrderId: receipt.supplierOrderId,
        payload: {
          isFavorite: receipt.supplierOrderIsFavorite !== true,
        },
      });
      await refreshSupplierOrders();
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : i18n.t('orders.supplierOrders.messages.errors.failedUpdateStar'),
      );
    }
  };
  const saveCurrentFilter = () => {
    const filterName = newFilterName.trim();
    if (!filterName || !currentEmployeeName.trim()) return;
    const nextFilter: SavedWarehouseFilter = {
      id: `wf-${Date.now()}`,
      employeeName: currentEmployeeName.trim(),
      name: filterName,
      icon: newFilterIcon,
      tab: activeTab,
      filters: {
        ...draftFilters,
        name: draftFilters.name.trim(),
        serial: draftFilters.serial.trim(),
        article: draftFilters.article.trim(),
        warehouse: draftFilters.warehouse.trim(),
        supplier: draftFilters.supplier.trim(),
        buyer: draftFilters.buyer.trim(),
        favoritesOnly: draftFilters.favoritesOnly,
      },
      createdAt: new Date().toISOString(),
    };
    setSavedFilters((current) => [nextFilter, ...current]);
    setIsSaveFilterDrawerOpen(false);
    setNewFilterName('');
    setNewFilterIcon(warehouseFilterIconOptions[0]);
  };
  const applySavedFilter = (savedFilter: SavedWarehouseFilter) => {
    const nextFilters = normalizeWarehouseFilters(savedFilter.filters);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setCurrentPage(1);
    setIsSaveFilterDrawerOpen(false);
    setIsFilterPanelOpen(false);
  };
  const removeSavedFilter = (filterId: string) => {
    setSavedFilters((current) =>
      current.filter((item) => item.id !== filterId),
    );
  };
  const toggleColumnVisibility = (
    columnKey: StockColumnKey | ReceiptsColumnKey,
  ) => {
    if (!activeColumnsTab) return;
    const availableColumns = availableWarehouseColumns[activeColumnsTab];
    const lockedColumns = lockedWarehouseColumns[activeColumnsTab];
    if (
      !availableColumns.includes(
        columnKey as never,
      ) ||
      lockedColumns.includes(columnKey as never)
    ) {
      return;
    }
    setVisibleColumns((current) => {
      const currentColumns = current[activeColumnsTab];
      const currentColumnsSet = new Set<string>(
        currentColumns as string[],
      );
      if (
        currentColumnsSet.has(columnKey) &&
        currentColumns.length <= 1
      ) {
        return current;
      }
      const nextColumns = currentColumnsSet.has(columnKey)
        ? currentColumns.filter((key) => key !== columnKey)
        : availableColumns.filter(
            (key) => key === columnKey || currentColumnsSet.has(key),
          );
      return {
        ...current,
        [activeColumnsTab]: nextColumns,
      };
    });
  };
  const submitTransfer = async () => {
    if (!activeTransferProduct) return;
    const targetWarehouse = warehouses.find(
      (warehouse) => warehouse.id === transferForm.toWarehouseId,
    );
    const targetLocation = targetWarehouse?.locations.find(
      (location) => location.id === transferForm.toLocationId,
    );
    const sourceMeta = productWarehouseMetaById[activeTransferProduct.id];

    if (!targetWarehouse || !targetLocation) {
      onError(i18n.t('warehouse.messages.errors.selectTarget'));
      return;
    }
    if (!targetWarehouse.isActive) {
      onError(i18n.t('warehouse.messages.errors.inactiveWarehouse'));
      return;
    }

    if (
      sourceMeta?.warehouseId === targetWarehouse.id &&
      sourceMeta?.locationId === targetLocation.id
    ) {
      onError(i18n.t('warehouse.messages.errors.alreadyInLocation'));
      return;
    }

    const wasTransferred = await onProductTransfer(activeTransferProduct, {
      warehouseId: targetWarehouse.id,
      locationId: targetLocation.id,
      note: transferForm.note.trim(),
    });

    if (!wasTransferred) return;

    setTransferHistory((current) => [
      {
        id: `transfer-${Date.now()}`,
        productName: activeTransferProduct.name,
        serialNumber: activeTransferProduct.serialNumber,
        fromWarehouseName: sourceMeta?.warehouseName ?? '-',
        fromLocationName: sourceMeta?.locationName ?? '-',
        toWarehouseName: targetWarehouse.name,
        toLocationName: targetLocation.name,
        note: transferForm.note.trim(),
        createdAt: new Date().toISOString(),
        createdBy: currentEmployeeName || t('common.administrator'),
      },
      ...current,
    ]);
    setTransferForm((current) => ({
      ...current,
      productId: '',
      note: '',
    }));
    onSuccess(i18n.t('warehouse.messages.success.productTransferred'));
  };

  return (
    <section className='panel warehouse-panel'>
      <div
        className='warehouse-tabs'
        role='tablist'
        aria-label={t('warehouse.tabs.ariaLabel')}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type='button'
            className={
              tab.key === activeTab
                ? 'warehouse-tab warehouse-tab-active'
                : 'warehouse-tab'
            }
            onClick={() => setActiveTab(tab.key)}
          >
            <span>{t(tab.labelKey)}</span>
            {tab.badge ? <strong>{tab.badge}</strong> : null}
          </button>
        ))}
      </div>

      {activeTab !== 'settings' && activeTab !== 'information' ? (
        <WarehouseToolbar
          activeTab={activeTab}
          currentPage={currentPage}
          pageSize={activePageSize}
          stockSummaryText={stockSummaryText}
          totalItems={totalItems}
          selectedProductCount={selectedStockProductIds.length}
          selectedSerialCount={selectedStockProductsWithSerials.length}
          activeColumnsTab={activeColumnsTab}
          columnsMenuRef={columnsMenuRef}
          isColumnsMenuOpen={isColumnsMenuOpen}
          visibleColumnKeySet={visibleColumnKeySet}
          activeFilterCount={activeFilterCount}
          favoritesOnly={appliedFilters.favoritesOnly}
          query={query}
          searchMode={searchMode}
          searchPlaceholder={searchPlaceholder}
          onPrintSelectedSerials={printSelectedStockSerials}
          onClearSelection={() => setSelectedStockProductIds([])}
          onToggleColumnsMenu={() =>
            setIsColumnsMenuOpen((current) => !current)
          }
          onToggleColumnVisibility={toggleColumnVisibility}
          onToggleFilters={() => setIsFilterPanelOpen((current) => !current)}
          onToggleFavoritesOnly={toggleReceiptFavoritesOnly}
          setQuery={setQuery}
          setSearchMode={setSearchMode}
          setCurrentPage={setCurrentPage}
        />
      ) : null}
      {activeTab !== 'settings' && activeTab !== 'information' ? (
        <section
          className={
            isFilterPanelOpen
              ? 'orders-filter-panel orders-filter-panel-open'
              : 'orders-filter-panel'
          }
        >
          <div className='orders-filter-saved-row'>
            <strong>{t('orders.filters.savedLabel')}</strong>
            <div className='orders-filter-saved-list'>
              {employeeSavedFilters.length > 0 ? (
                employeeSavedFilters.map((savedFilter) => (
                  <div
                    key={savedFilter.id}
                    className='orders-filter-saved-item'
                  >
                    <button
                      type='button'
                      className='orders-filter-saved-button'
                      onClick={() => applySavedFilter(savedFilter)}
                    >
                      {`${savedFilter.icon} ${savedFilter.name}`}
                    </button>
                    <button
                      type='button'
                      className='orders-filter-delete-button'
                      onClick={() => removeSavedFilter(savedFilter.id)}
                      aria-label={t('orders.filters.deleteFilter', {
                        name: savedFilter.name,
                      })}
                    >
                      x
                    </button>
                  </div>
                ))
              ) : (
                <small>{t('orders.filters.noSaved')}</small>
              )}
            </div>
            <button
              type='button'
              className='toolbar-square-button'
              aria-label={t('orders.filters.saveFilter')}
              onClick={() => setIsSaveFilterDrawerOpen(true)}
            >
              +
            </button>
          </div>
          <div className='orders-filter-grid'>
            <label className='orders-filter-field'>
              <span>{t('warehouse.filters.byName')}</span>
              <input
                type='text'
                value={draftFilters.name}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder={t('warehouse.filters.productNamePlaceholder')}
              />
            </label>
            <label className='orders-filter-field'>
              <span>{t('warehouse.filters.bySerial')}</span>
              <input
                type='text'
                value={draftFilters.serial}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    serial: event.target.value,
                  }))
                }
                placeholder={t('warehouse.filters.serialPlaceholder')}
              />
            </label>
            <label className='orders-filter-field'>
              <span>{t('warehouse.filters.byArticle')}</span>
              <input
                type='text'
                value={draftFilters.article}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    article: event.target.value,
                  }))
                }
                placeholder={t('warehouse.filters.articlePlaceholder')}
              />
            </label>
            <label className='orders-filter-field'>
              <span>{t('orders.filters.warehouse')}</span>
              <select
                value={draftFilters.warehouse}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    warehouse: event.target.value,
                  }))
                }
              >
                <option value=''>{t('orders.filters.all')}</option>
                {warehouseOptions.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.name}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
            <label className='orders-filter-field'>
              <span>{t('common.supplier')}</span>
              <input
                list='warehouse-supplier-options'
                type='text'
                value={draftFilters.supplier}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    supplier: event.target.value,
                  }))
                }
                placeholder={t('warehouse.filters.supplierPlaceholder')}
              />
              <datalist id='warehouse-supplier-options'>
                {supplierOptions.map((supplierName) => (
                  <option key={supplierName} value={supplierName} />
                ))}
              </datalist>
            </label>
            <label className='orders-filter-field'>
              <span>{t('warehouse.filters.buyer')}</span>
              <select
                value={draftFilters.buyer}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    buyer: event.target.value,
                  }))
                }
              >
                <option value=''>{t('orders.filters.all')}</option>
                {buyerOptions.map((buyer) => (
                  <option key={buyer} value={buyer}>
                    {buyer}
                  </option>
                ))}
              </select>
            </label>
            {activeTab === 'stock' ? (
              <label className='orders-filter-field'>
                <span>{t('warehouse.filters.location')}</span>
                <select
                  value={draftFilters.location}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      location: event.target.value,
                    }))
                  }
                >
                  <option value=''>{t('orders.filters.all')}</option>
                  {availableLocationOptions.map((location) => (
                    <option key={location.id} value={location.name}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {activeTab === 'receipts' ? (
              <label className='orders-filter-field'>
                <span>{t('warehouse.filters.status')}</span>
                <select
                  value={draftFilters.status}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      status: event.target.value as WarehouseFilters['status'],
                    }))
                  }
                >
                  <option value=''>{t('orders.filters.all')}</option>
                  {receiptStatusFilterOptions.map((status) => (
                    <option key={status} value={status}>
                      {t(`warehouse.tables.receipts.status.${status}`)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {activeTab === 'receipts' ? (
              <label className='orders-filter-field warehouse-favorites-filter'>
                <span>{t('warehouse.filters.starredOnly')}</span>
                <input
                  type='checkbox'
                  checked={draftFilters.favoritesOnly}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      favoritesOnly: event.target.checked,
                    }))
                  }
                />
              </label>
            ) : null}
          </div>
          <div className='orders-filter-actions'>
            <button
              type='button'
              className='toolbar-filter-button orders-filter-apply'
              onClick={applyFilters}
            >
              {t('orders.filters.apply')}
            </button>
            <button
              type='button'
              className='toolbar-filter-button'
              onClick={resetFilters}
            >
              {t('orders.filters.clear')}
            </button>
          </div>
        </section>
      ) : null}
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
              <h3>{t('orders.filters.drawer.title')}</h3>
              <button
                type='button'
                aria-label={t('orders.filters.drawer.close')}
                onClick={() => setIsSaveFilterDrawerOpen(false)}
              >
                x
              </button>
            </header>
            <label className='orders-filter-field'>
              <span>{t('orders.filters.drawer.filterName')}</span>
              <input
                type='text'
                value={newFilterName}
                onChange={(event) =>
                  setNewFilterName(event.target.value)
                }
                placeholder={t('orders.filters.drawer.filterNamePlaceholder')}
              />
            </label>
            <div className='orders-filter-icons'>
              <span>{t('orders.filters.drawer.chooseIcon')}</span>
              <div className='orders-filter-icons-grid'>
                {warehouseFilterIconOptions.map((icon) => (
                  <button
                    key={icon}
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
              <span>{t('orders.filters.drawer.yourSaved')}</span>
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
                      onClick={() => removeSavedFilter(savedFilter.id)}
                      aria-label={t('orders.filters.deleteFilter', {
                        name: savedFilter.name,
                      })}
                    >
                      x
                    </button>
                  </div>
                ))
              ) : (
                <small>{t('orders.filters.drawer.noFiltersYet')}</small>
              )}
            </div>
            <footer>
              <button
                type='button'
                className='toolbar-filter-button orders-filter-apply'
                onClick={saveCurrentFilter}
              >
                {t('common.save')}
              </button>
              <button
                type='button'
                className='toolbar-filter-button'
                onClick={() => setIsSaveFilterDrawerOpen(false)}
              >
                {t('common.cancel')}
              </button>
            </footer>
          </aside>
        </div>
      ) : null}

      {activeTab === 'receipts' ? (
        <div className='warehouse-receipt-header'>
          <p className='panel-subtitle'>
            {t('warehouse.receipts.subtitle')}
          </p>
          {canManageSupplierOrders ? (
            <button
              type='button'
              className='orders-create-button'
              onClick={() => {
                setEditingSupplierOrder(null);
                setIsSupplierOrderModalOpen(true);
              }}
            >
              {t('warehouse.receipts.createOrder')}
            </button>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'settings' ? (
        <WarehouseSettings
          tab={settingsTab}
          onTabChange={setSettingsTab}
          employees={activeEmployees}
          serviceCenters={serviceCenters}
          warehouses={warehouses}
          administrators={administrators}
          warehousesByServiceCenter={warehousesByServiceCenter}
          activeWarehousesByServiceCenter={activeWarehousesByServiceCenter}
          warehouseProductCounts={warehouseProductCounts}
          onCreateServiceCenter={() => {
            setServiceCenterModalId('new');
            setServiceCenterForm(toServiceCenterForm());
          }}
          onEditServiceCenter={(serviceCenter) => {
            setServiceCenterModalId(serviceCenter.id);
            setServiceCenterForm(toServiceCenterForm(serviceCenter));
          }}
          onCreateWarehouse={() => {
            setWarehouseModalId('new');
            setWarehouseForm(toWarehouseForm());
          }}
          onEditWarehouse={(warehouse) => {
            setWarehouseModalId(warehouse.id);
            setWarehouseForm(toWarehouseForm(warehouse));
          }}
          onAdministratorChange={setAdministrators}
          onSaveAdministrators={() =>
            void persistWarehouseSettings({
              administrators: normalizeAdministratorsForWarehouses(
                administrators,
                warehouses,
              ),
              successMessage: i18n.t(
                'warehouse.messages.success.administratorSaved',
              ),
            })
          }
          isSaving={isWarehouseSettingsSaving}
        />
      ) : activeTab === 'information' ? (
        <WarehouseInformationPanel
          products={products}
          sales={sales}
          warehouses={warehouses}
          supplierOrders={supplierOrders}
        />
      ) : activeTab === 'stock' ? (
        <>
          <StockTable
            products={paginatedProducts}
            isLoading={isLoading}
            visibleColumns={visibleColumns.stock}
            selectedProductIds={selectedStockProductIds}
            warehouses={warehouses}
            serviceCenters={serviceCenters}
            salesByProductId={salesByProductId}
            supplierOrdersByProductId={supplierOrdersByProductId}
            productWarehouseMetaById={productWarehouseMetaById}
            onToggleProductSelection={(productId) =>
              setSelectedStockProductIds((current) =>
                current.includes(productId)
                  ? current.filter((id) => id !== productId)
                  : [...current, productId],
              )
            }
            onTogglePageSelection={() => {
              const pageIds = paginatedProducts.map((product) => product.id);
              const isPageSelected = pageIds.every((productId) =>
                selectedStockProductIds.includes(productId),
              );
              setSelectedStockProductIds((current) =>
                isPageSelected
                  ? current.filter((productId) => !pageIds.includes(productId))
                  : Array.from(new Set([...current, ...pageIds])),
              );
            }}
            onEdit={onProductEdit}
            onOpenModel={(product) =>
              setSelectedProductModelContext({
                name: product.name,
                printProduct: null,
              })
            }
            onOpenSerial={(product) =>
              setSelectedProductModelContext({
                name: product.name,
                printProduct: product,
              })
            }
            onDelete={onProductDelete}
            onOpenSaleCard={onOpenSaleCard}
            onOpenSupplierOrder={(supplierOrderId, itemIndex) => {
              const matchedOrder = supplierOrders.find(
                (order) => order.id === supplierOrderId,
              );
              if (!matchedOrder) return;
              const matchedItem = matchedOrder.items.find(
                (item) => item.itemIndex === itemIndex,
              );
              if (!matchedItem) return;
              setEditingSupplierOrder({
                ...matchedOrder,
                receiptStatus: matchedItem.receiptStatus ?? 'new',
                number: buildSupplierOrderItemNumber(
                  matchedOrder,
                  matchedItem.itemIndex,
                ),
                items: [matchedItem],
              });
              setEditingSupplierOrderSource(matchedOrder);
              setEditingSupplierOrderItemIndex(matchedItem.itemIndex);
              setIsSupplierOrderModalOpen(true);
            }}
          />
          <PaginationPanel
            totalItems={filteredProducts.length}
            page={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setCurrentPage(1);
            }}
          />
          {selectedProductModelContext ? (
            <ProductModelModal
              name={selectedProductModelContext.name}
              products={products}
              sales={sales}
              warehouses={warehouses}
              printForms={printForms}
              printProduct={selectedProductModelContext.printProduct}
              isSaving={isProductSaving}
              onClose={() => setSelectedProductModelContext(null)}
              onSave={onUpdateProductModel}
            />
          ) : null}
        </>
      ) : activeTab === 'receipts' ? (
        <>
          <ReceiptsTable
            receipts={paginatedReceipts}
            visibleColumns={visibleColumns.receipts}
            canManageSupplierOrders={canManageSupplierOrders}
            onToggleFavorite={(receipt) => void toggleReceiptFavorite(receipt)}
            onOpenOrder={(receipt) => {
              if (!receipt.supplierOrderId) return;
              const matchedOrder = supplierOrders.find(
                (order) => order.id === receipt.supplierOrderId,
              );
              if (!matchedOrder) return;
              const itemIndex = receipt.supplierOrderItemIndex;
              if (itemIndex === undefined) return;
              const matchedItem = matchedOrder.items.find(
                (item) => item.itemIndex === itemIndex,
              );
              if (!matchedItem) return;
              setEditingSupplierOrder({
                ...matchedOrder,
                receiptStatus: matchedItem.receiptStatus ?? 'new',
                number: buildSupplierOrderItemNumber(
                  matchedOrder,
                  matchedItem.itemIndex,
                ),
                items: [matchedItem],
              });
              setEditingSupplierOrderSource(matchedOrder);
              setEditingSupplierOrderItemIndex(matchedItem.itemIndex);
              setIsSupplierOrderModalOpen(true);
            }}
            onOpenProduct={(receipt) => {
              const matchedProduct = receipt.catalogProductId
                ? catalogProducts.find(
                    (product) =>
                      product.id === receipt.catalogProductId,
                  )
                : catalogProducts.find(
                    (product) =>
                      product.name.trim().toLowerCase() ===
                      receipt.productName.trim().toLowerCase(),
                  );
              if (!matchedProduct) {
                onError(
                  i18n.t('orders.supplierOrders.messages.errors.productNotFound'),
                );
                return;
              }
              setSelectedCatalogProductForEdit(matchedProduct);
            }}
            onOpenSupplier={(receipt) => {
              const supplierIdFromOrder = receipt.supplierOrderId
                ? supplierOrders.find(
                    (order) => order.id === receipt.supplierOrderId,
                  )?.supplierId
                : undefined;
              const matchedSupplier =
                suppliers.find(
                  (supplier) =>
                    supplier.name.trim().toLowerCase() ===
                    receipt.supplierName.trim().toLowerCase(),
                ) ??
                suppliers.find(
                  (supplier) => supplier.id === supplierIdFromOrder,
                );
              if (!matchedSupplier) {
                onError(
                  i18n.t('orders.supplierOrders.messages.errors.supplierNotFound'),
                );
                return;
              }
              setSelectedSupplierForEdit(matchedSupplier);
            }}
          />
          <PaginationPanel
            totalItems={filteredReceipts.length}
            page={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setCurrentPage(1);
            }}
          />
        </>
      ) : activeTab === 'transfers' ? (
        <TransferWorkspace
          products={paginatedTransferProducts}
          selectableProducts={filteredProducts}
          warehouses={warehouses.filter((warehouse) => warehouse.isActive)}
          productWarehouseMetaById={productWarehouseMetaById}
          form={transferForm}
          selectedProduct={activeTransferProduct}
          targetLocations={transferLocationOptions}
          history={transferHistory}
          isSaving={isProductSaving}
          onFormChange={setTransferForm}
          onSubmit={submitTransfer}
        />
      ) : (
        <p className='empty-state'>
          {t('warehouse.emptySection')}
        </p>
      )}
      <ServiceCenterModal
        modalId={serviceCenterModalId}
        form={serviceCenterForm}
        onFormChange={setServiceCenterForm}
        onClose={() => setServiceCenterModalId(null)}
        onSubmit={saveServiceCenter}
      />

      <WarehouseEditModal
        modalId={warehouseModalId}
        form={warehouseForm}
        serviceCenters={serviceCenters}
        locationUsage={
          warehouseModalId && warehouseModalId !== 'new'
            ? locationUsageByWarehouse[warehouseModalId] ?? {}
            : {}
        }
        onFormChange={setWarehouseForm}
        onClose={() => setWarehouseModalId(null)}
        onSubmit={saveWarehouse}
      />
      {isReceiptModalOpen ? (
        <ModalShell
          title={t('warehouse.modals.createReceiptOrder')}
          onClose={() => setIsReceiptModalOpen(false)}
          onSubmit={createReceipt}
          submitLabel={
            isProductSaving ? '...' : t('warehouse.modals.create')
          }
          canSubmit={Boolean(
            receiptForm.supplierId &&
            receiptForm.productName.trim() &&
            Number(receiptForm.quantity) > 0,
          )}
        >
          <div className='warehouse-receipt-modal-grid'>
            <label className='field'>
              <span>{t('warehouse.modals.supplierRequired')}</span>
              <select
                value={receiptForm.supplierId}
                onChange={(event) =>
                  setReceiptForm((current) => ({
                    ...current,
                    supplierId: event.target.value,
                  }))
                }
              >
                <option value=''>{t('warehouse.modals.supplierPlaceholder')}</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>
            <label className='field'>
              <span>{t('warehouse.modals.productRequired')}</span>
              <input
                value={receiptForm.productName}
                onChange={(event) =>
                  setReceiptForm((current) => ({
                    ...current,
                    productName: event.target.value,
                  }))
                }
                placeholder={t('warehouse.modals.productNamePlaceholder')}
              />
            </label>
            <label className='field'>
              <span>{t('warehouse.modals.priceUah')}</span>
              <input
                type='text'
                inputMode='decimal'
                value={receiptForm.price}
                onChange={(event) =>
                  setReceiptForm((current) => ({
                    ...current,
                    price: normalizeDecimalInput(event.target.value),
                  }))
                }
              />
            </label>
            <label className='field'>
              <span>{t('warehouse.modals.quantityRequired')}</span>
              <input
                type='number'
                min='1'
                value={receiptForm.quantity}
                onChange={(event) =>
                  setReceiptForm((current) => ({
                    ...current,
                    quantity: event.target.value,
                  }))
                }
              />
            </label>
            <label className='field field-wide'>
              <span>{t('warehouse.modals.note')}</span>
              <textarea
                rows={3}
                value={receiptForm.note}
                onChange={(event) =>
                  setReceiptForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
              />
            </label>
          </div>
        </ModalShell>
      ) : null}

      <SupplierOrderModal
        isOpen={isSupplierOrderModalOpen}
        printForms={printForms}
        suppliers={suppliers}
        editingOrder={editingSupplierOrder}
        forceReadOnly={!canManageSupplierOrders}
        onClose={() => {
          setIsSupplierOrderModalOpen(false);
          setEditingSupplierOrder(null);
          setEditingSupplierOrderSource(null);
          setEditingSupplierOrderItemIndex(null);
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
          if (!editingSupplierOrder) return;
          const orderId =
            editingSupplierOrderSource?.id ?? editingSupplierOrder.id;
          const result = await takeOnChargeSupplierOrderMutation.mutateAsync({
            supplierOrderId: orderId,
            payload: {
              autoGenerateSerialNumbers,
              serialNumbers,
              autoGenerateArticles,
              articleBase: articleBase.trim().toUpperCase(),
              itemIndex:
                editingSupplierOrderItemIndex === null
                  ? undefined
                  : editingSupplierOrderItemIndex,
              warehouseId,
              locationId,
            },
          });
          onSuccess(i18n.t('orders.messages.success.takenOnCharge'));
          window.dispatchEvent(new Event('project-goods:finance-updated'));
          window.dispatchEvent(new Event('project-goods:products-updated'));
          await refreshSupplierOrders();
          return result;
        }}
        onCancelOrder={async () => {
          if (!canManageSupplierOrders) return;
          if (!editingSupplierOrder) return;
          const orderId =
            editingSupplierOrderSource?.id ?? editingSupplierOrder.id;
          await cancelSupplierOrderMutation.mutateAsync(orderId);
          onSuccess(i18n.t('orders.messages.success.orderCancelled'));
          await refreshSupplierOrders();
        }}
        onSubmit={async (
          payload: SupplierOrderModalSubmitPayload,
        ) => {
          if (!canManageSupplierOrders) {
            onError(
              i18n.t('orders.supplierOrders.messages.errors.noManagePermission'),
            );
            return;
          }
          try {
            if (editingSupplierOrder) {
              const sourceOrder =
                editingSupplierOrderSource ?? editingSupplierOrder;
              await Promise.all(
                payload.items.map((item) => {
                  const previousItem =
                    editingSupplierOrderItemIndex === null
                      ? sourceOrder.items.find(
                          (currentItem) =>
                            currentItem.itemIndex === item.itemIndex,
                        )
                      : sourceOrder.items.find(
                          (currentItem) =>
                            currentItem.itemIndex ===
                            editingSupplierOrderItemIndex,
                        );
                  if (!previousItem) return Promise.resolve();
                  return syncSupplierOrderRenameToCatalog(
                    previousItem.catalogProductId,
                    item.productName.trim(),
                  );
                }),
              );
            }
            const supplierOrderPayload: SupplierOrderFormValues = {
              supplierId: payload.supplierId,
              deliveryDate: payload.deliveryDate,
              supplyType: payload.supplyType,
              number: payload.number,
              note: payload.note,
              createdBy: currentEmployeeName || t('common.administrator'),
              status: editingSupplierOrder
                ? editingSupplierOrder.status
                : 'approved',
              paymentStatus: editingSupplierOrder?.paymentStatus,
              items: payload.items,
            };
            if (editingSupplierOrder) {
              const orderSource =
                editingSupplierOrderSource ?? editingSupplierOrder;
              const mergedItems =
                editingSupplierOrderItemIndex === null
                  ? payload.items
                  : mergeSupplierOrderItemUpdate({
                      sourceOrder: orderSource,
                      selectedItemIndex: editingSupplierOrderItemIndex,
                      updatedItem: payload.items[0],
                    });
              await updateSupplierOrderMutation.mutateAsync({
                supplierOrderId: orderSource.id,
                payload: {
                  ...supplierOrderPayload,
                  number: orderSource.number,
                  orderBaseId: orderSource.orderBaseId,
                  items: mergedItems,
                },
              });
              onSuccess(i18n.t('warehouse.messages.success.receiptOrderUpdated'));
            } else {
              await createSupplierOrderMutation.mutateAsync({
                ...supplierOrderPayload,
                orderBaseId: `SO-${Date.now()}`,
              });
              onSuccess(
                i18n.t('warehouse.messages.success.receiptOrderCreated'),
              );
            }
            setIsSupplierOrderModalOpen(false);
            setEditingSupplierOrder(null);
            setEditingSupplierOrderSource(null);
            setEditingSupplierOrderItemIndex(null);
            await refreshSupplierOrders();
          } catch (error) {
            onError(
              error instanceof Error
                ? error.message
                : i18n.t('warehouse.messages.errors.failedCreateReceiptOrder'),
            );
          }
        }}
        warehouseOptions={takeOnChargeWarehouseOptions}
      />

      {selectedSupplierForEdit ? (
        <div
          className='modal-backdrop'
          role='presentation'
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setSelectedSupplierForEdit(null);
          }}
        >
          <section className='catalog-edit-modal' role='dialog' aria-modal='true'>
            <header className='catalog-edit-header'>
              <div className='catalog-edit-title'>
                <h2>{t('warehouse.modals.supplierTitle')}</h2>
              </div>
              <button
                type='button'
                className='create-order-close'
                onClick={() => setSelectedSupplierForEdit(null)}
                aria-label={t('common.close')}
              >
                &times;
              </button>
            </header>
            <div className='catalog-edit-body'>
              <label className='field'>
                <span>{t('common.name')}</span>
                <input
                  value={supplierEditForm.name}
                  onChange={(event) =>
                    setSupplierEditForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className='field'>
                <span>{t('warehouse.modals.phone')}</span>
                <input
                  value={supplierEditForm.phone}
                  onChange={(event) =>
                    setSupplierEditForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                />
              </label>
              <label className='field field-wide'>
                <span>{t('warehouse.modals.note')}</span>
                <textarea
                  rows={3}
                  value={supplierEditForm.note}
                  onChange={(event) =>
                    setSupplierEditForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <footer className='catalog-edit-footer'>
              <button
                type='button'
                className='primary-button'
                disabled={
                  isSupplierSaving ||
                  supplierEditForm.name.trim().length < 2 ||
                  supplierEditForm.phone.trim().length < 3
                }
                onClick={async () => {
                  if (!selectedSupplierForEdit) return;
                  setIsSupplierSaving(true);
                  const ok = await onUpdateSupplier(
                    selectedSupplierForEdit.id,
                    {
                      name: supplierEditForm.name.trim(),
                      phone: supplierEditForm.phone.trim(),
                      note: supplierEditForm.note.trim(),
                      supplierOrder:
                        selectedSupplierForEdit.supplierOrder,
                      isActive: supplierEditForm.isActive,
                    },
                  );
                  setIsSupplierSaving(false);
                  if (!ok) return;
                  onSuccess(
                    i18n.t('orders.supplierOrders.messages.success.supplierUpdated'),
                  );
                  await refreshSupplierOrders();
                  setSelectedSupplierForEdit(null);
                }}
              >
                {isSupplierSaving ? t('warehouse.modals.saving') : t('common.save')}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {selectedCatalogProductForEdit ? (
        <div
          className='modal-backdrop'
          role='presentation'
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setSelectedCatalogProductForEdit(null);
          }}
        >
          <section className='catalog-edit-modal' role='dialog' aria-modal='true'>
            <header className='catalog-edit-header'>
              <div className='catalog-edit-title'>
                <h2>{t('warehouse.modals.productTitle')}</h2>
              </div>
              <button
                type='button'
                className='create-order-close'
                onClick={() => setSelectedCatalogProductForEdit(null)}
                aria-label={t('common.close')}
              >
                &times;
              </button>
            </header>
            <div className='catalog-edit-body'>
              <label className='field'>
                <span>{t('warehouse.modals.productName')}</span>
                <input
                  value={productEditForm.name}
                  onChange={(event) =>
                    setProductEditForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className='field field-wide'>
                <span>{t('warehouse.modals.note')}</span>
                <textarea
                  rows={3}
                  value={productEditForm.note}
                  onChange={(event) =>
                    setProductEditForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <footer className='catalog-edit-footer'>
              <button
                type='button'
                className='primary-button'
                disabled={
                  isProductSavingInline ||
                  productEditForm.name.trim().length < 2
                }
                onClick={async () => {
                  if (!selectedCatalogProductForEdit) return;
                  const catalogProductId =
                    selectedCatalogProductForEdit.id;
                  const nextName = productEditForm.name.trim();
                  setIsProductSavingInline(true);
                  const ok = await onUpdateCatalogProduct(
                    selectedCatalogProductForEdit.id,
                    {
                      name: nextName,
                      note: productEditForm.note.trim(),
                      isActive: productEditForm.isActive,
                    },
                  );
                  setIsProductSavingInline(false);
                  if (!ok) return;
                  await syncCatalogRenameToSupplierOrders(
                    catalogProductId,
                    nextName,
                  );
                  onSuccess(
                    i18n.t('orders.supplierOrders.messages.success.productUpdated'),
                  );
                  await refreshSupplierOrders();
                  setSelectedCatalogProductForEdit(null);
                }}
              >
                {isProductSavingInline
                  ? t('warehouse.modals.saving')
                  : t('common.save')}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
};

