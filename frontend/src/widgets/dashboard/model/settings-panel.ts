import type { AppSettingsFormValues } from '../../../entities/settings/model/types';
import {
  isOptionalAddressValid,
  isOptionalIbanValid,
  isOptionalRegistrationIdValid,
} from './clients-workspace';

export type SettingsTab =
  | 'company'
  | 'print'
  | 'dashboard'
  | 'backups';

export const settingsTabs: Array<{ key: SettingsTab; labelKey: string }> = [
  { key: 'company', labelKey: 'settings.tabs.company' },
  { key: 'print', labelKey: 'settings.tabs.print' },
  { key: 'dashboard', labelKey: 'settings.tabs.dashboard' },
  { key: 'backups', labelKey: 'settings.tabs.backups' },
];

export const settingsTabStorageKey = 'project-goods.settings-tab';

export const isSettingsTab = (value: string | null): value is SettingsTab =>
  settingsTabs.some((tab) => tab.key === value);

export const getStoredSettingsTab = (): SettingsTab => {
  try {
    const storedTab = window.localStorage.getItem(settingsTabStorageKey);
    return isSettingsTab(storedTab) ? storedTab : 'company';
  } catch {
    return 'company';
  }
};

export const demoPrintValues: Record<string, string> = {
  id: 'demo-sale-id',
  orderNumber: 'r000124',
  labelCode: 'r000124',
  labelTitle: 'iPhone 13 Pro',
  labelContact: '+38 067 111 22 33',
  date: '29.05.2026',
  status: 'New repair',
  clientName: 'Ivan Petrenko',
  clientPhone: '+38 067 111 22 33',
  deviceName: 'iPhone 13 Pro',
  serialNumber: 'SN-2026-001',
  article: 'IPH13P',
  defect: 'Display does not work',
  comment: 'Display replacement and diagnostics',
  total: '4 800 UAH',
  paid: '1 000 UAH',
  toPay: '3 800 UAH',
  currency: 'UAH',
  discount: '0 UAH',
  note: 'Display replacement and diagnostics',
  managerName: 'Olena Manager',
  masterName: 'Andrii Master',
  company: 'Service center',
  company_address: '10001, Zhytomyr, Lesi Ukrainky Square, 16',
  company_id: '12345678',
  company_iban: 'UA12 3456 7891 2345 6789 1234 5678 9',
  company_email: 'service@example.com',
  company_site: 'https://service.example.com',
  customer_reg_id: '87654321',
  customer_address: 'Chornomorsk, Vitalii Shuma Street 2B',
  customer_iban: 'UA12 3456 7891 2345 6789 1234 5678 9',
  due_date: '01.06.2026',
  warehouse: 'Main warehouse',
  warehouse_address: '82707, Vinnytsia, Haharina Street, 12',
  warehouse_phone: '+38 067 000 00 00',
  net_amount: '4 800.00 UAH',
  vat_amount: '0.00 UAH',
  total_amount: '4 800.00 UAH',
  total_written: 'four thousand eight hundred hryvnias 00 kopecks',
  seller_occupation: 'Director',
  seller_name: 'Petro Stepanenko',
  note_label: 'Note',
  barcode: 'r000124',
  products_table:
    '<table class="print-line-table"><thead><tr><th>Product</th><th>Qty</th><th>Amount</th></tr></thead><tbody><tr><td>Display module</td><td>1</td><td>3 800 UAH</td></tr></tbody></table>',
  services_table:
    '<table class="print-line-table"><thead><tr><th>Service</th><th>Amount</th></tr></thead><tbody><tr><td>Diagnostics and replacement</td><td>1 000 UAH</td></tr></tbody></table>',
  invoice_items_table:
    '<table class="invoice-items-table"><thead><tr><th style="width: 34px;">No.</th><th>Name</th><th style="width: 74px;">Quantity</th><th style="width: 72px;">Price without VAT</th><th style="width: 64px;">VAT rate</th><th style="width: 82px;">Amount without VAT</th><th style="width: 82px;">Amount with VAT</th></tr></thead><tbody><tr><td>1.</td><td><strong>Display module replacement</strong><span class="invoice-item-description">Work and parts installation</span></td><td>1.000</td><td>4 800.00</td><td>0%</td><td>4 800.00</td><td>4 800.00</td></tr></tbody></table>',
  createdAt: '29.05.2026 10:30',
};

type CompanySettingsFields = Pick<
  AppSettingsFormValues,
  'company' | 'companyAddress' | 'companyId' | 'companyIban'
>;

export const getCompanyValidation = (form: CompanySettingsFields) => {
  const isCompanyNameValid = form.company.trim().length >= 2;
  const isCompanyAddressValid = isOptionalAddressValid(form.companyAddress);
  const isCompanyIdValid = isOptionalRegistrationIdValid(form.companyId);
  const isCompanyIbanValid = isOptionalIbanValid(form.companyIban);

  return {
    isCompanyNameValid,
    isCompanyAddressValid,
    isCompanyIdValid,
    isCompanyIbanValid,
    hasInvalidCompanyFields:
      !isCompanyNameValid ||
      !isCompanyAddressValid ||
      !isCompanyIdValid ||
      !isCompanyIbanValid,
  };
};

type PreviewSettingsFields = Pick<
  AppSettingsFormValues,
  | 'serviceName'
  | 'company'
  | 'companyAddress'
  | 'companyId'
  | 'companyIban'
  | 'companyEmail'
  | 'companySite'
>;

export const getSettingsPreviewValues = (
  form: PreviewSettingsFields,
): Record<string, string> => ({
  ...demoPrintValues,
  company: form.serviceName || form.company || demoPrintValues.company,
  company_address: form.companyAddress || demoPrintValues.company_address,
  company_id: form.companyId || demoPrintValues.company_id,
  company_iban: form.companyIban || demoPrintValues.company_iban,
  company_email: form.companyEmail || demoPrintValues.company_email,
  company_site: form.companySite || demoPrintValues.company_site,
});
