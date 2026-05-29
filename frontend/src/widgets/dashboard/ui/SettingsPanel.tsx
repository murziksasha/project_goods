import { useEffect, useMemo, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
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
  printFormVariableGroups,
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
  warehouse: 'Основний склад',
  warehouse_address: 'Київ, вул. Сервісна, 10',
  warehouse_phone: '+38 067 000 00 00',
  barcode: 'r000124',
  qrcode: 'r000124',
  products_table:
    '<table class="print-line-table"><thead><tr><th>Товар</th><th>К-сть</th><th>Сума</th></tr></thead><tbody><tr><td>Дисплейний модуль</td><td>1</td><td>3 800 UAH</td></tr></tbody></table>',
  services_table:
    '<table class="print-line-table"><thead><tr><th>Послуга</th><th>Сума</th></tr></thead><tbody><tr><td>Діагностика та заміна</td><td>1 000 UAH</td></tr></tbody></table>',
  createdAt: '29.05.2026 10:30',
};

const createPrintForm = (sortOrder: number): PrintForm => ({
  id: `form-${Date.now()}`,
  title: 'Новий шаблон',
  type: 'custom',
  content:
    '<div class="print-document"><h1>Новий шаблон</h1><p>Замовлення: {{orderNumber}}</p><p>Клієнт: {{clientName}}</p><p>Сума: {{total}}</p></div>',
  contentFormat: 'html',
  pageSize: 'A4',
  orientation: 'portrait',
  isActive: true,
  sortOrder,
});

const htmlEditorCommandButtons = [
  { command: 'undo', label: '↶', title: 'Скасувати' },
  { command: 'redo', label: '↷', title: 'Повторити' },
  { command: 'bold', label: 'B', title: 'Жирний' },
  { command: 'italic', label: 'I', title: 'Курсив' },
  { command: 'underline', label: 'U', title: 'Підкреслений' },
  { command: 'justifyLeft', label: '⯇', title: 'Ліворуч' },
  { command: 'justifyCenter', label: '≡', title: 'По центру' },
  { command: 'justifyRight', label: '⯈', title: 'Праворуч' },
  { command: 'insertUnorderedList', label: '•', title: 'Маркірований список' },
  { command: 'insertOrderedList', label: '1.', title: 'Нумерований список' },
];

const insertTableHtml =
  '<table class="print-line-table"><thead><tr><th>Назва</th><th>К-сть</th><th>Сума</th></tr></thead><tbody><tr><td>Позиція</td><td>1</td><td>{{total}}</td></tr></tbody></table>';

const imagePlaceholderHtml =
  '<div class="print-image-placeholder">Місце для зображення</div>';

const renderSpecialCodes = (root: HTMLElement | Document) => {
  root.querySelectorAll<SVGSVGElement>('svg[data-barcode-value]').forEach((node) => {
    if (node.ownerDocument.defaultView?.navigator.userAgent.includes('jsdom')) {
      return;
    }
    const value = node.dataset.barcodeValue || 'EMPTY';
    try {
      JsBarcode(node, value, {
        format: 'CODE128',
        displayValue: true,
        fontSize: 12,
        height: 44,
        margin: 0,
      });
    } catch {
      node.replaceWith(document.createTextNode(value));
    }
  });

  root.querySelectorAll<HTMLCanvasElement>('canvas[data-qrcode-value]').forEach((node) => {
    if (node.ownerDocument.defaultView?.navigator.userAgent.includes('jsdom')) {
      return;
    }
    const value = node.dataset.qrcodeValue || 'EMPTY';
    void QRCode.toCanvas(node, value, {
      width: 88,
      margin: 1,
    }).catch(() => undefined);
  });
};

