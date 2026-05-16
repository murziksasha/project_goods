import { useEffect, useMemo, useState } from 'react';
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

type WarehouseTab = 'stock' | 'receipts' | 'transfers' | 'settings';
type WarehouseSearchMode = 'serial' | 'name' | 'warehouse';
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
type ReceiptStatus = 'new' | 'approved' | 'received';
type ReceiptRow = {
  id: string;
  number: string;
  supplierOrderId?: string;
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

type WarehousePanelProps = {
  products: Product[];
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
  { key: 'warehouse', label: 'By warehouse' },
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

const getSearchText = (
  product: Product,
  mode: WarehouseSearchMode,
) =>
  mode === 'serial'
    ? product.serialNumber
    : mode === 'warehouse'
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

export const WarehousePanel = ({
  products,
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
          parsed.searchMode === 'warehouse'
          ? parsed.searchMode
          : 'serial';
      } catch {
        return 'serial';
      }
    },
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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
  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>(
    [],
  );
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
  const [receiptHistory, setReceiptHistory] = useState<ReceiptRow[]>(
    () =>
      products.slice(0, 8).map((product, index) => ({
        id: `r-${product.id}`,
        number: `R-${23000 + index}`,
        productName: product.name,
        quantity: product.quantity,
        price: product.price,
        amount: product.price * product.quantity,
        paid: product.price * product.quantity,
        supplierName: product.purchasePlace || 'Supplier',
        createdAt: product.createdAt,
        acceptedBy: 'Administrator',
        approvedBy: 'Administrator',
        acceptedAt: product.purchaseDate || product.createdAt,
        status: product.freeQuantity > 0 ? 'received' : 'approved',
        paymentStatus: 'pending',
        note: product.note || '',
      })),
  );

  const buildReceiptRows = (orders: SupplierOrder[]): ReceiptRow[] => {
    const orderedByCreatedAt = [...orders].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const orderBaseNumberById = orderedByCreatedAt.reduce<
      Record<string, number>
    >((acc, order, index) => {
      acc[order.id] = index + 1;
      return acc;
    }, {});

    return orders.flatMap((order) =>
      order.items.map((item, itemPosition) => ({
        id: `${order.id}-${item.itemIndex}`,
        supplierOrderId: order.id,
        number: `${orderBaseNumberById[order.id] ?? 1}-${itemPosition + 1}`,
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
        status: order.receiptStatus,
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

  useEffect(() => {
    void refreshSupplierOrders().catch(() => undefined);
  }, []);
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
  const filteredProducts = useMemo(() => {
    const stockProducts = products.filter(
      (product) => product.quantity > 0,
    );
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return stockProducts;
    return stockProducts.filter((product) =>
      getSearchText(product, searchMode)
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [products, query, searchMode]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [currentPage, filteredProducts, pageSize]);
  const filteredReceipts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return receiptHistory;
    return receiptHistory.filter((receipt) =>
      [
        String(receipt.number),
        receipt.productName,
        receipt.supplierName,
        receipt.status,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query, receiptHistory]);
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
    if (serviceCenterModalId === 'new') {
      setServiceCenters((current) => [
        ...current,
        {
          id: `sc-${Date.now()}`,
          name: normalizedName,
          color: serviceCenterForm.color,
          address: serviceCenterForm.address.trim(),
          phone: serviceCenterForm.phone.trim(),
        },
      ]);
    } else {
      setServiceCenters((current) =>
        current.map((x) =>
          x.id === serviceCenterModalId
            ? {
                ...x,
                name: normalizedName,
                color: serviceCenterForm.color,
                address: serviceCenterForm.address.trim(),
                phone: serviceCenterForm.phone.trim(),
              }
            : x,
        ),
      );
    }
    setServiceCenterModalId(null);
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
    if (warehouseModalId === 'new') {
      setWarehouses((current) => [
        ...current,
        {
          id: `w-${Date.now()}`,
          name: normalizedName,
          isActive: warehouseForm.isActive,
          serviceCenterId: warehouseForm.serviceCenterId,
          receiptAddress: warehouseForm.receiptAddress.trim(),
          receiptPhone: warehouseForm.receiptPhone.trim(),
          locations,
        },
      ]);
    } else {
      setWarehouses((current) =>
        current.map((x) =>
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
        ),
      );
    }
    setWarehouseModalId(null);
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
        id: `r-${Date.now()}`,
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
    onProductChange(
      'article',
      `WM-${Date.now().toString().slice(-4)}`,
    );
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
          >
            &lsaquo;
          </button>
          <span className='warehouse-page-number'>1</span>
          <button
            type='button'
            className='toolbar-square-button'
            aria-label='Next page'
          >
            &rsaquo;
          </button>
          <button type='button' className='toolbar-filter-button'>
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
            <button type='button'>Find</button>
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
        />
      ) : activeTab === 'stock' ? (
        <>
          <StockTable
            products={paginatedProducts}
            isLoading={isLoading}
            onEdit={onProductEdit}
            onDelete={onProductDelete}
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
            onOpenOrder={(receipt) => {
              if (!receipt.supplierOrderId) return;
              const matchedOrder = supplierOrders.find(
                (order) => order.id === receipt.supplierOrderId,
              );
              if (!matchedOrder) return;
              setEditingSupplierOrder(matchedOrder);
              setIsSupplierOrderModalOpen(true);
            }}
            onOpenProduct={(receipt) => {
              const matchedProduct = catalogProducts.find(
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
        }}
        onCreateSupplier={onCreateSupplier}
        onSuccess={onSuccess}
        onError={onError}
        onSubmit={async (
          payload: SupplierOrderModalSubmitPayload,
        ) => {
          try {
            const supplierOrderPayload: SupplierOrderFormValues = {
              supplierId: payload.supplierId,
              deliveryDate: payload.deliveryDate,
              supplyType: payload.supplyType,
              number: payload.number,
              note: payload.note,
              createdBy: currentEmployeeName || 'Administrator',
              status: editingSupplierOrder
                ? editingSupplierOrder.status
                : 'stocked',
              paymentStatus: editingSupplierOrder?.paymentStatus,
              items: payload.items,
            };
            if (editingSupplierOrder) {
              await updateSupplierOrder(editingSupplierOrder.id, {
                ...supplierOrderPayload,
                orderBaseId: editingSupplierOrder.orderBaseId,
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
            await refreshSupplierOrders();
          } catch (error) {
            onError(
              error instanceof Error
                ? error.message
                : 'Failed to create receipt order.',
            );
          }
        }}
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
                  setIsProductSavingInline(true);
                  const ok = await onUpdateCatalogProduct(
                    selectedCatalogProductForEdit.id,
                    {
                      name: productEditForm.name.trim(),
                      note: productEditForm.note.trim(),
                      isActive: productEditForm.isActive,
                    },
                  );
                  setIsProductSavingInline(false);
                  if (!ok) return;
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
  onOpenOrder,
  onOpenProduct,
  onOpenSupplier,
}: {
  receipts: ReceiptRow[];
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
            <th>#</th>
            <th>Product</th>
            <th>Quantity</th>
            <th>Price</th>
            <th>Amount</th>
            <th>Paid</th>
            <th>Supplier</th>
            <th>Receipt Date</th>
            <th>Accepted By</th>
            <th>Approved By</th>
            <th>Status</th>
            <th>Payment</th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((receipt) => (
            <tr key={receipt.id}>
              <td>
                <button type='button' className='catalog-name-button' onClick={() => onOpenOrder(receipt)}>
                  {receipt.number}
                </button>
              </td>
              <td>
                <button type='button' className='catalog-name-button' onClick={() => onOpenProduct(receipt)}>
                  {receipt.productName}
                </button>
              </td>
              <td>{receipt.quantity} pcs</td>
              <td>{formatCurrency(receipt.price)}</td>
              <td>{formatCurrency(receipt.amount)}</td>
              <td>{formatCurrency(receipt.paid)}</td>
              <td>
                <button type='button' className='catalog-name-button' onClick={() => onOpenSupplier(receipt)}>
                  {receipt.supplierName}
                </button>
              </td>
              <td>{formatDate(receipt.createdAt)}</td>
              <td>
                <button type='button' className='catalog-name-button' onClick={() => onOpenOrder(receipt)}>
                  {receipt.acceptedBy}
                </button>
              </td>
              <td>
                <button type='button' className='catalog-name-button' onClick={() => onOpenOrder(receipt)}>
                  {receipt.approvedBy}
                </button>
              </td>
              <td>
                <span
                  className={
                    receipt.status === 'received'
                      ? 'receipt-status receipt-status-received'
                      : receipt.status === 'new'
                        ? 'receipt-status receipt-status-new'
                        : 'receipt-status receipt-status-approved'
                  }
                >
                  {receipt.status === 'received'
                    ? 'Received'
                    : receipt.status === 'new'
                      ? 'New'
                      : 'Approved'}
                </span>
              </td>
              <td>{receipt.status === 'new' ? '-' : receipt.paymentStatus ?? '-'}</td>
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
                      <td>{warehouse.locations.length} С€С‚.</td>
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
          <button type='button' className='secondary-button'>
            Save Changes
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
  onEdit,
  onDelete,
}: {
  products: Product[];
  isLoading: boolean;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
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
            <th>
              <input
                type='checkbox'
                aria-label='Select all stock rows'
              />
            </th>
            <th>Name</th>
            <th>Serial #</th>
            <th>Article</th>
            <th>Date</th>
            <th>Qty</th>
            <th>Retail</th>
            <th>Purchase</th>
            <th>Warehouse</th>
            <th>Location</th>
            <th>Client order</th>
            <th>Supplier order</th>
            <th>Supplier</th>
            <th>Note</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>
                <input
                  type='checkbox'
                  aria-label={`Select ${product.name}`}
                />
              </td>
              <td className='catalog-name-cell'>{product.name}</td>
              <td>{product.serialNumber}</td>
              <td>{product.article}</td>
              <td>{formatDate(product.purchaseDate)}</td>
              <td>{product.quantity} pcs</td>
              <td>{product.salePriceOptions[0] ?? product.price}</td>
              <td>{product.price}</td>
              <td>{product.purchasePlace || 'Main warehouse'}</td>
              <td>{product.freeQuantity > 0 ? 'A' : '-'}</td>
              <td>-</td>
              <td>-</td>
              <td>{product.purchasePlace || '-'}</td>
              <td>{product.note || '-'}</td>
              <td>
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
