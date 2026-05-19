import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Employee } from '../../../entities/employee/model/types';
import type {
  Product,
  ProductFormValues,
} from '../../../entities/product/model/types';
import type {
  CatalogProduct,
  CatalogProductFormValues,
} from '../../../entities/catalog-product/model/types';
import {
  formatCurrency,
  formatDate,
} from '../../../shared/lib/format';
import { PaginationPanel } from '../../../shared/ui/PaginationPanel';
import { getSupplierOrders } from '../../../entities/supplier-order/api/supplierOrderApi';
import { createSupplierOrder } from '../../../entities/supplier-order/api/supplierOrderApi';
import { updateSupplierOrder } from '../../../entities/supplier-order/api/supplierOrderApi';
import { cancelSupplierOrder, takeOnChargeSupplierOrder } from '../../../entities/supplier-order/api/supplierOrderApi';
import {
  SupplierOrderModal,
  type SupplierOrderModalSubmitPayload,
} from './SupplierOrderModal';
import type {
  Supplier,
  SupplierFormValues,
} from '../../../entities/supplier/model/types';
import type {
  SupplierOrder,
  SupplierOrderFormValues,
} from '../../../entities/supplier-order/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import {
  getWarehouseSettings,
  updateWarehouseSettings,
} from '../../../entities/warehouse-settings/api/warehouseSettingsApi';
import {
  buildSupplierOrderItemNumber,
  mergeSupplierOrderItemUpdate,
} from '../model/supplier-order-utils';

type WarehouseTab = 'stock' | 'receipts' | 'transfers' | 'settings';
type WarehouseColumnsTab = 'stock' | 'receipts';
type StockColumnKey =
  | 'select'
  | 'name'
  | 'serial'
  | 'article'
  | 'date'
  | 'purchase'
  | 'warehouse'
  | 'location'
  | 'clientOrder'
  | 'supplierOrder'
  | 'supplier'
  | 'note'
  | 'action';
type ReceiptsColumnKey =
  | 'number'
  | 'product'
  | 'quantity'
  | 'price'
  | 'amount'
  | 'paid'
  | 'supplier'
  | 'receiptDate'
  | 'acceptedBy'
  | 'approvedBy'
  | 'status'
  | 'payment';
type WarehouseColumnVisibility = {
  stock: StockColumnKey[];
  receipts: ReceiptsColumnKey[];
};
type WarehouseSearchMode =
  | 'serial'
  | 'name'
  | 'article'
  | 'warehouse'
  | 'supplier';
type WarehouseFilters = {
  name: string;
  serial: string;
  article: string;
  warehouse: string;
  supplier: string;
  buyer: string;
  location: string;
};
type SavedWarehouseFilter = {
  id: string;
  employeeName: string;
  name: string;
  icon: string;
  tab: WarehouseTab;
  filters: WarehouseFilters;
  createdAt: string;
};
type SettingsTab =
  | 'service-centers'
  | 'warehouses'
  | 'administrators';

type ServiceCenter = {
  id: string;
  name: string;
  color: string;
  address: string;
  phone: string;
};
type WarehouseLocation = { id: string; name: string };
type ReceiptStatus = 'new' | 'approved' | 'received' | 'cancelled';
type ReceiptRow = {
  id: string;
  number: string;
  supplierOrderId?: string;
  supplierOrderItemIndex?: number;
  catalogProductId?: string;
  productName: string;
  quantity: number;
  price: number;
  amount: number;
  paid: number;
  supplierName: string;
  createdAt: string;
  acceptedBy: string;
  approvedBy: string;
  acceptedAt: string;
  status: ReceiptStatus;
  paymentStatus?: 'pending' | 'paid' | 'cancelled';
  note: string;
};
type SupplierOrderLink = {
  order: SupplierOrder;
  itemIndex: number;
  displayNumber: string;
};
type WarehouseItem = {
  id: string;
  name: string;
  isActive: boolean;
  serviceCenterId: string;
  receiptAddress: string;
  receiptPhone: string;
  locations: WarehouseLocation[];
};
type Administrator = {
  employeeId: string;
  warehouseIds: string[];
  defaultWarehouseId: string;
  defaultLocationId: string;
};
type ServiceCenterFormState = {
  name: string;
  color: string;
  address: string;
  phone: string;
};
type WarehouseFormState = {
  name: string;
  isActive: boolean;
  serviceCenterId: string;
  receiptAddress: string;
  receiptPhone: string;
  locations: string[];
};
type ProductWarehouseMeta = {
  warehouseId: string;
  warehouseName: string;
  locationId: string;
  locationName: string;
};

type WarehousePanelProps = {
  products: Product[];
  sales: Sale[];
  catalogProducts: CatalogProduct[];
  employees: Employee[];
  isLoading: boolean;
  productForm: ProductFormValues;
  isProductSaving: boolean;
  isProductEditing: boolean;
  onProductChange: <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ) => void;
  onProductSubmit: () => void;
  onProductCancelEdit: () => void;
  onProductEdit: (product: Product) => void;
  onProductDelete: (product: Product) => void;
  suppliers: Supplier[];
  onCreateSupplier: (payload: SupplierFormValues) => Promise<boolean>;
  onUpdateSupplier: (
    supplierId: string,
    payload: SupplierFormValues,
  ) => Promise<boolean>;
  onUpdateCatalogProduct: (
    catalogProductId: string,
    payload: CatalogProductFormValues,
  ) => Promise<boolean>;
  currentEmployeeName: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

const tabs: Array<{
  key: WarehouseTab;
  label: string;
  badge?: string;
}> = [
  { key: 'stock', label: 'Stock balances' },
  { key: 'receipts', label: 'Receipts', badge: '10' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'settings', label: 'Settings' },
];

const searchModes: Array<{
  key: WarehouseSearchMode;
  label: string;
}> = [
  { key: 'serial', label: 'By serial #' },
  { key: 'name', label: 'By name' },
  { key: 'article', label: 'By article' },
  { key: 'warehouse', label: 'By warehouse' },
  { key: 'supplier', label: 'By supplier' },
];

const settingsTabs: Array<{ key: SettingsTab; label: string }> = [
  { key: 'service-centers', label: 'Service Centers' },
  { key: 'warehouses', label: 'Warehouses' },
  { key: 'administrators', label: 'Administrators' },
];

const initialServiceCenters: ServiceCenter[] = [];

const initialWarehouses: WarehouseItem[] = [];

const initialAdministrators: Administrator[] = [];
const warehouseFiltersStorageKey = 'project-goods.warehouse-filters';
const warehouseColumnsStorageKey = 'project-goods.warehouse-columns';
const savedWarehouseFiltersStorageKey =
  'project-goods.saved-warehouse-filters';
