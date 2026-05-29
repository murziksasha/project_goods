import type { PrintForm } from './types';

export const defaultPrintForms: PrintForm[] = [
  {
    id: 'receipt',
    title: 'Receipt',
    type: 'receipt',
    content:
      'Receipt for order {{orderNumber}}\nClient: {{clientName}}\nPhone: {{clientPhone}}\nDevice: {{deviceName}}\nAmount: {{total}}',
    isActive: true,
    sortOrder: 10,
  },
  {
    id: 'check',
    title: 'Check',
    type: 'check',
    content:
      'Check\nOrder: {{orderNumber}}\nPaid: {{paid}}\nTo pay: {{toPay}}',
    isActive: true,
    sortOrder: 20,
  },
  {
    id: 'warranty',
    title: 'Warranty',
    type: 'warranty',
    content:
      'Warranty document\nDevice: {{deviceName}}\nS/N: {{serialNumber}}\nClient: {{clientName}}\nMaster: {{masterName}}',
    isActive: true,
    sortOrder: 30,
  },
  {
    id: 'completion-act',
    title: 'Completion act',
    type: 'completion-act',
    content:
      'Completion act\nOrder: {{orderNumber}}\nWork: {{note}}\nTotal: {{total}}',
    isActive: true,
    sortOrder: 40,
  },
  {
    id: 'invoice',
    title: 'Invoice',
    type: 'invoice',
    content:
      'Invoice for payment\nOrder: {{orderNumber}}\nClient: {{clientName}}\nTotal: {{total}}',
    isActive: true,
    sortOrder: 50,
  },
  {
    id: 'barcode',
    title: 'Barcode label',
    type: 'barcode',
    content: 'Barcode form\nOrder: {{orderNumber}}\nS/N: {{serialNumber}}',
    isActive: true,
    sortOrder: 60,
  },
];

export const printFormVariables = [
  'orderNumber',
  'clientName',
  'clientPhone',
  'deviceName',
  'serialNumber',
  'article',
  'total',
  'paid',
  'toPay',
  'note',
  'managerName',
  'masterName',
  'createdAt',
] as const;

export type PrintFormVariable = (typeof printFormVariables)[number];

export type PrintTemplateData = Record<PrintFormVariable, string>;

export const createDefaultSettingsForm = () => ({
  serviceName: 'Service CRM',
  printForms: defaultPrintForms,
  orderDefaults: {
    defaultRepairTermDays: 7,
    defaultWarrantyMonths: 1,
    defaultRepairStatus: 'new',
    defaultSaleStatus: 'new',
  },
  numbering: {
    repairPrefix: 'r',
    salePrefix: 's',
    supplierOrderPrefix: 'SO',
    nextRepairNumber: 1,
    nextSaleNumber: 1,
    nextSupplierOrderNumber: 1,
  },
  financeDefaults: {
    currency: 'UAH',
    paymentMethod: 'cash' as const,
  },
  notificationSettings: {
    smsEnabled: false,
    messengerEnabled: false,
    emailEnabled: false,
  },
});

export const normalizePrintFormsForView = (forms: PrintForm[]) =>
  (forms.length > 0 ? forms : defaultPrintForms)
    .map((form, index) => ({
      ...form,
      sortOrder: Number.isFinite(form.sortOrder)
        ? form.sortOrder
        : (index + 1) * 10,
    }))
    .sort((first, second) => first.sortOrder - second.sortOrder);

export const renderPrintTemplate = (
  template: string,
  values: PrintTemplateData,
) =>
  printFormVariables.reduce(
    (result, key) => result.replaceAll(`{{${key}}}`, values[key]),
    template,
  );
