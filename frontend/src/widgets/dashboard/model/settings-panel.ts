import type { AppSettingsFormValues } from '../../../entities/settings/model/types';
import {
  isOptionalAddressValid,
  isOptionalIbanValid,
  isOptionalRegistrationIdValid,
} from './clients-workspace';

export type SettingsTab =
  | 'company'
  | 'print'
  | 'orders'
  | 'numbering'
  | 'finance'
  | 'notifications';

export const settingsTabs: Array<{ key: SettingsTab; label: string }> = [
  { key: 'company', label: 'Company' },
  { key: 'print', label: 'Print forms' },
  { key: 'orders', label: 'Orders' },
  { key: 'numbering', label: 'Numbering' },
  { key: 'finance', label: 'Finance' },
  { key: 'notifications', label: 'Notifications' },
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
  date: '29.05.2026',
  status: 'РќРѕРІРёР№ СЂРµРјРѕРЅС‚',
  clientName: 'Ivan Petrenko',
  clientPhone: '+38 067 111 22 33',
  deviceName: 'iPhone 13 Pro',
  serialNumber: 'SN-2026-001',
  article: 'IPH13P',
  defect: 'РќРµ РїСЂР°С†СЋС” РґРёСЃРїР»РµР№',
  comment: 'Р—Р°РјС–РЅР° РґРёСЃРїР»РµСЏ С‚Р° РґС–Р°РіРЅРѕСЃС‚РёРєР°',
  total: '4 800 UAH',
  paid: '1 000 UAH',
  toPay: '3 800 UAH',
  currency: 'UAH',
  discount: '0 UAH',
  note: 'Display replacement and diagnostics',
  managerName: 'Olena Manager',
  masterName: 'Andrii Master',
  company: 'РЎРµСЂРІС–СЃРЅРёР№ С†РµРЅС‚СЂ',
  company_address: '10001, Рј. Р–РёС‚РѕРјРёСЂ, РїР». Р›РµСЃС– РЈРєСЂР°С—РЅРєРё, 16',
  company_id: '12345678',
  company_iban: 'UA12 3456 7891 2345 6789 1234 5678 9',
  company_email: 'service@example.com',
  company_site: 'https://service.example.com',
  customer_reg_id: '87654321',
  customer_address: 'Рј. Р§РѕСЂРЅРѕРјРѕСЂСЃСЊРє, РІСѓР». Р’С–С‚Р°Р»С–СЏ РЁСѓРјР° 2Р‘',
  customer_iban: 'UA12 3456 7891 2345 6789 1234 5678 9',
  due_date: '01.06.2026',
  warehouse: 'РћСЃРЅРѕРІРЅРёР№ СЃРєР»Р°Рґ',
  warehouse_address: '82707, Рј. Р’С–РЅРЅРёС†СЏ, РІСѓР». Р“Р°РіР°СЂС–РЅР°, 12',
  warehouse_phone: '+38 067 000 00 00',
  net_amount: '4 800,00 РіСЂРЅ',
  vat_amount: '0,00 РіСЂРЅ',
  total_amount: '4 800,00 РіСЂРЅ',
  total_written: 'С‡РѕС‚РёСЂРё С‚РёСЃСЏС‡С– РІС–СЃС–РјСЃРѕС‚ РіСЂРёРІРµРЅСЊ 00 РєРѕРїС–Р№РѕРє',
  seller_occupation: 'Р”РёСЂРµРєС‚РѕСЂ',
  seller_name: 'РџРµС‚СЂРѕ РЎС‚РµРїР°РЅРµРЅРєРѕ',
  note_label: 'РџСЂРёРјС–С‚РєР°',
  barcode: 'r000124',
  products_table:
    '<table class="print-line-table"><thead><tr><th>РўРѕРІР°СЂ</th><th>Рљ-СЃС‚СЊ</th><th>РЎСѓРјР°</th></tr></thead><tbody><tr><td>Р”РёСЃРїР»РµР№РЅРёР№ РјРѕРґСѓР»СЊ</td><td>1</td><td>3 800 UAH</td></tr></tbody></table>',
  services_table:
    '<table class="print-line-table"><thead><tr><th>РџРѕСЃР»СѓРіР°</th><th>РЎСѓРјР°</th></tr></thead><tbody><tr><td>Р”С–Р°РіРЅРѕСЃС‚РёРєР° С‚Р° Р·Р°РјС–РЅР°</td><td>1 000 UAH</td></tr></tbody></table>',
  invoice_items_table:
    '<table class="invoice-items-table"><thead><tr><th style="width: 34px;">в„–</th><th>РќР°Р·РІР°</th><th style="width: 74px;">РљС–Р»СЊРєС–СЃС‚СЊ</th><th style="width: 72px;">Р¦С–РЅР° Р±РµР· РџР”Р’</th><th style="width: 64px;">РЎС‚Р°РІРєР° РџР”Р’</th><th style="width: 82px;">РЎСѓРјР° Р±РµР· РџР”Р’</th><th style="width: 82px;">РЎСѓРјР° Р· РџР”Р’</th></tr></thead><tbody><tr><td>1.</td><td><strong>Р—Р°РјС–РЅР° РґРёСЃРїР»РµР№РЅРѕРіРѕ РјРѕРґСѓР»СЏ</strong><span class="invoice-item-description">Р РѕР±РѕС‚Р° С‚Р° РІСЃС‚Р°РЅРѕРІР»РµРЅРЅСЏ РєРѕРјРїР»РµРєС‚СѓСЋС‡РёС…</span></td><td>1,000</td><td>4 800,00</td><td>0%</td><td>4 800,00</td><td>4 800,00</td></tr></tbody></table>',
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