const PrintPreview = ({
  html,
}: {
  html: string;
}) => {
  const previewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (previewRef.current) {
      renderSpecialCodes(previewRef.current);
    }
  }, [html]);

  return (
    <div
      ref={previewRef}
      className="settings-print-preview-page"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

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
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const selectedForm =
    printForms.find((printForm) => printForm.id === selectedFormId) ??
    printForms[0];
  const selectedPreview = selectedForm
    ? renderPrintTemplate(
        selectedForm.content,
        demoPrintValues,
        selectedForm.contentFormat,
      )
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
      title: `${selectedForm.title} копія`,
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

  const updateEditorContent = (content: string) => {
    updateSelectedForm({
      content,
      contentFormat: isHtmlMode ? 'html' : selectedForm?.contentFormat ?? 'html',
    });
  };

  const insertHtmlIntoEditor = (html: string) => {
    if (!selectedForm) return;

    if (isHtmlMode) {
      const nextContent = `${selectedForm.content}${selectedForm.content ? '\n' : ''}${html}`;
      updateSelectedForm({ content: nextContent, contentFormat: 'html' });
      return;
    }

    editorRef.current?.focus();
    document.execCommand('insertHTML', false, html);
    updateSelectedForm({
      content: editorRef.current?.innerHTML ?? `${selectedForm.content}${html}`,
      contentFormat: 'html',
    });
  };

  const insertVariable = (variable: string) => {
    insertHtmlIntoEditor(`{{${variable}}}`);
  };

  const runEditorCommand = (command: string, value?: string) => {
    if (!selectedForm || isHtmlMode) return;
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    updateSelectedForm({
      content: editorRef.current?.innerHTML ?? selectedForm.content,
      contentFormat: 'html',
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
                    <span>Назва шаблону</span>
                    <input
                      value={selectedForm.title}
                      onChange={(event) =>
                        updateSelectedForm({ title: event.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Тип документа</span>
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
                  <div className="settings-print-options-row">
                    <label className="field">
                      <span>Формат сторінки</span>
                      <select
                        value={selectedForm.pageSize}
                        onChange={(event) =>
                          updateSelectedForm({
                            pageSize:
                              event.target.value === 'label' ? 'label' : 'A4',
                          })
                        }
                      >
                        <option value="A4">A4</option>
                        <option value="label">Етикетка</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Орієнтація</span>
                      <select
                        value={selectedForm.orientation}
                        onChange={(event) =>
                          updateSelectedForm({
                            orientation:
                              event.target.value === 'landscape'
                                ? 'landscape'
                                : 'portrait',
                          })
                        }
                      >
                        <option value="portrait">Портретна</option>
                        <option value="landscape">Альбомна</option>
                      </select>
                    </label>
                  </div>
                  <label className="settings-check">
                    <input
                      type="checkbox"
                      checked={selectedForm.isActive}
                      onChange={(event) =>
                        updateSelectedForm({ isActive: event.target.checked })
                      }
                    />
                    <span>Активний у меню друку оплати</span>
                  </label>
                  <div className="settings-rich-editor">
                    <div className="settings-rich-toolbar" aria-label="Template editor toolbar">
                      {htmlEditorCommandButtons.map((button) => (
                        <button
                          key={button.command}
                          type="button"
                          title={button.title}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => runEditorCommand(button.command)}
                          disabled={isHtmlMode}
                        >
                          {button.label}
                        </button>
                      ))}
                      <select
                        aria-label="Розмір шрифту"
                        value=""
                        onChange={(event) => {
                          runEditorCommand('fontSize', event.target.value);
                          event.target.value = '';
                        }}
                        disabled={isHtmlMode}
                      >
                        <option value="">Розмір</option>
                        <option value="2">10pt</option>
                        <option value="3">12pt</option>
                        <option value="4">14pt</option>
                        <option value="5">18pt</option>
                      </select>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => insertHtmlIntoEditor(insertTableHtml)}
                        disabled={isHtmlMode}
                      >
                        Таблиця
                      </button>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => insertHtmlIntoEditor(imagePlaceholderHtml)}
                        disabled={isHtmlMode}
                      >
                        Зображення
                      </button>
                      <button
                        type="button"
                        className={isHtmlMode ? 'settings-rich-mode-active' : ''}
                        onClick={() => setIsHtmlMode((current) => !current)}
                      >
                        HTML
                      </button>
                    </div>
                    {isHtmlMode ? (
                      <textarea
                        className="settings-html-source"
                        rows={16}
                        value={selectedForm.content}
                        onChange={(event) => updateEditorContent(event.target.value)}
                      />
                    ) : (
                      <div
                        key={selectedForm.id}
                        ref={editorRef}
                        className="settings-content-editable"
                        contentEditable
                        suppressContentEditableWarning
                        onInput={(event) =>
                          updateSelectedForm({
                            content: event.currentTarget.innerHTML,
                            contentFormat: 'html',
                          })
                        }
                        dangerouslySetInnerHTML={{
                          __html: selectedForm.content,
                        }}
                      />
                    )}
                  </div>
                  <div className="settings-variable-catalog">
                    <h3>Змінні шаблону</h3>
                    <div className="settings-variable-grid">
                      {printFormVariableGroups.map((group) => (
                        <div key={group.title} className="settings-variable-group">
                          <strong>{group.title}</strong>
                          {group.variables.map((variable) => (
                            <button
                              key={variable.key}
                              type="button"
                              className="settings-variable-row"
                              onClick={() => insertVariable(variable.key)}
                            >
                              <code>{`{{${variable.key}}}`}</code>
                              <span>{variable.label}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={deleteSelectedForm}
                    disabled={printForms.length <= 1}
                  >
                    Видалити шаблон
                  </button>
                </div>
                <aside className="settings-print-preview">
                  <p className="section-label">Live preview</p>
                  <h3>{selectedForm.title}</h3>
                  <PrintPreview html={selectedPreview} />
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
