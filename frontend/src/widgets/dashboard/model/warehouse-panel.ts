import type { TFunction } from 'i18next';
import type { CSSProperties } from 'react';
import i18n from '../../../shared/i18n/config';
import type { Employee } from '../../../entities/employee/model/types';
import type {
  Product,
  ProductFormValues,
  ProductModelUpdatePayload,
} from '../../../entities/product/model/types';
import type {
  CatalogProduct,
  CatalogProductFormValues,
} from '../../../entities/catalog-product/model/types';
import type {
  Supplier,
  SupplierFormValues,
} from '../../../entities/supplier/model/types';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import type {
  StockSupplierOrderLink,
  StockWarehouseMeta,
} from './stock-balance';

export type WarehouseTab =
  | 'stock'
  | 'receipts'
  | 'transfers'
  | 'information'
  | 'settings';
export type WarehouseColumnsTab = 'stock' | 'receipts';
export type StockColumnKey =
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
export type ReceiptsColumnKey =
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
export type WarehouseColumnVisibility = {
  stock: StockColumnKey[];
  receipts: ReceiptsColumnKey[];
};
export type WarehouseSearchMode =
  | 'serial'
  | 'name'
  | 'article'
  | 'warehouse'
  | 'supplier';
export type WarehouseFilters = {
  name: string;
  serial: string;
  article: string;
  warehouse: string;
  supplier: string;
  buyer: string;
  location: string;
  favoritesOnly: boolean;
};
export type SavedWarehouseFilter = {
  id: string;
  employeeName: string;
  name: string;
  icon: string;
  tab: WarehouseTab;
  filters: WarehouseFilters;
  createdAt: string;
};
export type SettingsTab =
  | 'service-centers'
  | 'warehouses'
  | 'administrators';

export type ServiceCenter = {
  id: string;
  name: string;
  color: string;
  address: string;
  phone: string;
};
export type WarehouseLocation = { id: string; name: string };
export type ReceiptStatus = 'new' | 'approved' | 'received' | 'cancelled';
export type ReceiptRow = {
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
  paymentStatus?: 'pending' | 'paid' | 'without_payment' | 'cancelled';
  supplierOrderIsFavorite?: boolean;
  note: string;
};

export type SupplierOrderLink = {
  order: SupplierOrder;
  itemIndex: number;
  displayNumber: string;
} & StockSupplierOrderLink<SupplierOrder>;
export type WarehouseItem = {
  id: string;
  name: string;
  isActive: boolean;
  serviceCenterId: string;
  receiptAddress: string;
  receiptPhone: string;
  locations: WarehouseLocation[];
};
export type Administrator = {
  employeeId: string;
  warehouseIds: string[];
  defaultWarehouseId: string;
  defaultLocationId: string;
};
export type ServiceCenterFormState = {
  name: string;
  color: string;
  address: string;
  phone: string;
};
export type WarehouseFormState = {
  name: string;
  isActive: boolean;
  serviceCenterId: string;
  receiptAddress: string;
  receiptPhone: string;
  locations: WarehouseLocation[];
};
export type ProductWarehouseMeta = StockWarehouseMeta;
export type TransferFormState = {
  productId: string;
  toWarehouseId: string;
  toLocationId: string;
  note: string;
};
export type TransferHistoryRow = {
  id: string;
  productName: string;
  serialNumber: string;
  fromWarehouseName: string;
  fromLocationName: string;
  toWarehouseName: string;
  toLocationName: string;
  note: string;
  createdAt: string;
  createdBy: string;
};

