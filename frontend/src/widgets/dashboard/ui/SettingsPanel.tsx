import { useEffect, useMemo, useState } from 'react';
import type {
  AppSettingsFormValues,
  FinanceDefaults,
  NotificationSettings,
  NumberingSettings,
  OrderDefaults,
  PrintForm,
} from '../../../entities/settings/model/types';
import {
  normalizePrintFormsForView,
} from '../../../entities/settings/model/printForms';
import { createNewPrintForm, PrintFormBuilder } from './PrintFormBuilder';

type SettingsPanelProps = {
  form: AppSettingsFormValues;
  isSaving: boolean;
  onChange: <K extends keyof AppSettingsFormValues>(
    field: K,
    value: AppSettingsFormValues[K],
  ) => void;
  onSubmit: () => void;
};

type SettingsTab =
  | 'company'
  | 'print'
  | 'orders'
  | 'numbering'
  | 'finance'
  | 'notifications';

const settingsTabs: Array<{ key: SettingsTab; label: string }> = [
  { key: 'company', label: 'Company' },
  { key: 'print', label: 'Print forms' },
  { key: 'orders', label: 'Orders' },
  { key: 'numbering', label: 'Numbering' },
  { key: 'finance', label: 'Finance' },
  { key: 'notifications', label: 'Notifications' },
];
const settingsTabStorageKey = 'project-goods.settings-tab';

const getStoredSettingsTab = (): SettingsTab => {
  try {
    const storedTab = window.localStorage.getItem(settingsTabStorageKey);
    return storedTab === 'company' ||
      storedTab === 'print' ||
      storedTab === 'orders' ||
      storedTab === 'numbering' ||
      storedTab === 'finance' ||
      storedTab === 'notifications'
      ? storedTab
      : 'company';
  } catch {
    return 'company';
  }
};

const demoPrintValues = {
  id: 'demo-sale-id',
  orderNumber: 'r000124',
  date: '29.05.2026',
  status: 'Новий ремонт',
  clientName: 'Ivan Petrenko',
  clientPhone: '+38 067 111 22 33',
  deviceName: 'iPhone 13 Pro',
  serialNumber: 'SN-2026-001',
  article: 'IPH13P',
  defect: 'Не працює дисплей',
  comment: 'Заміна дисплея та діагностика',
  total: '4 800 UAH',
  paid: '1 000 UAH',
  toPay: '3 800 UAH',
  currency: 'UAH',
  discount: '0 UAH',
  note: 'Display replacement and diagnostics',
  managerName: 'Olena Manager',
  masterName: 'Andrii Master',
  company: 'Сервісний центр',
  company_address: '10001, м. Житомир, пл. Лесі Українки, 16',
  company_id: '12345678',
  company_iban: 'UA12 3456 7891 2345 6789 1234 5678 9',
  company_email: 'service@example.com',
  company_site: 'https://service.example.com',
  customer_reg_id: '87654321',
  customer_address: 'м. Чорноморськ, вул. Віталія Шума 2Б',
  customer_iban: 'UA12 3456 7891 2345 6789 1234 5678 9',
  due_date: '01.06.2026',
  warehouse: 'Основний склад',
  warehouse_address: '82707, м. Вінниця, вул. Гагаріна, 12',
  warehouse_phone: '+38 067 000 00 00',
  net_amount: '4 800,00 грн',
  vat_amount: '0,00 грн',
  total_amount: '4 800,00 грн',
  total_written: 'чотири тисячі вісімсот гривень 00 копійок',
  seller_occupation: 'Директор',
  seller_name: 'Петро Степаненко',
  note_label: 'Примітка',
  barcode: 'r000124',
  products_table:
    '<table class="print-line-table"><thead><tr><th>Товар</th><th>К-сть</th><th>Сума</th></tr></thead><tbody><tr><td>Дисплейний модуль</td><td>1</td><td>3 800 UAH</td></tr></tbody></table>',
  services_table:
    '<table class="print-line-table"><thead><tr><th>Послуга</th><th>Сума</th></tr></thead><tbody><tr><td>Діагностика та заміна</td><td>1 000 UAH</td></tr></tbody></table>',
  invoice_items_table:
    '<table class="invoice-items-table"><thead><tr><th style="width: 34px;">№</th><th>Назва</th><th style="width: 74px;">Кількість</th><th style="width: 72px;">Ціна без ПДВ</th><th style="width: 64px;">Ставка ПДВ</th><th style="width: 82px;">Сума без ПДВ</th><th style="width: 82px;">Сума з ПДВ</th></tr></thead><tbody><tr><td>1.</td><td><strong>Заміна дисплейного модуля</strong><span class="invoice-item-description">Робота та встановлення комплектуючих</span></td><td>1,000</td><td>4 800,00</td><td>0%</td><td>4 800,00</td><td>4 800,00</td></tr></tbody></table>',
  createdAt: '29.05.2026 10:30',
};

