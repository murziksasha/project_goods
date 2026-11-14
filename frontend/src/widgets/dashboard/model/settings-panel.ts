import type { AppSettingsFormValues } from '../../../entities/settings';
import { formatAmountInWords, formatPrintAmount } from '../../../shared/lib/printFormatting';
import {
  isOptionalAddressValid,
  isOptionalIbanValid,
  isOptionalRegistrationIdValid,
} from './clients-workspace';

export type SettingsTab =
  | 'company'
  | 'print'
  | 'dashboard'
  | 'backups'
  | 'database';

export const settingsTabs: Array<{ key: SettingsTab; labelKey: string }> = [
  { key: 'company', labelKey: 'settings.tabs.company' },
  { key: 'print', labelKey: 'settings.tabs.print' },
  { key: 'dashboard', labelKey: 'settings.tabs.dashboard' },
  { key: 'backups', labelKey: 'settings.tabs.backups' },
  { key: 'database', labelKey: 'settings.tabs.database' },
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
  repair_order_reference: 'Ремонтне замовлення №r000124',
  service_center_phone: '+38 067 000 00 00',
  labelTitle: 'iPhone 13 Pro',
  labelContact: '+38 067 111 22 33',
  date: '29.05.2026',
  status: 'Новий ремонт',
  clientName: 'Іван Петренко',
  clientPhone: '+38 067 111 22 33',
  deviceName: 'iPhone 13 Pro',
  serialNumber: 'SN-2026-001',
  article: 'IPH13P',
  defect: 'Не працює дисплей',
  comment: 'Заміна дисплея та діагностика',
  total: '4 800,00 грн',
  paid: '1 000,00 грн',
  toPay: '3 800,00 грн',
  currency: 'грн',
  discount: '0 грн',
  note: 'Заміна дисплея та діагностика',
  managerName: 'Олена Менеджер',
  masterName: 'Андрій Майстер',
  company: 'Сервісний центр',
  company_address: '10001, Житомир, площа Лесі Українки, 16',
  company_id: '12345678',
  company_iban: 'UA12 3456 7891 2345 6789 1234 5678 9',
  company_email: 'service@example.com',
  company_site: 'https://service.example.com',
  customer_reg_id: '87654321',
  customer_address: 'Чорноморськ, вулиця Віталія Шума, 2Б',
  customer_iban: 'UA12 3456 7891 2345 6789 1234 5678 9',
  due_date: '01.06.2026',
  warehouse: 'Основний склад',
  warehouse_address: '82707, Вінниця, вулиця Гагаріна, 12',
  warehouse_phone: '+38 067 000 00 00',
  net_amount: `${formatPrintAmount(4800)} грн`,
  vat_amount: '0,00 грн',
  vat_included_net_amount: `${formatPrintAmount(4000)} грн`,
  vat_included_vat_amount: `${formatPrintAmount(800)} грн`,
  total_amount: `${formatPrintAmount(4800)} грн`,
  total_written: formatAmountInWords(4800),
  seller_occupation: 'Директор',
  seller_name: 'Петро Степаненко',
  note_label: 'Примітка',
  barcode: 'r000124',
  products_table:
    '<table class="print-line-table"><thead><tr><th>Товар</th><th>К-сть</th><th>Сума</th></tr></thead><tbody><tr><td>Дисплейний модуль</td><td>1</td><td>3 800,00 грн</td></tr></tbody></table>',
  services_table:
    '<table class="print-line-table"><thead><tr><th>Послуга</th><th>Сума</th></tr></thead><tbody><tr><td>Діагностика та заміна</td><td>1 000,00 грн</td></tr></tbody></table>',
  invoice_items_table:
    '<table class="invoice-items-table"><thead><tr><th style="width: 34px;">№</th><th>Найменування</th><th style="width: 74px;">Кількість</th><th style="width: 72px;">Ціна без ПДВ</th><th style="width: 64px;">Ставка ПДВ</th><th style="width: 82px;">Сума без ПДВ</th><th style="width: 82px;">Сума з ПДВ</th></tr></thead><tbody><tr><td>1.</td><td><strong>Заміна дисплейного модуля</strong><span class="invoice-item-description">Роботи та встановлення деталей</span></td><td>1,00</td><td>4 800,00</td><td>0%</td><td>4 800,00</td><td>4 800,00</td></tr></tbody></table>',
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
