export type PrintFormType =
  | 'receipt'
  | 'check'
  | 'warranty'
  | 'completion-act'
  | 'invoice'
  | 'barcode'
  | 'custom';

export type PrintLayoutTextAlign = 'left' | 'center' | 'right';

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
    }
  | {
      id: string;
      type: 'paragraph';
      text: string;
      align?: PrintLayoutTextAlign;
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
  orientation: 'portrait' | 'landscape';
  isActive: boolean;
  sortOrder: number;
};

export type OrderDefaults = {
  defaultRepairTermDays: number;
  defaultWarrantyMonths: number;
  defaultRepairStatus: string;
  defaultSaleStatus: string;
};

export type NumberingSettings = {
  repairPrefix: string;
  salePrefix: string;
  supplierOrderPrefix: string;
  nextRepairNumber: number;
  nextSaleNumber: number;
  nextSupplierOrderNumber: number;
};

export type FinanceDefaults = {
  currency: string;
  paymentMethod: 'cash' | 'non-cash';
};

export type NotificationSettings = {
  smsEnabled: boolean;
  messengerEnabled: boolean;
  emailEnabled: boolean;
};

export type AppSettings = {
  id: string;
  serviceName: string;
  company: string;
  companyAddress: string;
  companyId: string;
  companyIban: string;
  companyEmail: string;
  companySite: string;
  printForms: PrintForm[];
  orderDefaults: OrderDefaults;
  numbering: NumberingSettings;
  financeDefaults: FinanceDefaults;
  notificationSettings: NotificationSettings;
  createdAt: string;
  updatedAt: string;
};

export type AppSettingsFormValues = {
  serviceName: string;
  company: string;
  companyAddress: string;
  companyId: string;
  companyIban: string;
  companyEmail: string;
  companySite: string;
  printForms: PrintForm[];
  orderDefaults: OrderDefaults;
  numbering: NumberingSettings;
  financeDefaults: FinanceDefaults;
  notificationSettings: NotificationSettings;
};