export const SettingsPanel = ({
  form,
  isSaving,
  onChange,
  onSubmit,
}: SettingsPanelProps) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(getStoredSettingsTab);
  const printForms = useMemo(
    () => normalizePrintFormsForView(form.printForms),
    [form.printForms],
  );
  const [selectedFormId, setSelectedFormId] = useState(
    () => printForms[0]?.id ?? '',
  );
  const selectedForm =
    printForms.find((printForm) => printForm.id === selectedFormId) ??
    printForms[0];
  const previewValues = useMemo(
    () => ({
      ...demoPrintValues,
      company: form.serviceName || form.company || demoPrintValues.company,
      company_address: form.companyAddress || demoPrintValues.company_address,
      company_id: form.companyId || demoPrintValues.company_id,
      company_iban: form.companyIban || demoPrintValues.company_iban,
      company_email: form.companyEmail || demoPrintValues.company_email,
      company_site: form.companySite || demoPrintValues.company_site,
    }),
    [
      form.company,
      form.companyAddress,
      form.companyEmail,
      form.companyIban,
      form.companyId,
      form.companySite,
      form.serviceName,
    ],
  );
  const hasInvalidPrintForms = printForms.some(
    (printForm) => !printForm.title.trim() || !printForm.content.trim(),
  );
  const companyName = form.company.trim();
  const companyAddress = form.companyAddress.trim();
  const companyId = form.companyId.trim();
  const companyIbanNormalized = form.companyIban.replace(/\s+/g, '').toUpperCase();
  const isCompanyNameValid = companyName.length >= 2;
  const isCompanyAddressValid =
    companyAddress.length === 0 || companyAddress.length >= 5;
  const isCompanyIdValid =
    companyId.length === 0 || /^[0-9A-Za-z-]{8,12}$/.test(companyId);
  const isCompanyIbanValid =
    companyIbanNormalized.length === 0 || /^UA\d{27}$/.test(companyIbanNormalized);
  const hasInvalidCompanyFields =
    !isCompanyNameValid ||
    !isCompanyAddressValid ||
    !isCompanyIdValid ||
    !isCompanyIbanValid;
  const isSaveDisabled =
    isSaving ||
    form.serviceName.trim().length < 2 ||
    hasInvalidPrintForms ||
    hasInvalidCompanyFields;

  const updatePrintForms = (nextForms: PrintForm[]) => {
    onChange('printForms', normalizePrintFormsForView(nextForms));
  };

  const updateFormById = (formId: string, patch: Partial<PrintForm>) => {
    updatePrintForms(
      printForms.map((printForm) =>
        printForm.id === formId ? { ...printForm, ...patch } : printForm,
      ),
    );
  };

  const addPrintForm = () => {
    const nextForm = createNewPrintForm((printForms.length + 1) * 10);
    updatePrintForms([...printForms, nextForm]);
    setSelectedFormId(nextForm.id);
  };

  const duplicateSelectedForm = () => {
    if (!selectedForm) return;
    const nextForm = {
      ...selectedForm,
      id: `form-${Date.now()}`,
      title: `${selectedForm.title} copy`,
      sortOrder: (printForms.length + 1) * 10,
    };
    updatePrintForms([...printForms, nextForm]);
    setSelectedFormId(nextForm.id);
  };

  const deleteSelectedForm = () => {
    if (!selectedForm || printForms.length <= 1) return;
    const nextForms = printForms.filter((printForm) => printForm.id !== selectedForm.id);
    updatePrintForms(nextForms);
    setSelectedFormId(nextForms[0]?.id ?? '');
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(settingsTabStorageKey, activeTab);
    } catch {
      // Ignore localStorage write errors.
    }
  }, [activeTab]);
  const updateOrderDefaults = <K extends keyof OrderDefaults>(
    field: K,
    value: OrderDefaults[K],
  ) => {
    onChange('orderDefaults', { ...form.orderDefaults, [field]: value });
  };

  const updateNumbering = <K extends keyof NumberingSettings>(
    field: K,
    value: NumberingSettings[K],
  ) => {
    onChange('numbering', { ...form.numbering, [field]: value });
  };

  const updateFinanceDefaults = <K extends keyof FinanceDefaults>(
    field: K,
    value: FinanceDefaults[K],
  ) => {
    onChange('financeDefaults', { ...form.financeDefaults, [field]: value });
  };

  const updateNotificationSettings = <K extends keyof NotificationSettings>(
    field: K,
    value: NotificationSettings[K],
  ) => {
    onChange('notificationSettings', {
      ...form.notificationSettings,
      [field]: value,
    });
  };

  return (
    <section className="panel settings-page">
      <div className="panel-header panel-header-row">
        <div>
          <p className="section-label">Settings</p>
          <h2>Service configuration</h2>
          <p className="panel-subtitle">
            Global CRM settings for orders, print forms, finance and future
            client notifications.
          </p>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={onSubmit}
          disabled={isSaveDisabled}
        >
          {isSaving ? 'Saving...' : 'Save settings'}
        </button>
      </div>

      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {settingsTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={
              tab.key === activeTab
                ? 'settings-tab settings-tab-active'
                : 'settings-tab'
            }
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'company' ? (
        <section className="settings-section">
          <div className="form-grid">
            <label className="field field-wide">
              <span>Service name in header</span>
              <input
                value={form.serviceName}
                onChange={(event) =>
                  onChange('serviceName', event.target.value)
                }
                placeholder="Service CRM"
              />
            </label>
            <label className="field">
              <span>Company name ({'{{company}}'})</span>
              <input
                value={form.company}
                onChange={(event) => onChange('company', event.target.value)}
                placeholder="Назва компанії"
                aria-invalid={!isCompanyNameValid}
              />
              {!isCompanyNameValid ? (
                <small>Company name must be at least 2 characters.</small>
              ) : null}
            </label>
            <label className="field">
              <span>Company ID ({'{{company_id}}'})</span>
              <input
                value={form.companyId}
                onChange={(event) => onChange('companyId', event.target.value)}
                placeholder="ЄДРПОУ або ІПН компанії"
                aria-invalid={!isCompanyIdValid}
              />
              {!isCompanyIdValid ? (
                <small>Company ID must be 8-12 characters (letters, digits, dash).</small>
              ) : null}
            </label>
            <label className="field field-wide">
              <span>Company address ({'{{company_address}}'})</span>
              <input
                value={form.companyAddress}
                onChange={(event) =>
                  onChange('companyAddress', event.target.value)
                }
                placeholder="Адреса компанії"
                aria-invalid={!isCompanyAddressValid}
              />
              {!isCompanyAddressValid ? (
                <small>Company address must be at least 5 characters.</small>
              ) : null}
            </label>
            <label className="field field-wide">
              <span>Company IBAN ({'{{company_iban}}'})</span>
              <input
                value={form.companyIban}
                onChange={(event) =>
                  onChange('companyIban', event.target.value)
                }
                placeholder="UA00 0000 0000 0000 0000 0000 0000 000"
                aria-invalid={!isCompanyIbanValid}
              />
              {!isCompanyIbanValid ? (
                <small>IBAN must match UA + 27 digits (spaces are allowed).</small>
              ) : null}
            </label>
            <label className="field">
              <span>Company e-mail ({'{{company_email}}'})</span>
              <input
                value={form.companyEmail}
                onChange={(event) =>
                  onChange('companyEmail', event.target.value)
                }
                placeholder="service@example.com"
              />
            </label>
            <label className="field">
              <span>Company site ({'{{company_site}}'})</span>
              <input
                value={form.companySite}
                onChange={(event) =>
                  onChange('companySite', event.target.value)
                }
                placeholder="https://example.com"
              />
            </label>
          </div>
        </section>
      ) : null}

      {activeTab === 'print' ? (
        <section className="settings-section settings-print-section">
          <div className="panel-header panel-header-row">
            <div>
              <p className="section-label">Print forms</p>
              <h2>Order documents</h2>
            </div>
            <div className="settings-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={addPrintForm}
              >
                Add
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={duplicateSelectedForm}
                disabled={!selectedForm}
              >
                Duplicate
              </button>
            </div>
          </div>

          <div className="settings-print-grid">
            <div className="settings-print-list">
              {printForms.map((printForm) => (
                <button
                  key={printForm.id}
                  type="button"
                  className={
                    printForm.id === selectedForm?.id
                      ? 'settings-print-list-item settings-print-list-item-active'
                      : 'settings-print-list-item'
                  }
                  onClick={() => setSelectedFormId(printForm.id)}
                >
                  <span>{printForm.title}</span>
                  <small>{printForm.isActive ? printForm.type : 'inactive'}</small>
                </button>
              ))}
            </div>

            {selectedForm ? (
              <PrintFormBuilder
                forms={printForms}
                selectedForm={selectedForm}
                previewValues={previewValues}
                onSelectForm={setSelectedFormId}
                onUpdateForms={updatePrintForms}
                onUpdateForm={updateFormById}
                onDeleteForm={deleteSelectedForm}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === 'orders' ? (
        <section className="settings-section">
          <div className="form-grid">
            <label className="field">
              <span>Default repair term, days</span>
              <input
                type="number"
                min={0}
                value={form.orderDefaults.defaultRepairTermDays}
                onChange={(event) =>
                  updateOrderDefaults(
                    'defaultRepairTermDays',
                    Number(event.target.value),
                  )
                }
              />
            </label>
            <label className="field">
              <span>Default warranty, months</span>
              <input
                type="number"
                min={0}
                value={form.orderDefaults.defaultWarrantyMonths}
                onChange={(event) =>
                  updateOrderDefaults(
                    'defaultWarrantyMonths',
                    Number(event.target.value),
                  )
                }
              />
            </label>
            <label className="field">
              <span>Default repair status</span>
              <input
                value={form.orderDefaults.defaultRepairStatus}
                onChange={(event) =>
                  updateOrderDefaults(
                    'defaultRepairStatus',
                    event.target.value,
                  )
                }
              />
            </label>
            <label className="field">
              <span>Default sale status</span>
              <input
                value={form.orderDefaults.defaultSaleStatus}
                onChange={(event) =>
                  updateOrderDefaults('defaultSaleStatus', event.target.value)
                }
              />
            </label>
          </div>
        </section>
      ) : null}

      {activeTab === 'numbering' ? (
        <section className="settings-section">
          <div className="form-grid">
            <label className="field">
              <span>Repair prefix</span>
              <input
                value={form.numbering.repairPrefix}
                onChange={(event) =>
                  updateNumbering('repairPrefix', event.target.value)
                }
              />
            </label>
            <label className="field">
              <span>Next repair number</span>
              <input
                type="number"
                min={1}
                value={form.numbering.nextRepairNumber}
                onChange={(event) =>
                  updateNumbering('nextRepairNumber', Number(event.target.value))
                }
              />
            </label>
            <label className="field">
              <span>Sale prefix</span>
              <input
                value={form.numbering.salePrefix}
                onChange={(event) =>
                  updateNumbering('salePrefix', event.target.value)
                }
              />
            </label>
            <label className="field">
              <span>Next sale number</span>
              <input
                type="number"
                min={1}
                value={form.numbering.nextSaleNumber}
                onChange={(event) =>
                  updateNumbering('nextSaleNumber', Number(event.target.value))
                }
              />
            </label>
            <label className="field">
              <span>Supplier order prefix</span>
              <input
                value={form.numbering.supplierOrderPrefix}
                onChange={(event) =>
                  updateNumbering('supplierOrderPrefix', event.target.value)
                }
              />
            </label>
            <label className="field">
              <span>Next supplier order number</span>
              <input
                type="number"
                min={1}
                value={form.numbering.nextSupplierOrderNumber}
                onChange={(event) =>
                  updateNumbering(
                    'nextSupplierOrderNumber',
                    Number(event.target.value),
                  )
                }
              />
            </label>
          </div>
        </section>
      ) : null}

      {activeTab === 'finance' ? (
        <section className="settings-section">
          <div className="form-grid">
            <label className="field">
              <span>Currency</span>
              <input
                value={form.financeDefaults.currency}
                onChange={(event) =>
                  updateFinanceDefaults(
                    'currency',
                    event.target.value.toUpperCase(),
                  )
                }
              />
            </label>
            <label className="field">
              <span>Default payment method</span>
              <select
                value={form.financeDefaults.paymentMethod}
                onChange={(event) =>
                  updateFinanceDefaults(
                    'paymentMethod',
                    event.target.value === 'non-cash' ? 'non-cash' : 'cash',
                  )
                }
              >
                <option value="cash">Cash</option>
                <option value="non-cash">Non-cash</option>
              </select>
            </label>
          </div>
        </section>
      ) : null}

      {activeTab === 'notifications' ? (
        <section className="settings-section">
          <div className="settings-toggle-grid">
            <label className="settings-check">
              <input
                type="checkbox"
                checked={form.notificationSettings.smsEnabled}
                onChange={(event) =>
                  updateNotificationSettings('smsEnabled', event.target.checked)
                }
              />
              <span>SMS notifications</span>
            </label>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={form.notificationSettings.messengerEnabled}
                onChange={(event) =>
                  updateNotificationSettings(
                    'messengerEnabled',
                    event.target.checked,
                  )
                }
              />
              <span>Messenger notifications</span>
            </label>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={form.notificationSettings.emailEnabled}
                onChange={(event) =>
                  updateNotificationSettings(
                    'emailEnabled',
                    event.target.checked,
                  )
                }
              />
              <span>Email notifications</span>
            </label>
          </div>
        </section>
      ) : null}
    </section>
  );
};
