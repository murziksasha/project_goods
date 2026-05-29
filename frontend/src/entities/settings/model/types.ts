export type PrintFormType =
  | 'receipt'
  | 'check'
  | 'warranty'
  | 'completion-act'
  | 'invoice'
  | 'barcode'
  | 'custom';

export type PrintForm = {
  id: string;
  title: string;
  type: PrintFormType | string;
  content: string;
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
  printForms: PrintForm[];
  orderDefaults: OrderDefaults;
  numbering: NumberingSettings;
  financeDefaults: FinanceDefaults;
  notificationSettings: NotificationSettings;
};