export type WarehousePanelProps = {
  products: Product[];
  sales: Sale[];
  catalogProducts: CatalogProduct[];
  employees: Employee[];
  canViewSupplierOrders: boolean;
  canManageSupplierOrders: boolean;
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
  onProductTransfer: (
    product: Product,
    target: {
      warehouseId: string;
      locationId: string;
      note: string;
    },
  ) => Promise<boolean>;
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
  onUpdateProductModel: (payload: ProductModelUpdatePayload) => Promise<boolean>;
  currentEmployeeName: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export const tabs: Array<{
  key: WarehouseTab;
  labelKey: string;
  badge?: string;
}> = [
  { key: 'stock', labelKey: 'warehouse.tabs.stock' },
  { key: 'receipts', labelKey: 'warehouse.tabs.receipts' },
  { key: 'transfers', labelKey: 'warehouse.tabs.transfers' },
  { key: 'information', labelKey: 'warehouse.tabs.information' },
  { key: 'settings', labelKey: 'warehouse.tabs.settings' },
];

export const searchModes: Array<{
  key: WarehouseSearchMode;
  labelKey: string;
}> = [
  { key: 'serial', labelKey: 'warehouse.searchModes.serial' },
  { key: 'name', labelKey: 'warehouse.searchModes.name' },
  { key: 'article', labelKey: 'warehouse.searchModes.article' },
  { key: 'warehouse', labelKey: 'warehouse.searchModes.warehouse' },
  { key: 'supplier', labelKey: 'warehouse.searchModes.supplier' },
];

export const settingsTabs: Array<{ key: SettingsTab; labelKey: string }> = [
  {
    key: 'service-centers',
    labelKey: 'warehouse.settings.tabs.serviceCenters',
  },
  { key: 'warehouses', labelKey: 'warehouse.settings.tabs.warehouses' },
  {
    key: 'administrators',
    labelKey: 'warehouse.settings.tabs.administrators',
  },
];

export const initialServiceCenters: ServiceCenter[] = [];
export const initialWarehouses: WarehouseItem[] = [];
export const initialAdministrators: Administrator[] = [];
export const emptySupplierOrders: SupplierOrder[] = [];
export const transferPageSize = 8;
export const warehouseFiltersStorageKey = 'project-goods.warehouse-filters';
export const warehouseColumnsStorageKey = 'project-goods.warehouse-columns';
export const savedWarehouseFiltersStorageKey =
  'project-goods.saved-warehouse-filters';
export const initialWarehouseFilters: WarehouseFilters = {
  name: '',
  serial: '',
  article: '',
  warehouse: '',
  supplier: '',
  buyer: '',
  location: '',
  favoritesOnly: false,
};
export const warehouseFilterIconOptions = [
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
export const defaultWarehouseVisibleColumns: WarehouseColumnVisibility = {
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
export const availableWarehouseColumns: {
  stock: StockColumnKey[];
  receipts: ReceiptsColumnKey[];
} = {
  stock: [...defaultWarehouseVisibleColumns.stock],
  receipts: [...defaultWarehouseVisibleColumns.receipts],
};
export const lockedWarehouseColumns: {
  stock: StockColumnKey[];
  receipts: ReceiptsColumnKey[];
} = {
  stock: ['select'],
  receipts: ['number'],
};

export const getReceiptPaymentStatusLabel = (
  status: NonNullable<ReceiptRow['paymentStatus']>,
) => {
  const labelKey = `orders.supplier.paymentStatuses.${status}`;
  const translated = i18n.t(labelKey);
  return translated === labelKey ? status : translated;
};

export const getReceiptPaymentStatusClass = (
  status: NonNullable<ReceiptRow['paymentStatus']>,
) => `receipt-payment-status receipt-payment-status-${status}`;

export const toServiceCenterForm = (
  c?: ServiceCenter,
): ServiceCenterFormState => ({
  name: c?.name ?? '',
  color: c?.color ?? '#000000',
  address: c?.address ?? '',
  phone: c?.phone ?? '+380',
});

export const toWarehouseForm = (w?: WarehouseItem): WarehouseFormState => ({
  name: w?.name ?? '',
  isActive: w?.isActive ?? true,
  serviceCenterId: w?.serviceCenterId ?? '',
  receiptAddress: w?.receiptAddress ?? '',
  receiptPhone: w?.receiptPhone ?? '',
  locations: w?.locations.map((x) => ({ ...x })) ?? [
    { id: `l-draft-${Date.now()}`, name: '' },
  ],
});

export const normalizeProductName = (value: string) =>
  value.trim().toLowerCase();

export const filterReceiptRows = ({
  receipts,
  query,
  filters,
}: {
  receipts: ReceiptRow[];
  query: string;
  filters: WarehouseFilters;
}) => {
  const normalizedQuery = query.trim().toLowerCase();

  return receipts.filter((receipt) => {
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

    if (filters.favoritesOnly && !receipt.supplierOrderIsFavorite) {
      return false;
    }

    if (
      filters.name.trim() &&
      !receipt.productName
        .toLowerCase()
        .includes(filters.name.trim().toLowerCase())
    ) {
      return false;
    }

    const supplier = filters.supplier.trim().toLowerCase();
    if (supplier && !receipt.supplierName.toLowerCase().includes(supplier)) {
      return false;
    }

    if (
      filters.buyer.trim() &&
      receipt.acceptedBy.toLowerCase() !== filters.buyer.trim().toLowerCase()
    ) {
      return false;
    }

    return true;
  });
};

const hexColorToRgb = (value: string) => {
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
};

export const getWarehouseBadgeAccentStyle = (
  color?: string,
): CSSProperties | undefined => {
  if (!color) return undefined;
  const rgb = hexColorToRgb(color);
  if (!rgb) return undefined;
  return {
    '--warehouse-badge-accent': color,
    '--warehouse-badge-accent-bg': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`,
    '--warehouse-badge-accent-border': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.34)`,
  } as CSSProperties;
};

const translateWarehouseKey = (
  translate: TFunction,
  key: string,
  fallback: string,
) => {
  const translated = translate(key);
  return translated === key ? fallback : translated;
};

export const getWarehouseColumnLabelKey = (
  columnKey: StockColumnKey | ReceiptsColumnKey,
  tab: WarehouseColumnsTab,
) => `warehouse.tables.${tab}.columns.${columnKey}`;

export const getWarehouseColumnLabel = (
  columnKey: StockColumnKey | ReceiptsColumnKey,
  tab: WarehouseColumnsTab,
  translate: TFunction = i18n.t.bind(i18n),
) => {
  const tableKey = getWarehouseColumnLabelKey(columnKey, tab);
  const tableLabel = translateWarehouseKey(translate, tableKey, '');
  if (tableLabel) return tableLabel;
  return translateWarehouseKey(
    translate,
    `warehouse.columns.${columnKey}`,
    columnKey,
  );
};

export const getWarehouseSearchModeLabel = (
  mode: WarehouseSearchMode,
  translate: TFunction = i18n.t.bind(i18n),
) =>
  translateWarehouseKey(
    translate,
    `warehouse.searchModes.${mode}`,
    mode,
  );
