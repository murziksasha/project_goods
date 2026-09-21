export type ClientStatus = 'new' | 'vip' | 'opt' | 'blacklist' | 'ok';

export type Client = {
  id: string;
  phone: string;
  phones: string[];
  name: string;
  email: string;
  address: string;
  registrationId: string;
  iban: string;
  note: string;
  status: ClientStatus | '';
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  name: string;
  article: string;
  serialNumber: string;
  price: number;
  salePriceOptions: number[];
  note: string;
  quantity: number;
  reservedQuantity: number;
  freeQuantity: number;
  isInStock: boolean;
  purchasePlace: string;
  warehouseId?: string;
  locationId?: string;
  supplierOrderId?: string;
  supplierOrderItemIndex?: number;
  purchaseDate: string | null;
  warrantyPeriod: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeRole =
  | 'owner'
  | 'manager'
  | 'master'
  | 'accountant'
  | 'warehouse'
  | 'sales'
  | 'support';

export type EmployeePermission =
  | 'orders.view'
  | 'orders.manage'
  | 'orders.chat'
  | 'supplierOrders.view'
  | 'supplierOrders.manage'
  | 'repairs.execute'
  | 'sales.manage'
  | 'kanban.use'
  | 'clients.manage'
  | 'inventory.manage'
  | 'finance.view'
  | 'finance.cashboxes.view'
  | 'finance.cashboxes.manage'
  | 'finance.transactions.deposit'
  | 'finance.transactions.withdraw'
  | 'finance.transactions.transfer'
  | 'finance.supplierOrders.pay'
  | 'finance.supplierOrders.issueWithoutPayment'
  | 'employees.manage'
  | 'printForms.manage'
  | 'system.backups.manage';

export type OrdersTabPreference =
  | 'orders'
  | 'kanban'
  | 'sales'
  | 'supplierOrders'
  | 'supplierInformation';

export type EmployeeUiPreferences = {
  hiddenOrdersTabs: OrdersTabPreference[];
};

export type Employee = {
  id: string;
  name: string;
  phone: string;
  email: string;
  username: string;
  role: EmployeeRole;
  permissions: EmployeePermission[];
  isActive: boolean;
  isRegistered: boolean;
  note: string;
  uiPreferences?: EmployeeUiPreferences;
  createdAt: string;
  updatedAt: string;
};

export type SaleProductSnapshot = {
  id: string;
  article: string;
  name: string;
  serialNumber: string;
};

export type Sale = {
  id: string;
  recordNumber: string | null;
  saleDate: string;
  quantity: number;
  salePrice: number;
  kind: 'repair' | 'sale';
  status: string;
  paidAmount: number;
  isFavorite?: boolean;
  isRapidSale?: boolean;
  note: string;
  userNote?: string;
  timeline: Array<{
    id: string;
    kind?: 'manual' | 'system';
    author: string;
    message: string;
    createdAt: string;
  }>;
  paymentHistory: Array<{
    id: string;
    type: 'deposit' | 'refund';
    paymentMethod: 'cash' | 'non-cash';
    amount: number;
    cashboxId: string;
    cashboxName: string;
    author: string;
    createdAt: string;
  }>;
  lineItems: Array<{
    id: string;
    kind: 'product' | 'service';
    productId?: string;
    catalogProductId?: string;
    serviceId?: string;
    name: string;
    price: number;
    quantity: number;
    warrantyPeriod: number;
    serialNumbers?: string[];
  }>;
  discount?: {
    mode: 'percent' | 'amount';
    value: number;
  };
  client: {
    id: string;
    name: string;
    phone: string;
    phones?: string[];
    status: string;
    email?: string;
    address?: string;
    registrationId?: string;
    iban?: string;
  };
  product: SaleProductSnapshot | null;
  manager: {
    id: string;
    name: string;
    role: string;
  } | null;
  master: {
    id: string;
    name: string;
    role: string;
  } | null;
  issuedBy: {
    id: string;
    name: string;
    role: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  kanbanRank?: number;
};

export type RateProvider = 'nbu' | 'privat' | 'mono';
export type WeatherProvider = 'open-meteo' | 'openweather';

export type PrintFormType =
  | 'receipt'
  | 'check'
  | 'warranty'
  | 'completion-act'
  | 'invoice'
  | 'barcode'
  | 'custom';

export type PrintLayoutTextAlign = 'left' | 'center' | 'right';
export type PrintLayoutTextWeight = 'light' | 'normal' | 'bold';

export type PrintLayoutField = {
  label: string;
  value: string;
};

export type PrintLayoutTableColumn = {
  id: string;
  label: string;
};

export type PrintLayoutTableRow = {
  id: string;
  cells: Record<string, string>;
};

export type PrintLayoutBlock =
  | {
      id: string;
      type: 'heading';
      text: string;
      level: 1 | 2 | 3;
      align?: PrintLayoutTextAlign;
      weight?: PrintLayoutTextWeight;
    }
  | {
      id: string;
      type: 'paragraph';
      text: string;
      level: 1 | 2 | 3;
      align?: PrintLayoutTextAlign;
      weight?: PrintLayoutTextWeight;
    }
  | {
      id: string;
      type: 'fieldRow';
      fields: PrintLayoutField[];
    }
  | {
      id: string;
      type: 'fieldGrid';
      fields: PrintLayoutField[];
      columns?: 2 | 3 | 4;
    }
  | {
      id: string;
      type: 'customTable';
      columns: PrintLayoutTableColumn[];
      rows: PrintLayoutTableRow[];
    }
  | {
      id: string;
      type: 'lineItemsTable';
      kind: 'products' | 'services';
      title?: string;
    }
  | {
      id: string;
      type: 'invoiceItemsTable';
      title?: string;
    }
  | {
      id: string;
      type: 'barcode';
      label?: string;
      value?: string;
      showValue?: boolean;
      size?: 'compact' | 'standard' | 'large';
    }
  | {
      id: string;
      type: 'signatures';
      left: string;
      right: string;
    }
  | {
      id: string;
      type: 'divider';
    }
  | {
      id: string;
      type: 'spacer';
      size: 'small' | 'medium' | 'large';
    }
  | {
      id: string;
      type: 'columns';
      columns: Array<{
        id: string;
        blocks: PrintLayoutBlock[];
      }>;
    };

export type PrintContentMargins = {
  topMm: number;
  rightMm: number;
  bottomMm: number;
  leftMm: number;
};

export type PrintForm = {
  id: string;
  title: string;
  type: PrintFormType | string;
  content: string;
  contentFormat: 'html' | 'text';
  layoutVersion?: 1;
  layoutBlocks?: PrintLayoutBlock[];
  pageSize: 'A4' | 'label';
  labelSize?: {
    presetId: string;
    widthMm: number;
    heightMm: number;
  };
  contentMargins?: PrintContentMargins;
  orientation: 'portrait' | 'landscape';
  isActive: boolean;
  sortOrder: number;
};