const initialWarehouseFilters: WarehouseFilters = {
  name: '',
  serial: '',
  article: '',
  warehouse: '',
  supplier: '',
  buyer: '',
  location: '',
};
const warehouseFilterIconOptions = [
  '*',
  '#',
  '@',
  '$',
  '%',
  '+',
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
const defaultWarehouseVisibleColumns: WarehouseColumnVisibility = {
  stock: [
    'select',
    'name',
    'serial',
    'article',
    'date',
    'purchase',
    'warehouse',
    'location',
    'clientOrder',
    'supplierOrder',
    'supplier',
    'note',
    'action',
  ],
  receipts: [
    'number',
    'product',
    'quantity',
    'price',
    'amount',
    'paid',
    'supplier',
    'receiptDate',
    'acceptedBy',
    'approvedBy',
    'status',
    'payment',
  ],
};
const availableWarehouseColumns: {
  stock: StockColumnKey[];
  receipts: ReceiptsColumnKey[];
} = {
  stock: [...defaultWarehouseVisibleColumns.stock],
  receipts: [...defaultWarehouseVisibleColumns.receipts],
};
const lockedWarehouseColumns: {
  stock: StockColumnKey[];
  receipts: ReceiptsColumnKey[];
} = {
  stock: ['select'],
  receipts: ['number'],
};

const getSearchText = (
  product: Product,
  mode: WarehouseSearchMode,
) =>
  mode === 'serial'
    ? product.serialNumber
    : mode === 'article'
      ? product.article
    : mode === 'warehouse'
      ? 'Main warehouse'
      : mode === 'supplier'
      ? product.purchasePlace
      : [product.name, product.article, product.note].join(' ');
const toServiceCenterForm = (
  c?: ServiceCenter,
): ServiceCenterFormState => ({
  name: c?.name ?? '',
  color: c?.color ?? '#000000',
  address: c?.address ?? '',
  phone: c?.phone ?? '+380',
});
const toWarehouseForm = (w?: WarehouseItem): WarehouseFormState => ({
  name: w?.name ?? '',
  isActive: w?.isActive ?? true,
  serviceCenterId: w?.serviceCenterId ?? '',
  receiptAddress: w?.receiptAddress ?? '',
  receiptPhone: w?.receiptPhone ?? '',
  locations: w?.locations.map((x) => x.name) ?? [''],
});
const normalizeProductName = (value: string) =>
  value.trim().toLowerCase();
export const WarehousePanel = ({
  products,
  sales,
  catalogProducts,
  employees,
  isLoading,
  isProductSaving,
  onProductChange,
  onProductSubmit,
  onProductEdit,
  onProductDelete,
  suppliers,
  onCreateSupplier,
  onUpdateSupplier,
  onUpdateCatalogProduct,
  currentEmployeeName,
  onSuccess,
  onError,
}: WarehousePanelProps) => {
  const [isWarehouseSettingsSaving, setIsWarehouseSettingsSaving] =
    useState(false);
  const [activeTab, setActiveTab] = useState<WarehouseTab>(() => {
    try {
      const parsed = JSON.parse(
        window.localStorage.getItem(warehouseFiltersStorageKey) ??
          '{}',
      ) as Partial<{ activeTab: WarehouseTab }>;
      return parsed.activeTab === 'stock' ||
        parsed.activeTab === 'receipts' ||
        parsed.activeTab === 'transfers' ||
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
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
    initialWarehouseFilters,
  );
  const [appliedFilters, setAppliedFilters] = useState<WarehouseFilters>(
    initialWarehouseFilters,
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
  const [newFilterName, setNewFilterName] = useState('My filter');
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
  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>(
    [],
  );
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);
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
  const [receiptHistory, setReceiptHistory] = useState<ReceiptRow[]>([]);
  const persistWarehouseSettings = async (payload?: {
    serviceCenters?: ServiceCenter[];
    warehouses?: WarehouseItem[];
    administrators?: Administrator[];
    successMessage?: string;
  }) => {
    const nextServiceCenters = payload?.serviceCenters ?? serviceCenters;
    const nextWarehouses = payload?.warehouses ?? warehouses;
    const nextAdministrators = payload?.administrators ?? administrators;

    setIsWarehouseSettingsSaving(true);
    try {
      const saved = await updateWarehouseSettings({
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
          : 'Failed to save warehouse settings.',
      );
    } finally {
      setIsWarehouseSettingsSaving(false);
    }
  };

  const buildReceiptRows = (orders: SupplierOrder[]): ReceiptRow[] => {
    return orders.flatMap((order) =>
      order.items.map((item) => ({
        id: `${order.id}-${item.itemIndex}`,
        supplierOrderId: order.id,
        supplierOrderItemIndex: item.itemIndex,
        catalogProductId: item.catalogProductId,
        number: buildSupplierOrderItemNumber(order, item.itemIndex),
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        amount: item.price * item.quantity,
        paid: order.paid,
        supplierName: order.supplierName || 'Supplier',
        createdAt: order.createdAt,
        acceptedBy: order.createdBy || 'Administrator',
        approvedBy:
          order.receiptStatus === 'new'
            ? '-'
            : order.createdBy || 'Administrator',
        acceptedAt: order.updatedAt,
        status:
          order.status === 'cancelled' ||
          order.paymentStatus === 'cancelled'
            ? 'cancelled'
            : order.receiptStatus,
        paymentStatus: order.paymentStatus,
        note: order.note || '',
      })),
    );
  };

  const refreshSupplierOrders = async () => {
    const orders = await getSupplierOrders();
    setSupplierOrders(orders);
    const rows = buildReceiptRows(orders);
    setReceiptHistory((current) => {
      const manualRows = current.filter((row) => !row.id.startsWith('so-'));
      return [...rows.map((row) => ({ ...row, id: `so-${row.id}` })), ...manualRows];
    });
  };
  const syncCatalogRenameToSupplierOrders = async (
    catalogProductId: string,
    nextName: string,
  ) => {
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
        updateSupplierOrder(order.id, {
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
    void refreshSupplierOrders().catch(() => undefined);
  }, []);
  useEffect(() => {
    void (async () => {
      try {
        const settings = await getWarehouseSettings();
        setServiceCenters(settings.serviceCenters);
        setWarehouses(settings.warehouses);
        setAdministrators(settings.administrators);
      } catch (error) {
        onError(
          error instanceof Error
            ? error.message
            : 'Failed to load warehouse settings.',
        );
      }
    })();
  }, [onError]);
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
      warehouses
        .filter((warehouse) => warehouse.isActive)
        .map((warehouse) => ({
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
  const productWarehouseMetaById = useMemo(() => {
    const byId = new Map(
      warehouses.map((warehouse) => [warehouse.id, warehouse]),
    );
    const byName = new Map(
      warehouses.map((warehouse) => [
        warehouse.name.trim().toLowerCase(),
        warehouse,
      ]),
    );
    const fallbackWarehouse = warehouses[0];
    return products.reduce<Record<string, ProductWarehouseMeta>>(
      (acc, product) => {
        const matchedWarehouseById = product.warehouseId
          ? byId.get(product.warehouseId)
          : undefined;
        const matchedWarehouse =
          matchedWarehouseById ??
          byName.get(product.purchasePlace.trim().toLowerCase()) ??
          fallbackWarehouse;
        const matchedLocation =
          product.locationId && matchedWarehouse
            ? matchedWarehouse.locations.find(
                (location) => location.id === product.locationId,
              )
            : undefined;
        const firstLocation = matchedLocation ?? matchedWarehouse?.locations[0];
        acc[product.id] = {
          warehouseId: matchedWarehouse?.id ?? '',
          warehouseName: matchedWarehouse?.name ?? '-',
          locationId: firstLocation?.id ?? '',
          locationName: firstLocation?.name ?? '-',
        };
        return acc;
      },
      {},
    );
  }, [products, warehouses]);
  const filteredProducts = useMemo(() => {
    const stockProducts = products.filter(
      (product) => product.quantity > 0,
    );
    const normalizedQuery = query.trim().toLowerCase();
    return stockProducts.filter((product) => {
      const productMeta = productWarehouseMetaById[product.id];
      const warehouseName = productMeta?.warehouseName ?? '-';
      const locationName = productMeta?.locationName ?? '-';
      const matchesQuery =
        !normalizedQuery ||
        getSearchText(product, searchMode)
          .toLowerCase()
          .includes(normalizedQuery);
      if (!matchesQuery) return false;
      if (
        appliedFilters.name.trim() &&
        !product.name
          .toLowerCase()
          .includes(appliedFilters.name.trim().toLowerCase())
      ) {
        return false;
      }
      if (
        appliedFilters.serial.trim() &&
        !product.serialNumber
          .toLowerCase()
          .includes(appliedFilters.serial.trim().toLowerCase())
      ) {
        return false;
      }
      if (
        appliedFilters.article.trim() &&
        !product.article
          .toLowerCase()
          .includes(appliedFilters.article.trim().toLowerCase())
      ) {
        return false;
      }
      if (
        appliedFilters.warehouse.trim() &&
        !warehouseName
          .toLowerCase()
          .includes(appliedFilters.warehouse.trim().toLowerCase())
      ) {
        return false;
      }
      const supplier = appliedFilters.supplier.trim().toLowerCase();
      if (
        supplier &&
        !(product.purchasePlace || '')
          .toLowerCase()
          .includes(supplier)
      ) {
        return false;
      }
      if (
        appliedFilters.location &&
        locationName.toLowerCase() !==
          appliedFilters.location.toLowerCase()
      ) {
        return false;
      }
      if (appliedFilters.buyer.trim()) {
        const productBuyers =
          buyersByProductName[product.name.trim().toLowerCase()] ?? [];
        if (
          !productBuyers.some(
            (buyer) =>
              buyer.toLowerCase() ===
              appliedFilters.buyer.trim().toLowerCase(),
          )
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    appliedFilters,
    buyersByProductName,
    productWarehouseMetaById,
    products,
    query,
    searchMode,
  ]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [currentPage, filteredProducts, pageSize]);
  const filteredReceipts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return receiptHistory.filter((receipt) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          String(receipt.number),
          receipt.productName,
          receipt.supplierName,
          receipt.status,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      if (!matchesQuery) return false;
      if (
        appliedFilters.name.trim() &&
        !receipt.productName
          .toLowerCase()
          .includes(appliedFilters.name.trim().toLowerCase())
      ) {
        return false;
      }
      const supplier = appliedFilters.supplier.trim().toLowerCase();
      if (
        supplier &&
        !receipt.supplierName.toLowerCase().includes(supplier)
      ) {
        return false;
      }
      if (
        appliedFilters.buyer.trim() &&
        receipt.acceptedBy.toLowerCase() !==
          appliedFilters.buyer.trim().toLowerCase()
      ) {
        return false;
      }
      return true;
    });
  }, [appliedFilters, query, receiptHistory]);
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
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedReceipts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReceipts.slice(start, start + pageSize);
  }, [currentPage, filteredReceipts, pageSize]);
  const salesByProductId = useMemo(() => {
    const bySerial = new Map<string, string[]>();
    const byArticle = new Map<string, string[]>();
    const byName = new Map<string, string[]>();

    products.forEach((product) => {
      const serial = product.serialNumber.trim().toLowerCase();
      const article = product.article.trim().toLowerCase();
      const name = product.name.trim().toLowerCase();

      if (serial) {
        bySerial.set(serial, [...(bySerial.get(serial) ?? []), product.id]);
      }
      if (article) {
        byArticle.set(article, [...(byArticle.get(article) ?? []), product.id]);
      }
      if (name) {
        byName.set(name, [...(byName.get(name) ?? []), product.id]);
      }
    });

    return sales.reduce<Record<string, Sale[]>>((acc, sale) => {
      const linkedProductIds = new Set<string>();

      if (sale.product?.id) linkedProductIds.add(sale.product.id);

      (sale.lineItems ?? []).forEach((item) => {
        if (item.kind === 'product' && item.productId) {
          linkedProductIds.add(item.productId);
        }
        if (item.kind === 'product') {
          const itemName = item.name.trim().toLowerCase();
          (byName.get(itemName) ?? []).forEach((productId) =>
            linkedProductIds.add(productId),
          );
        }
      });

      const saleSerial = sale.product?.serialNumber?.trim().toLowerCase();
      const saleArticle = sale.product?.article?.trim().toLowerCase();
      const saleName = sale.product?.name?.trim().toLowerCase();

      (saleSerial ? (bySerial.get(saleSerial) ?? []) : []).forEach((productId) =>
        linkedProductIds.add(productId),
      );
      (saleArticle ? (byArticle.get(saleArticle) ?? []) : []).forEach(
        (productId) => linkedProductIds.add(productId),
      );
      (saleName ? (byName.get(saleName) ?? []) : []).forEach((productId) =>
        linkedProductIds.add(productId),
      );

      linkedProductIds.forEach((productId) => {
        acc[productId] = [...(acc[productId] ?? []), sale];
      });

      return acc;
    }, {});
  }, [products, sales]);
  const supplierOrdersByProductId = useMemo(() => {
    const byCatalogProductName = catalogProducts.reduce<
      Record<string, string[]>
    >((acc, catalogProduct) => {
      const key = catalogProduct.name.trim().toLowerCase();
      if (!key) return acc;
      acc[key] = [...(acc[key] ?? []), catalogProduct.id];
      return acc;
    }, {});

    const byCatalogProductId = supplierOrders.reduce<
      Record<string, SupplierOrderLink[]>
    >((acc, order) => {
      order.items.forEach((item) => {
        if (!item.catalogProductId) return;
        acc[item.catalogProductId] = [
          ...(acc[item.catalogProductId] ?? []),
          {
            order,
            itemIndex: item.itemIndex,
            displayNumber: buildSupplierOrderItemNumber(
              order,
              item.itemIndex,
            ),
          },
        ];
      });
      return acc;
    }, {});

    return products.reduce<Record<string, SupplierOrderLink[]>>(
      (acc, product) => {
        const matchedCatalogIds =
          byCatalogProductName[product.name.trim().toLowerCase()] ?? [];
        const orderMap = new Map<string, SupplierOrderLink>();
        matchedCatalogIds.forEach((catalogId) => {
          (byCatalogProductId[catalogId] ?? []).forEach((link) =>
            orderMap.set(`${link.order.id}-${link.itemIndex}`, link),
          );
        });
        acc[product.id] = Array.from(orderMap.values());
        return acc;
      },
      {},
    );
  }, [catalogProducts, products, supplierOrders]);

  const warehousesByServiceCenter = useMemo(
    () =>
      warehouses.reduce<Record<string, number>>((acc, warehouse) => {
        acc[warehouse.serviceCenterId] =
          (acc[warehouse.serviceCenterId] ?? 0) + 1;
        return acc;
      }, {}),
    [warehouses],
  );

  useEffect(() => {
    const totalItems =
      activeTab === 'receipts'
        ? filteredReceipts.length
        : filteredProducts.length;
    const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [
    activeTab,
    currentPage,
    filteredProducts.length,
    filteredReceipts.length,
    pageSize,
  ]);

  useEffect(() => setCurrentPage(1), [activeTab, searchMode]);
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
      }),
    );
  }, [activeTab, query, searchMode, settingsTab]);

  useEffect(() => {
    setAdministrators((current) => {
      const currentByEmployee = current.reduce<
        Record<string, Administrator>
      >((acc, administrator) => {
        acc[administrator.employeeId] = administrator;
        return acc;
      }, {});
      return activeEmployees.map(
        (employee) =>
          currentByEmployee[employee.id] ?? {
            employeeId: employee.id,
            warehouseIds: warehouses[0] ? [warehouses[0].id] : [],
            defaultWarehouseId: warehouses[0]?.id ?? '',
            defaultLocationId: warehouses[0]?.locations[0]?.id ?? '',
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
      successMessage: 'Service center settings saved.',
    });
  };

  const saveWarehouse = () => {
    const normalizedName = warehouseForm.name.trim();
    const normalizedLocations = warehouseForm.locations
      .map((x) => x.trim())
      .filter(Boolean);
    if (
      !normalizedName ||
      !warehouseForm.serviceCenterId ||
      normalizedLocations.length === 0
    )
      return;
    const locations = normalizedLocations.map((name, index) => ({
      id: `l-${Date.now()}-${index}`,
      name,
    }));
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
    setWarehouses(nextWarehouses);
    setWarehouseModalId(null);
    void persistWarehouseSettings({
      warehouses: nextWarehouses,
      successMessage: 'Warehouse settings saved.',
    });
  };
  const createReceipt = () => {
    if (!receiptForm.supplierId || !receiptForm.productName.trim())
      return;
    const supplier = suppliers.find(
      (item) => item.id === receiptForm.supplierId,
    );
    const quantity = Number(receiptForm.quantity) || 0;
    const price = Number(receiptForm.price) || 0;
    if (quantity <= 0 || price < 0) return;

    const amount = quantity * price;
    const now = new Date().toISOString();
    setReceiptHistory((current) => [
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
        acceptedBy: 'Administrator',
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
      supplier?.name || 'РџРѕСЃС‚Р°С‡Р°Р»СЊРЅРёРє',
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
    });
    setCurrentPage(1);
    setIsFilterPanelOpen(false);
  };
  const resetFilters = () => {
    setDraftFilters(initialWarehouseFilters);
    setAppliedFilters(initialWarehouseFilters);
    setCurrentPage(1);
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
      },
      createdAt: new Date().toISOString(),
    };
    setSavedFilters((current) => [nextFilter, ...current]);
    setIsSaveFilterDrawerOpen(false);
    setNewFilterName('My filter');
    setNewFilterIcon(warehouseFilterIconOptions[0]);
  };
  const applySavedFilter = (savedFilter: SavedWarehouseFilter) => {
    setDraftFilters(savedFilter.filters);
    setAppliedFilters(savedFilter.filters);
    setCurrentPage(1);
    setIsSaveFilterDrawerOpen(false);
    setIsFilterPanelOpen(false);
  };
  const removeSavedFilter = (filterId: string) => {
    setSavedFilters((current) =>
      current.filter((item) => item.id !== filterId),
    );
  };
  const getWarehouseColumnLabel = (
    columnKey: StockColumnKey | ReceiptsColumnKey,
  ) => {
    switch (columnKey) {
      case 'select':
        return 'Select';
      case 'name':
        return 'Name';
      case 'serial':
        return 'Serial #';
      case 'article':
        return 'Article';
      case 'date':
        return 'Date';
      case 'purchase':
        return 'Purchase';
      case 'warehouse':
        return 'Warehouse';
      case 'location':
        return 'Location';
      case 'clientOrder':
        return 'Client order';
      case 'supplierOrder':
        return 'Supplier order';
      case 'supplier':
        return 'Supplier';
      case 'note':
        return 'Note';
      case 'action':
        return 'Action';
      case 'number':
        return '#';
      case 'product':
        return 'Product';
      case 'quantity':
        return 'Quantity';
      case 'price':
        return 'Price';
      case 'amount':
        return 'Amount';
      case 'paid':
        return 'Paid';
      case 'receiptDate':
        return 'Receipt Date';
      case 'acceptedBy':
        return 'Accepted By';
      case 'approvedBy':
        return 'Approved By';
      case 'status':
        return 'Status';
      case 'payment':
        return 'Payment';
      default:
        return '';
    }
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

  return (
    <section className='panel warehouse-panel'>
      <div
        className='warehouse-tabs'
        role='tablist'
        aria-label='Warehouse sections'
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
            <span>{tab.label}</span>
            {tab.badge ? <strong>{tab.badge}</strong> : null}
          </button>
        ))}
      </div>

      {activeTab !== 'settings' ? (
        <div className='warehouse-toolbar'>
          <button
            type='button'
            className='toolbar-square-button'
            aria-label='Previous page'
            onClick={() => setCurrentPage((current) => current - 1)}
            disabled={currentPage <= 1}
          >
            &lsaquo;
          </button>
          <span className='warehouse-page-number'>{currentPage}</span>
          <button
            type='button'
            className='toolbar-square-button'
            aria-label='Next page'
            onClick={() => setCurrentPage((current) => current + 1)}
            disabled={currentPage >= pageCount}
          >
            &rsaquo;
          </button>
          {activeColumnsTab ? (
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
                  {activeColumnsTab === 'stock'
                    ? availableWarehouseColumns.stock.map(
                        (columnKey) => (
                          <label
                            key={`${activeTab}-${columnKey}`}
                            className='toolbar-settings-option'
                          >
                            <input
                              type='checkbox'
                              checked={visibleColumnKeySet.has(
                                columnKey,
                              )}
                              disabled={lockedWarehouseColumns.stock.includes(
                                columnKey,
                              )}
                              onChange={() =>
                                toggleColumnVisibility(columnKey)
                              }
                            />
                            <span>
                              {getWarehouseColumnLabel(columnKey)}
                            </span>
                          </label>
                        ),
                      )
                    : availableWarehouseColumns.receipts.map(
                        (columnKey) => (
                          <label
                            key={`${activeTab}-${columnKey}`}
                            className='toolbar-settings-option'
                          >
                            <input
                              type='checkbox'
                              checked={visibleColumnKeySet.has(
                                columnKey,
                              )}
                              disabled={lockedWarehouseColumns.receipts.includes(
                                columnKey,
                              )}
                              onChange={() =>
                                toggleColumnVisibility(columnKey)
                              }
                            />
                            <span>
                              {getWarehouseColumnLabel(columnKey)}
                            </span>
                          </label>
                        ),
                      )}
                </div>
              ) : null}
            </div>
          ) : null}
          <button
            type='button'
            className='toolbar-filter-button'
            onClick={() => setIsFilterPanelOpen((current) => !current)}
          >
            Filter
          </button>
          <div className='orders-search-group warehouse-search-group'>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder='Search stock'
            />
            {query ? (
              <span
                role='button'
                tabIndex={0}
                className='warehouse-search-clear'
                aria-label='Clear search text'
                onClick={() => {
                  setQuery('');
                  setCurrentPage(1);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setQuery('');
                    setCurrentPage(1);
                  }
                }}
              >
                x
              </span>
            ) : null}
          </div>
          <div className='warehouse-search-modes'>
            {searchModes.map((mode) => (
              <button
                key={mode.key}
                type='button'
                className={
                  mode.key === searchMode
                    ? 'warehouse-mode-button warehouse-mode-button-active'
                    : 'warehouse-mode-button'
                }
                onClick={() => {
                  setSearchMode(mode.key);
                  setCurrentPage(1);
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {activeTab !== 'settings' ? (
        <section
          className={
            isFilterPanelOpen
              ? 'orders-filter-panel orders-filter-panel-open'
              : 'orders-filter-panel'
          }
        >
          <div className='orders-filter-saved-row'>
            <strong>Saved filters:</strong>
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
                      aria-label={`Delete ${savedFilter.name}`}
                    >
                      x
                    </button>
                  </div>
                ))
              ) : (
                <small>No saved filters for this tab.</small>
              )}
            </div>
            <button
              type='button'
              className='toolbar-square-button'
              aria-label='Save filter'
              onClick={() => setIsSaveFilterDrawerOpen(true)}
            >
              +
            </button>
          </div>
          <div className='orders-filter-grid'>
            <label className='orders-filter-field'>
              <span>By name</span>
              <input
                type='text'
                value={draftFilters.name}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder='Product name'
              />
            </label>
            <label className='orders-filter-field'>
              <span>By serial #</span>
              <input
                type='text'
                value={draftFilters.serial}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    serial: event.target.value,
                  }))
                }
                placeholder='Serial number'
              />
            </label>
            <label className='orders-filter-field'>
              <span>By article</span>
              <input
                type='text'
                value={draftFilters.article}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    article: event.target.value,
                  }))
                }
                placeholder='Article'
              />
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
                  <option key={warehouse.id} value={warehouse.name}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
            <label className='orders-filter-field'>
              <span>Supplier</span>
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
                placeholder='Supplier name'
              />
              <datalist id='warehouse-supplier-options'>
                {supplierOptions.map((supplierName) => (
                  <option key={supplierName} value={supplierName} />
                ))}
              </datalist>
            </label>
            <label className='orders-filter-field'>
              <span>Buyer</span>
              <select
                value={draftFilters.buyer}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    buyer: event.target.value,
                  }))
                }
              >
                <option value=''>All</option>
                {buyerOptions.map((buyer) => (
                  <option key={buyer} value={buyer}>
                    {buyer}
                  </option>
                ))}
              </select>
            </label>
            {activeTab === 'stock' ? (
              <label className='orders-filter-field'>
                <span>Location</span>
                <select
                  value={draftFilters.location}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      location: event.target.value,
                    }))
                  }
                >
                  <option value=''>All</option>
                  {availableLocationOptions.map((location) => (
                    <option key={location.id} value={location.name}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
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
                      onClick={() => removeSavedFilter(savedFilter.id)}
                      aria-label={`Delete ${savedFilter.name}`}
                    >
                      x
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

      {activeTab === 'receipts' ? (
        <div className='warehouse-receipt-header'>
          <p className='panel-subtitle'>
            receipts order creation is in progress, but you can add
            receipt manually by clicking the button below
          </p>
          <button
            type='button'
            className='orders-create-button'
            onClick={() => {
              setEditingSupplierOrder(null);
              setIsSupplierOrderModalOpen(true);
            }}
          >
            receipt order
          </button>
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
              successMessage: 'Administrator access saved.',
            })
          }
          isSaving={isWarehouseSettingsSaving}
        />
      ) : activeTab === 'stock' ? (
        <>
          <StockTable
            products={paginatedProducts}
            isLoading={isLoading}
            visibleColumns={visibleColumns.stock}
            salesByProductId={salesByProductId}
            supplierOrdersByProductId={supplierOrdersByProductId}
            productWarehouseMetaById={productWarehouseMetaById}
            onEdit={onProductEdit}
            onDelete={onProductDelete}
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
        </>
      ) : activeTab === 'receipts' ? (
        <>
          <ReceiptsTable
            receipts={paginatedReceipts}
            visibleColumns={visibleColumns.receipts}
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
                onError('Product not found in Products catalog.');
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
                onError('Supplier not found in Suppliers catalog.');
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
      ) : (
        <p className='empty-state'>
          This warehouse section is ready for the next workflow.
        </p>
      )}
      {serviceCenterModalId ? (
        <ModalShell
          title={
            serviceCenterModalId === 'new'
              ? 'create service center'
              : 'edit service center'
          }
          onClose={() => setServiceCenterModalId(null)}
          onSubmit={saveServiceCenter}
          submitLabel={
            serviceCenterModalId === 'new' ? 'create' : 'save'
          }
          canSubmit={serviceCenterForm.name.trim().length > 1}
        >
          <label className='field'>
            <span>name:</span>
            <input
              value={serviceCenterForm.name}
              onChange={(event) =>
                setServiceCenterForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder='name'
            />
          </label>
          <label className='field'>
            <span>color (#000000):</span>
            <div className='warehouse-settings-color-field'>
              <input
                value={serviceCenterForm.color}
                onChange={(event) =>
                  setServiceCenterForm((current) => ({
                    ...current,
                    color: event.target.value,
                  }))
                }
                placeholder='#000000'
              />
              <input
                type='color'
                aria-label='color'
                value={serviceCenterForm.color}
                onChange={(event) =>
                  setServiceCenterForm((current) => ({
                    ...current,
                    color: event.target.value,
                  }))
                }
              />
            </div>
          </label>
          <label className='field'>
            <span>address:</span>
            <input
              value={serviceCenterForm.address}
              onChange={(event) =>
                setServiceCenterForm((current) => ({
                  ...current,
                  address: event.target.value,
                }))
              }
              placeholder='address'
            />
          </label>
          <label className='field'>
            <span>phone:</span>
            <input
              value={serviceCenterForm.phone}
              onChange={(event) =>
                setServiceCenterForm((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              placeholder='+380'
            />
          </label>
        </ModalShell>
      ) : null}

      {warehouseModalId ? (
        <ModalShell
          title={
            warehouseModalId === 'new'
              ? 'create warehouse'
              : 'edit warehouse'
          }
          onClose={() => setWarehouseModalId(null)}
          onSubmit={saveWarehouse}
          submitLabel={warehouseModalId === 'new' ? 'create' : 'save'}
          canSubmit={
            warehouseForm.name.trim().length > 1 &&
            Boolean(warehouseForm.serviceCenterId) &&
            warehouseForm.locations.some(
              (location) => location.trim().length > 0,
            )
          }
        >
          <label className='field'>
            <span>name:</span>
            <input
              value={warehouseForm.name}
              onChange={(event) =>
                setWarehouseForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder='name'
            />
          </label>
          <label className='create-inline-checkbox'>
            <input
              type='checkbox'
              checked={warehouseForm.isActive}
              onChange={(event) =>
                setWarehouseForm((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
            />
            <span>active</span>
          </label>
          <label className='field'>
            <span>Location to Service Center:</span>
            <select
              value={warehouseForm.serviceCenterId}
              onChange={(event) =>
                setWarehouseForm((current) => ({
                  ...current,
                  serviceCenterId: event.target.value,
                }))
              }
            >
              <option value=''>select service center</option>
              {serviceCenters.map((serviceCenter) => (
                <option
                  key={serviceCenter.id}
                  value={serviceCenter.id}
                >
                  {serviceCenter.name}
                </option>
              ))}
            </select>
          </label>
          <label className='field'>
            <span>address for suppliers:</span>
            <input
              value={warehouseForm.receiptAddress}
              onChange={(event) =>
                setWarehouseForm((current) => ({
                  ...current,
                  receiptAddress: event.target.value,
                }))
              }
            />
          </label>
          <label className='field'>
            <span>phone for suppliers:</span>
            <input
              value={warehouseForm.receiptPhone}
              onChange={(event) =>
                setWarehouseForm((current) => ({
                  ...current,
                  receiptPhone: event.target.value,
                }))
              }
            />
          </label>
          <div className='field'>
            <span>locations:</span>
            <div className='warehouse-settings-locations'>
              {warehouseForm.locations.map((location, index) => (
                <input
                  key={`${warehouseModalId}-location-${index}`}
                  value={location}
                  onChange={(event) => {
                    const nextLocations = [
                      ...warehouseForm.locations,
                    ];
                    nextLocations[index] = event.target.value;
                    setWarehouseForm((current) => ({
                      ...current,
                      locations: nextLocations,
                    }));
                  }}
                  placeholder='enter location name'
                />
              ))}
            </div>
            <button
              type='button'
              className='warehouse-settings-add-location'
              onClick={() =>
                setWarehouseForm((current) => ({
                  ...current,
                  locations: [...current.locations, ''],
                }))
              }
            >
              location
            </button>
          </div>
        </ModalShell>
      ) : null}

      {isReceiptModalOpen ? (
        <ModalShell
          title='create receipt order'
          onClose={() => setIsReceiptModalOpen(false)}
          onSubmit={createReceipt}
          submitLabel={isProductSaving ? '...' : 'create'}
          canSubmit={Boolean(
            receiptForm.supplierId &&
            receiptForm.productName.trim() &&
            Number(receiptForm.quantity) > 0,
          )}
        >
          <div className='warehouse-receipt-modal-grid'>
            <label className='field'>
              <span>Supplier*</span>
              <select
                value={receiptForm.supplierId}
                onChange={(event) =>
                  setReceiptForm((current) => ({
                    ...current,
                    supplierId: event.target.value,
                  }))
                }
              >
                <option value=''>supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>
            <label className='field'>
              <span>Product*</span>
              <input
                value={receiptForm.productName}
                onChange={(event) =>
                  setReceiptForm((current) => ({
                    ...current,
                    productName: event.target.value,
                  }))
                }
                placeholder='enter product name'
              />
            </label>
            <label className='field'>
              <span>Price (UAH)*</span>
              <input
                type='number'
                min='0'
                value={receiptForm.price}
                onChange={(event) =>
                  setReceiptForm((current) => ({
                    ...current,
                    price: event.target.value,
                  }))
                }
              />
            </label>
            <label className='field'>
              <span>Quantity*</span>
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
              <span>Note</span>
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
        suppliers={suppliers}
        editingOrder={editingSupplierOrder}
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
          warehouseId,
          locationId,
        }) => {
          if (!editingSupplierOrder) return;
          const orderId =
            editingSupplierOrderSource?.id ?? editingSupplierOrder.id;
          await takeOnChargeSupplierOrder(orderId, {
            autoGenerateSerialNumbers,
            serialNumbers,
            warehouseId,
            locationId,
          });
          onSuccess('Order taken on charge.');
          window.dispatchEvent(new Event('project-goods:finance-updated'));
          window.dispatchEvent(new Event('project-goods:products-updated'));
          await refreshSupplierOrders();
        }}
        onCancelOrder={async () => {
          if (!editingSupplierOrder) return;
          const orderId =
            editingSupplierOrderSource?.id ?? editingSupplierOrder.id;
          await cancelSupplierOrder(orderId);
          onSuccess('Order cancelled.');
          await refreshSupplierOrders();
        }}
        onSubmit={async (
          payload: SupplierOrderModalSubmitPayload,
        ) => {
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
              createdBy: currentEmployeeName || 'Administrator',
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
              await updateSupplierOrder(orderSource.id, {
                ...supplierOrderPayload,
                number: orderSource.number,
                orderBaseId: orderSource.orderBaseId,
                items: mergedItems,
              });
              onSuccess('Receipt order updated.');
            } else {
              await createSupplierOrder({
                ...supplierOrderPayload,
                orderBaseId: `SO-${Date.now()}`,
              });
              onSuccess(
                'Receipt order created and added to warehouse receipts.',
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
                : 'Failed to create receipt order.',
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
                <h2>Supplier</h2>
              </div>
              <button
                type='button'
                className='create-order-close'
                onClick={() => setSelectedSupplierForEdit(null)}
                aria-label='Close'
              >
                &times;
              </button>
            </header>
            <div className='catalog-edit-body'>
              <label className='field'>
                <span>Name</span>
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
                <span>Phone</span>
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
                <span>Note</span>
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
                  onSuccess('Supplier updated.');
                  await refreshSupplierOrders();
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
                <h2>Product</h2>
              </div>
              <button
                type='button'
                className='create-order-close'
                onClick={() => setSelectedCatalogProductForEdit(null)}
                aria-label='Close'
              >
                &times;
              </button>
            </header>
            <div className='catalog-edit-body'>
              <label className='field'>
                <span>Product name</span>
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
                <span>Note</span>
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
                  onSuccess('Product updated.');
                  await refreshSupplierOrders();
                  setSelectedCatalogProductForEdit(null);
                }}
              >
                {isProductSavingInline ? 'Saving...' : 'Save'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
};

const ReceiptsTable = ({
  receipts,
  visibleColumns,
  onOpenOrder,
  onOpenProduct,
  onOpenSupplier,
}: {
  receipts: ReceiptRow[];
  visibleColumns: ReceiptsColumnKey[];
  onOpenOrder: (receipt: ReceiptRow) => void;
  onOpenProduct: (receipt: ReceiptRow) => void;
  onOpenSupplier: (receipt: ReceiptRow) => void;
}) => {
  if (receipts.length === 0)
    return <p className='empty-state'>No receipt orders created.</p>;
  return (
    <div className='catalog-table-wrap'>
      <table className='catalog-table warehouse-receipts-table'>
        <thead>
          <tr>
            {visibleColumns.map((columnKey) => (
              <th key={columnKey}>
                {columnKey === 'number'
                  ? '#'
                  : columnKey === 'product'
                    ? 'Product'
                    : columnKey === 'quantity'
                      ? 'Quantity'
                      : columnKey === 'price'
                        ? 'Price'
                        : columnKey === 'amount'
                          ? 'Amount'
                          : columnKey === 'paid'
                            ? 'Paid'
                            : columnKey === 'supplier'
                              ? 'Supplier'
                              : columnKey === 'receiptDate'
                                ? 'Receipt Date'
                                : columnKey === 'acceptedBy'
                                  ? 'Accepted By'
                                  : columnKey === 'approvedBy'
                                    ? 'Approved By'
                                    : columnKey === 'status'
                                      ? 'Status'
                                      : 'Payment'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {receipts.map((receipt) => (
            <tr key={receipt.id}>
              {visibleColumns.map((columnKey) => (
                <td key={`${receipt.id}-${columnKey}`}>
                  {columnKey === 'number' ? (
                    <button type='button' className='catalog-name-button' onClick={() => onOpenOrder(receipt)}>
                      {receipt.number}
                    </button>
                  ) : columnKey === 'product' ? (
                    <button type='button' className='catalog-name-button' onClick={() => onOpenProduct(receipt)}>
                      {receipt.productName}
                    </button>
                  ) : columnKey === 'quantity' ? (
                    `${receipt.quantity} pcs`
                  ) : columnKey === 'price' ? (
                    formatCurrency(receipt.price)
                  ) : columnKey === 'amount' ? (
                    formatCurrency(receipt.amount)
                  ) : columnKey === 'paid' ? (
                    formatCurrency(receipt.paid)
                  ) : columnKey === 'supplier' ? (
                    <button type='button' className='catalog-name-button' onClick={() => onOpenSupplier(receipt)}>
                      {receipt.supplierName}
                    </button>
                  ) : columnKey === 'receiptDate' ? (
                    formatDate(receipt.createdAt)
                  ) : columnKey === 'acceptedBy' ? (
                    <button type='button' className='catalog-name-button' onClick={() => onOpenOrder(receipt)}>
                      {receipt.acceptedBy}
                    </button>
                  ) : columnKey === 'approvedBy' ? (
                    <button type='button' className='catalog-name-button' onClick={() => onOpenOrder(receipt)}>
                      {receipt.approvedBy}
                    </button>
                  ) : columnKey === 'status' ? (
                    <span
                      className={
                        receipt.status === 'cancelled'
                          ? 'receipt-status receipt-status-cancelled'
                          : receipt.status === 'received'
                            ? 'receipt-status receipt-status-received'
                            : receipt.status === 'new'
                              ? 'receipt-status receipt-status-new'
                              : 'receipt-status receipt-status-approved'
                      }
                    >
                      {receipt.status === 'cancelled'
                        ? 'Cancelled'
                        : receipt.status === 'received'
                          ? 'Taken on charge'
                          : receipt.status === 'new'
                            ? 'New'
                            : 'Approved'}
                    </span>
                  ) : receipt.status === 'new' ? (
                    '-'
                  ) : (
                    receipt.paymentStatus ?? '-'
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
const WarehouseSettings = ({
  tab,
  onTabChange,
  employees,
  serviceCenters,
  warehouses,
  administrators,
  warehousesByServiceCenter,
  onCreateServiceCenter,
  onEditServiceCenter,
  onCreateWarehouse,
  onEditWarehouse,
  onAdministratorChange,
  onSaveAdministrators,
  isSaving,
}: {
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  employees: Employee[];
  serviceCenters: ServiceCenter[];
  warehouses: WarehouseItem[];
  administrators: Administrator[];
  warehousesByServiceCenter: Record<string, number>;
  onCreateServiceCenter: () => void;
  onEditServiceCenter: (serviceCenter: ServiceCenter) => void;
  onCreateWarehouse: () => void;
  onEditWarehouse: (warehouse: WarehouseItem) => void;
  onAdministratorChange: (
    updater:
      | Administrator[]
      | ((current: Administrator[]) => Administrator[]),
  ) => void;
  onSaveAdministrators: () => void;
  isSaving: boolean;
}) => {
  const serviceCenterMap = useMemo(
    () =>
      serviceCenters.reduce<Record<string, ServiceCenter>>(
        (acc, x) => {
          acc[x.id] = x;
          return acc;
        },
        {},
      ),
    [serviceCenters],
  );
  const warehouseMap = useMemo(
    () =>
      warehouses.reduce<Record<string, WarehouseItem>>((acc, x) => {
        acc[x.id] = x;
        return acc;
      }, {}),
    [warehouses],
  );
  const [adminWarehouseSearch, setAdminWarehouseSearch] = useState<
    Record<string, string>
  >({});

  const buildDefaultForWarehouses = (warehouseIds: string[]) => {
    const firstWarehouseId = warehouseIds[0];
    if (!firstWarehouseId)
      return { defaultWarehouseId: '', defaultLocationId: '' };
    const firstLocationId =
      warehouseMap[firstWarehouseId]?.locations[0]?.id ?? '';
    return {
      defaultWarehouseId: firstWarehouseId,
      defaultLocationId: firstLocationId,
    };
  };

  const ensureAdminDefaults = (
    administrator: Administrator,
    warehouseIds: string[],
  ) => {
    const hasDefaultWarehouse = warehouseIds.includes(
      administrator.defaultWarehouseId,
    );
    const hasDefaultLocation =
      warehouseMap[administrator.defaultWarehouseId]?.locations.some(
        (location) => location.id === administrator.defaultLocationId,
      ) ?? false;
    if (hasDefaultWarehouse && hasDefaultLocation)
      return administrator;
    return {
      ...administrator,
      ...buildDefaultForWarehouses(warehouseIds),
    };
  };

  return (
    <div className='warehouse-settings-panel'>
      <div
        className='warehouse-settings-tabs'
        role='tablist'
        aria-label='Warehouse settings sections'
      >
        {settingsTabs.map((settingsTab) => (
          <button
            key={settingsTab.key}
            type='button'
            className={
              settingsTab.key === tab
                ? 'warehouse-settings-tab warehouse-settings-tab-active'
                : 'warehouse-settings-tab'
            }
            onClick={() => onTabChange(settingsTab.key)}
          >
            {settingsTab.label}
          </button>
        ))}
      </div>

      {tab === 'service-centers' ? (
        <>
          <div className='warehouse-settings-actions'>
            <button
              type='button'
              className='orders-create-button'
              onClick={onCreateServiceCenter}
            >
              Create
            </button>
          </div>
          <div className='catalog-table-wrap'>
            <table className='catalog-table warehouse-settings-table'>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>color</th>
                  <th>Address</th>
                  <th>Phone</th>
                  <th>Number of Warehouses</th>
                </tr>
              </thead>
              <tbody>
                {serviceCenters.map((serviceCenter) => (
                  <tr key={serviceCenter.id}>
                    <td>
                      <button
                        type='button'
                        className='settings-link-button'
                        onClick={() =>
                          onEditServiceCenter(serviceCenter)
                        }
                      >
                        {serviceCenter.name}
                      </button>
                    </td>
                    <td>
                      <button
                        type='button'
                        className='settings-color-dot'
                        style={{
                          backgroundColor: serviceCenter.color,
                        }}
                        onClick={() =>
                          onEditServiceCenter(serviceCenter)
                        }
                        aria-label={`Edit ${serviceCenter.name}`}
                      />
                    </td>
                    <td>
                      <button
                        type='button'
                        className='settings-link-button'
                        onClick={() =>
                          onEditServiceCenter(serviceCenter)
                        }
                      >
                        {serviceCenter.address}
                      </button>
                    </td>
                    <td>
                      <button
                        type='button'
                        className='settings-link-button'
                        onClick={() =>
                          onEditServiceCenter(serviceCenter)
                        }
                      >
                        {serviceCenter.phone}
                      </button>
                    </td>
                    <td>
                      {warehousesByServiceCenter[serviceCenter.id] ??
                        0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {tab === 'warehouses' ? (
        <>
          <div className='warehouse-settings-actions'>
            <button
              type='button'
              className='orders-create-button'
              onClick={onCreateWarehouse}
            >
              Create Warehouse
            </button>
          </div>
          <div className='catalog-table-wrap'>
            <table className='catalog-table warehouse-settings-table'>
              <thead>
                <tr>
                  <th>Id</th>
                  <th>Name</th>
                  <th>Location</th>
                  <th>Address</th>
                  <th>Phone</th>
                  <th>Locations</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.map((warehouse) => {
                  const center =
                    serviceCenterMap[warehouse.serviceCenterId];
                  return (
                    <tr key={warehouse.id}>
                      <td>{warehouse.id.replace('w-', '')}</td>
                      <td>
                        <button
                          type='button'
                          className='settings-link-button'
                          onClick={() => onEditWarehouse(warehouse)}
                        >
                          {warehouse.name}
                        </button>
                      </td>
                      <td>
                        <span className='warehouse-settings-center-chip'>
                          <i
                            style={{
                              color: center?.color ?? '#94a3b8',
                            }}
                          >
                            &bull;
                          </i>{' '}
                          {center?.name ?? '-'}
                        </span>
                      </td>
                      <td>{warehouse.receiptAddress || '-'}</td>
                      <td>{warehouse.receiptPhone || '-'}</td>
                      <td>{warehouse.locations.length} pcs</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {tab === 'administrators' ? (
        <>
          <div className='catalog-table-wrap warehouse-admin-table-wrap'>
            <table className='catalog-table warehouse-settings-table warehouse-admin-table'>
              <thead>
                <tr>
                  <th>Administrator</th>
                  <th>
                    View Warehouses, to which the administrator has
                    access
                  </th>
                  <th>
                    View Warehouse and Location, to which the
                    administrator has access
                  </th>
                </tr>
              </thead>
              <tbody>
                {administrators.map((administrator) => {
                  const employee = employees.find(
                    (item) => item.id === administrator.employeeId,
                  );
                  if (!employee) return null;
                  const availableLocations =
                    administrator.warehouseIds.flatMap(
                      (warehouseId) => {
                        const warehouse = warehouseMap[warehouseId];
                        if (!warehouse) return [];
                        return warehouse.locations.map(
                          (location) => ({
                            warehouseId: warehouse.id,
                            locationId: location.id,
                            label: `${warehouse.name} ${location.name}`,
                          }),
                        );
                      },
                    );
                  const selectedWarehouseNames =
                    administrator.warehouseIds
                      .map(
                        (warehouseId) =>
                          warehouseMap[warehouseId]?.name,
                      )
                      .filter(Boolean);
                  const isAllSelected =
                    administrator.warehouseIds.length > 0 &&
                    administrator.warehouseIds.length ===
                      warehouses.length;
                  const warehouseSearch =
                    adminWarehouseSearch[administrator.employeeId] ??
                    '';
                  const filteredWarehouses = warehouses.filter(
                    (warehouse) =>
                      warehouse.name
                        .toLowerCase()
                        .includes(
                          warehouseSearch.trim().toLowerCase(),
                        ),
                  );
                  const defaultValue = `${administrator.defaultWarehouseId}:${administrator.defaultLocationId}`;
                  return (
                    <tr key={administrator.employeeId}>
                      <td>{employee.name}</td>
                      <td>
                        <details className='warehouse-admin-multiselect'>
                          <summary>
                            {isAllSelected
                              ? `All (${administrator.warehouseIds.length})`
                              : selectedWarehouseNames.join(', ') ||
                                'Select Warehouses'}
                          </summary>
                          <div className='warehouse-admin-multiselect-menu'>
                            <input
                              value={warehouseSearch}
                              onChange={(event) =>
                                setAdminWarehouseSearch(
                                  (current) => ({
                                    ...current,
                                    [administrator.employeeId]:
                                      event.target.value,
                                  }),
                                )
                              }
                              placeholder='Search'
                            />
                            <label className='warehouse-admin-checkline'>
                              <input
                                type='checkbox'
                                checked={isAllSelected}
                                onChange={(event) => {
                                  const nextWarehouseIds = event
                                    .target.checked
                                    ? warehouses.map(
                                        (warehouse) => warehouse.id,
                                      )
                                    : [];
                                  onAdministratorChange((current) =>
                                    current.map((item) =>
                                      item.employeeId ===
                                      administrator.employeeId
                                        ? ensureAdminDefaults(
                                            {
                                              ...item,
                                              warehouseIds:
                                                nextWarehouseIds,
                                            },
                                            nextWarehouseIds,
                                          )
                                        : item,
                                    ),
                                  );
                                }}
                              />
                              <span>Select All</span>
                            </label>
                            <div className='warehouse-admin-options'>
                              {filteredWarehouses.map((warehouse) => (
                                <label
                                  key={warehouse.id}
                                  className='warehouse-admin-checkline'
                                >
                                  <input
                                    type='checkbox'
                                    checked={administrator.warehouseIds.includes(
                                      warehouse.id,
                                    )}
                                    onChange={(event) => {
                                      const nextWarehouseIds = event
                                        .target.checked
                                        ? [
                                            ...administrator.warehouseIds,
                                            warehouse.id,
                                          ]
                                        : administrator.warehouseIds.filter(
                                            (warehouseId) =>
                                              warehouseId !==
                                              warehouse.id,
                                          );
                                      onAdministratorChange(
                                        (current) =>
                                          current.map((item) =>
                                            item.employeeId ===
                                            administrator.employeeId
                                              ? ensureAdminDefaults(
                                                  {
                                                    ...item,
                                                    warehouseIds:
                                                      nextWarehouseIds,
                                                  },
                                                  nextWarehouseIds,
                                                )
                                              : item,
                                          ),
                                      );
                                    }}
                                  />
                                  <span>{warehouse.name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </details>
                      </td>
                      <td>
                        <select
                          className='warehouse-admin-default-select'
                          value={defaultValue}
                          onChange={(event) => {
                            const [
                              defaultWarehouseId,
                              defaultLocationId,
                            ] = event.target.value.split(':');
                            onAdministratorChange((current) =>
                              current.map((item) =>
                                item.employeeId ===
                                administrator.employeeId
                                  ? {
                                      ...item,
                                      defaultWarehouseId,
                                      defaultLocationId,
                                    }
                                  : item,
                              ),
                            );
                          }}
                        >
                          {availableLocations.length === 0 ? (
                            <option value=''>Select Location</option>
                          ) : null}
                          {availableLocations.map((location) => (
                            <option
                              key={`${location.warehouseId}:${location.locationId}`}
                              value={`${location.warehouseId}:${location.locationId}`}
                            >
                              {location.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            type='button'
            className='secondary-button'
            onClick={onSaveAdministrators}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </>
      ) : null}
    </div>
  );
};

const ModalShell = ({
  title,
  children,
  onClose,
  onSubmit,
  submitLabel,
  canSubmit,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  canSubmit: boolean;
}) => (
  <div className='modal-backdrop' role='dialog' aria-modal='true'>
    <div className='catalog-edit-modal warehouse-settings-modal'>
      <header className='catalog-edit-header'>
        <h2>{title}</h2>
        <button
          type='button'
          className='ghost-button'
          onClick={onClose}
        >
          &times;
        </button>
      </header>
      <div className='catalog-edit-body warehouse-settings-modal-body'>
        {children}
      </div>
      <footer className='catalog-edit-footer warehouse-settings-modal-footer'>
        <button
          type='button'
          className='secondary-button'
          onClick={onClose}
        >
          cancel
        </button>
        <button
          type='button'
          className='primary-button'
          onClick={onSubmit}
          disabled={!canSubmit}
        >
          {submitLabel}
        </button>
      </footer>
    </div>
  </div>
);

const StockTable = ({
  products,
  isLoading,
  visibleColumns,
  salesByProductId,
  supplierOrdersByProductId,
  productWarehouseMetaById,
  onEdit,
  onDelete,
  onOpenSupplierOrder,
}: {
  products: Product[];
  isLoading: boolean;
  visibleColumns: StockColumnKey[];
  salesByProductId: Record<string, Sale[]>;
  supplierOrdersByProductId: Record<string, SupplierOrderLink[]>;
  productWarehouseMetaById: Record<string, ProductWarehouseMeta>;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onOpenSupplierOrder: (
    supplierOrderId: string,
    itemIndex: number,
  ) => void;
}) => {
  if (isLoading)
    return <p className='empty-state'>Loading warehouse stock...</p>;
  if (products.length === 0)
    return <p className='empty-state'>No stock rows found.</p>;
  return (
    <div className='catalog-table-wrap'>
      <table className='catalog-table warehouse-stock-table'>
        <thead>
          <tr>
            {visibleColumns.map((columnKey) => (
              <th key={columnKey}>
                {columnKey === 'select' ? (
                  <input
                    type='checkbox'
                    aria-label='Select all stock rows'
                  />
                ) : columnKey === 'name' ? (
                  'Name'
                ) : columnKey === 'serial' ? (
                  'Serial #'
                ) : columnKey === 'article' ? (
                  'Article'
                ) : columnKey === 'date' ? (
                  'Date'
                ) : columnKey === 'purchase' ? (
                  'Purchase'
                ) : columnKey === 'warehouse' ? (
                  'Warehouse'
                ) : columnKey === 'location' ? (
                  'Location'
                ) : columnKey === 'clientOrder' ? (
                  'Client order'
                ) : columnKey === 'supplierOrder' ? (
                  'Supplier order'
                ) : columnKey === 'supplier' ? (
                  'Supplier'
                ) : columnKey === 'note' ? (
                  'Note'
                ) : (
                  'Action'
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              {(() => {
                const linkedSales = salesByProductId[product.id] ?? [];
                const linkedSupplierOrders =
                  supplierOrdersByProductId[product.id] ?? [];
                const getOrderHref = (
                  sale: Sale,
                  tab: 'orders' | 'sales',
                ) => {
                  const url = new URL(window.location.href);
                  url.searchParams.set('page', 'orders');
                  url.searchParams.set('ordersTab', tab);
                  url.searchParams.set('saleId', sale.id);
                  url.searchParams.delete('createOrder');
                  return `${url.pathname}${url.search}${url.hash}`;
                };

                return (
                  <>
                    {visibleColumns.map((columnKey) => (
                      <td key={`${product.id}-${columnKey}`} className={columnKey === 'name' ? 'catalog-name-cell' : undefined}>
                        {columnKey === 'select' ? (
                          <input
                            type='checkbox'
                            aria-label={`Select ${product.name}`}
                          />
                        ) : columnKey === 'name' ? (
                          product.name
                        ) : columnKey === 'serial' ? (
                          product.serialNumber
                        ) : columnKey === 'article' ? (
                          product.article
                        ) : columnKey === 'date' ? (
                          formatDate(product.purchaseDate)
                        ) : columnKey === 'purchase' ? (
                          product.price
                        ) : columnKey === 'warehouse' ? (
                          productWarehouseMetaById[product.id]
                            ?.warehouseName ?? '-'
                        ) : columnKey === 'location' ? (
                          productWarehouseMetaById[product.id]
                            ?.locationName ?? '-'
                        ) : columnKey === 'clientOrder' ? (
                          linkedSales.length === 0
                            ? '-'
                            : linkedSales.map((sale, index) => (
                                <span key={`${product.id}-sale-${sale.id}`}>
                                  {index > 0 ? ', ' : null}
                                  <a
                                    className='settings-link-button'
                                    href={getOrderHref(
                                      sale,
                                      sale.kind === 'sale'
                                        ? 'sales'
                                        : 'orders',
                                    )}
                                  >
                                    {sale.recordNumber ||
                                      sale.id.slice(0, 8)}
                                  </a>
                                </span>
                              ))
                        ) : columnKey === 'supplierOrder' ? (
                          linkedSupplierOrders.length === 0
                            ? '-'
                            : linkedSupplierOrders.map(
                                (order, index) => (
                                  <span
                                    key={`${product.id}-supplier-${order.order.id}-${order.itemIndex}`}
                                  >
                                    {index > 0 ? ', ' : null}
                                    <button
                                      type='button'
                                      className='settings-link-button'
                                      onClick={() =>
                                        onOpenSupplierOrder(
                                          order.order.id,
                                          order.itemIndex,
                                        )
                                      }
                                    >
                                      {order.displayNumber}
                                    </button>
                                  </span>
                                ),
                              )
                        ) : columnKey === 'supplier' ? (
                          linkedSupplierOrders[0]?.order.supplierName ||
                          product.purchasePlace ||
                          '-'
                        ) : columnKey === 'note' ? (
                          product.note || '-'
                        ) : (
                          <div className='catalog-row-actions'>
                            <button
                              type='button'
                              className='ghost-button'
                              onClick={() => onEdit(product)}
                            >
                              Edit
                            </button>
                            <button
                              type='button'
                              className='danger-button'
                              onClick={() => onDelete(product)}
                            >
                              &times;
                            </button>
                          </div>
                        )}
                      </td>
                    ))}
                  </>
                );
              })()}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
