import { useMemo, useState } from 'react';
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
  printFormVariables,
  renderPrintTemplate,
} from '../../../entities/settings/model/printForms';

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

const printFormTypeOptions = [
  'receipt',
  'check',
  'warranty',
  'completion-act',
  'invoice',
  'barcode',
  'custom',
];

const demoPrintValues = {
  orderNumber: 'r000124',
  clientName: 'Ivan Petrenko',
  clientPhone: '+38 067 111 22 33',
  deviceName: 'iPhone 13 Pro',
  serialNumber: 'SN-2026-001',
  article: 'IPH13P',
  total: '4 800 UAH',
  paid: '1 000 UAH',
  toPay: '3 800 UAH',
  note: 'Display replacement and diagnostics',
  managerName: 'Olena Manager',
  masterName: 'Andrii Master',
  createdAt: '29.05.2026 10:30',
};

const createPrintForm = (sortOrder: number): PrintForm => ({
  id: `form-${Date.now()}`,
  title: 'New form',
  type: 'custom',
  content:
    'Order: {{orderNumber}}\nClient: {{clientName}}\nDevice: {{deviceName}}\nTotal: {{total}}',
  isActive: true,
  sortOrder,
});

export const SettingsPanel = ({
  form,
  isSaving,
  onChange,
  onSubmit,
}: SettingsPanelProps) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
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
  const selectedPreview = selectedForm
    ? renderPrintTemplate(selectedForm.content, demoPrintValues)
    : '';
  const hasInvalidPrintForms = printForms.some(
    (printForm) => !printForm.title.trim() || !printForm.content.trim(),
  );
  const isSaveDisabled =
    isSaving || form.serviceName.trim().length < 2 || hasInvalidPrintForms;

  const updatePrintForms = (nextForms: PrintForm[]) => {
    onChange('printForms', normalizePrintFormsForView(nextForms));
  };

  const updateSelectedForm = (patch: Partial<PrintForm>) => {
    if (!selectedForm) return;

    updatePrintForms(
      printForms.map((printForm) =>
        printForm.id === selectedForm.id
          ? { ...printForm, ...patch }
          : printForm,
      ),
    );
  };

  const addPrintForm = () => {
    const nextForm = createPrintForm((printForms.length + 1) * 10);
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

    const nextForms = printForms.filter(
      (printForm) => printForm.id !== selectedForm.id,
    );
    updatePrintForms(nextForms);
    setSelectedFormId(nextForms[0]?.id ?? '');
  };

  const insertVariable = (variable: string) => {
    if (!selectedForm) return;

    updateSelectedForm({
      content: `${selectedForm.content}${selectedForm.content ? ' ' : ''}{{${variable}}}`,
    });
  };

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
            <label className="field field-wide">
              <span>Company details</span>
              <textarea
                rows={3}
                value="Configure legal details in the next version."
                disabled
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
              <div className="settings-print-builder">
                <div className="settings-print-editor">
                  <label className="field">
                    <span>Form title</span>
                    <input
                      value={selectedForm.title}
                      onChange={(event) =>
                        updateSelectedForm({ title: event.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Document type</span>
                    <select
                      value={selectedForm.type}
                      onChange={(event) =>
                        updateSelectedForm({ type: event.target.value })
                      }
                    >
                      {printFormTypeOptions.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-check">
                    <input
                      type="checkbox"
                      checked={selectedForm.isActive}
                      onChange={(event) =>
                        updateSelectedForm({ isActive: event.target.checked })
                      }
                    />
                    <span>Active in payment print menu</span>
                  </label>
                  <label className="field">
                    <span>Template content</span>
                    <textarea
                      rows={13}
                      value={selectedForm.content}
                      onChange={(event) =>
                        updateSelectedForm({ content: event.target.value })
                      }
                    />
                  </label>
                  <div className="settings-variable-list">
                    {printFormVariables.map((variable) => (
                      <button
                        key={variable}
                        type="button"
                        className="settings-variable-chip"
                        onClick={() => insertVariable(variable)}
                      >
                        {`{{${variable}}}`}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={deleteSelectedForm}
                    disabled={printForms.length <= 1}
                  >
                    Delete form
                  </button>
                </div>
                <aside className="settings-print-preview">
                  <p className="section-label">Live preview</p>
                  <h3>{selectedForm.title}</h3>
                  <pre>{selectedPreview}</pre>
                </aside>
              </div>
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
