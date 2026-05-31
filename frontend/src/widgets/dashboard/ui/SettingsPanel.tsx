import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
  customLabelSizePresetId,
  defaultLabelSize,
  labelSizePresets,
  normalizePrintFormsForView,
  normalizeLabelSize,
  printFormVariableGroups,
  renderPrintTemplate,
} from '../../../entities/settings/model/printForms';

const EDITOR_PERSIST_DEBOUNCE_MS = 250;

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

const printFormTypeOptions = [
  'receipt',
  'check',
  'warranty',
  'completion-act',
  'invoice',
  'barcode',
  'custom',
];

const getLabelPreviewStyle = (
  form: PrintForm | undefined,
): CSSProperties => {
  if (!form || form.pageSize !== 'label') return {};

  const labelSize = normalizeLabelSize(form.labelSize);
  return {
    '--label-width': `${labelSize.widthMm}mm`,
    '--label-height': `${labelSize.heightMm}mm`,
    width: `${labelSize.widthMm}mm`,
    minHeight: `${labelSize.heightMm}mm`,
  } as CSSProperties;
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
  customer_reg_id: '87654321',
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
  qrcode: 'r000124',
  products_table:
    '<table class="print-line-table"><thead><tr><th>Товар</th><th>К-сть</th><th>Сума</th></tr></thead><tbody><tr><td>Дисплейний модуль</td><td>1</td><td>3 800 UAH</td></tr></tbody></table>',
  services_table:
    '<table class="print-line-table"><thead><tr><th>Послуга</th><th>Сума</th></tr></thead><tbody><tr><td>Діагностика та заміна</td><td>1 000 UAH</td></tr></tbody></table>',
  invoice_items_table:
    '<table class="invoice-items-table"><thead><tr><th style="width: 34px;">№</th><th>Назва</th><th style="width: 74px;">Кількість</th><th style="width: 72px;">Ціна без ПДВ</th><th style="width: 64px;">Ставка ПДВ</th><th style="width: 82px;">Сума без ПДВ</th><th style="width: 82px;">Сума з ПДВ</th></tr></thead><tbody><tr><td>1.</td><td><strong>Заміна дисплейного модуля</strong><span class="invoice-item-description">Робота та встановлення комплектуючих</span></td><td>1,000</td><td>4 800,00</td><td>0%</td><td>4 800,00</td><td>4 800,00</td></tr></tbody></table>',
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
  { command: 'justifyLeft', label: 'L', title: 'Ліворуч' },
  { command: 'justifyCenter', label: 'C', title: 'По центру' },
  { command: 'justifyRight', label: 'R', title: 'Праворуч' },
  { command: 'insertUnorderedList', label: '•', title: 'Маркірований список' },
  { command: 'insertOrderedList', label: '1.', title: 'Нумерований список' },
];

const insertTableHtml =
  '<table class="print-line-table"><thead><tr><th>Назва</th><th>К-сть</th><th>Ціна</th><th>Сума</th></tr></thead><tbody><tr><td>Позиція</td><td>1</td><td>{{total}}</td><td>{{total}}</td></tr></tbody></table>';

const imagePlaceholderHtml =
  '<div class="print-image-placeholder">Місце для зображення</div>';

const specialPrintBlockButtons = [
  { label: 'Barcode', html: '{{barcode}}' },
  { label: 'QR', html: '{{qrcode}}' },
  { label: 'Товари', html: '<h3>Товари</h3>{{products_table}}' },
  { label: 'Послуги', html: '<h3>Послуги</h3>{{services_table}}' },
  { label: 'Рахунок', html: '{{invoice_items_table}}' },
];

const normalizeEditorHtml = (html: string): string => {
  if (typeof window === 'undefined') return html;

  const container = window.document.createElement('div');
  container.innerHTML = html;

  container.querySelectorAll('font').forEach((fontNode) => {
    const parent = fontNode.parentNode;
    while (fontNode.firstChild) {
      parent?.insertBefore(fontNode.firstChild, fontNode);
    }
    parent?.removeChild(fontNode);
  });

  container.querySelectorAll<HTMLElement>('span').forEach((spanNode) => {
    if (spanNode.classList.contains('settings-print-variable-token')) return;
    if (spanNode.attributes.length === 0) return;
    if (!spanNode.textContent?.includes('{{')) return;
    spanNode.removeAttribute('style');
    if (spanNode.attributes.length === 0) {
      const parent = spanNode.parentNode;
      while (spanNode.firstChild) {
        parent?.insertBefore(spanNode.firstChild, spanNode);
      }
      parent?.removeChild(spanNode);
    }
  });

  return container.innerHTML;
};

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
  form,
}: {
  html: string;
  form: PrintForm | undefined;
}) => {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const previewStyle = getLabelPreviewStyle(form);

  useEffect(() => {
    if (previewRef.current) {
      renderSpecialCodes(previewRef.current);
    }
  }, [html]);

  return (
    <div
      ref={previewRef}
      className={
        form?.pageSize === 'label'
          ? 'settings-print-preview-page settings-print-preview-page-label'
          : 'settings-print-preview-page'
      }
      style={previewStyle}
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
  const [activeTab, setActiveTab] = useState<SettingsTab>(getStoredSettingsTab);
  const printForms = useMemo(
    () => normalizePrintFormsForView(form.printForms),
    [form.printForms],
  );
  const [selectedFormId, setSelectedFormId] = useState(
    () => printForms[0]?.id ?? '',
  );
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [draftHtmlByFormId, setDraftHtmlByFormId] = useState<Record<string, string>>({});
  const editorRef = useRef<HTMLDivElement | null>(null);
  const printFormsRef = useRef(printForms);
  const draftHtmlByFormIdRef = useRef(draftHtmlByFormId);
  const persistTimerRef = useRef<number | null>(null);
  const selectedForm =
    printForms.find((printForm) => printForm.id === selectedFormId) ??
    printForms[0];
  const selectedFormContent = selectedForm?.content ?? '';
  const selectedEditorContent =
    selectedForm && draftHtmlByFormId[selectedForm.id] !== undefined
      ? draftHtmlByFormId[selectedForm.id]
      : selectedFormContent;
  const previewValues = useMemo(
    () => ({
      ...demoPrintValues,
      company: form.company || demoPrintValues.company,
      company_address: form.companyAddress || demoPrintValues.company_address,
      company_id: form.companyId || demoPrintValues.company_id,
      company_iban: form.companyIban || demoPrintValues.company_iban,
    }),
    [form.company, form.companyAddress, form.companyIban, form.companyId],
  );
  const selectedPreview = selectedForm
    ? renderPrintTemplate(
        selectedEditorContent,
        previewValues,
        selectedForm.contentFormat,
      )
    : '';
  const selectedLabelSize = selectedForm
    ? normalizeLabelSize(selectedForm.labelSize)
    : defaultLabelSize;
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

  useEffect(() => {
    printFormsRef.current = printForms;
  }, [printForms]);

  useEffect(() => {
    draftHtmlByFormIdRef.current = draftHtmlByFormId;
  }, [draftHtmlByFormId]);

  const updatePrintForms = (nextForms: PrintForm[]) => {
    onChange('printForms', normalizePrintFormsForView(nextForms));
  };

  const updateFormById = (formId: string, patch: Partial<PrintForm>) => {
    updatePrintForms(
      printFormsRef.current.map((printForm) =>
        printForm.id === formId ? { ...printForm, ...patch } : printForm,
      ),
    );
  };

  const updateSelectedForm = (patch: Partial<PrintForm>) => {
    if (!selectedForm) return;
    updateFormById(selectedForm.id, patch);
  };

  const updateSelectedFormPageSize = (pageSize: PrintForm['pageSize']) => {
    updateSelectedForm({
      pageSize,
      labelSize:
        pageSize === 'label'
          ? normalizeLabelSize(selectedForm?.labelSize)
          : selectedForm?.labelSize,
    });
  };

  const updateSelectedLabelPreset = (presetId: string) => {
    const preset = labelSizePresets.find((item) => item.id === presetId);
    updateSelectedForm({
      labelSize: preset
        ? {
            presetId: preset.id,
            widthMm: preset.widthMm,
            heightMm: preset.heightMm,
          }
        : {
            ...normalizeLabelSize(selectedForm?.labelSize),
            presetId: customLabelSizePresetId,
          },
    });
  };

  const updateSelectedLabelSize = (
    field: 'widthMm' | 'heightMm',
    value: number,
  ) => {
    updateSelectedForm({
      labelSize: {
        ...normalizeLabelSize(selectedForm?.labelSize),
        presetId: customLabelSizePresetId,
        [field]: value,
      },
    });
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
    setDraftHtmlByFormId((current) => {
      const next = { ...current };
      delete next[selectedForm.id];
      return next;
    });
    setSelectedFormId(nextForms[0]?.id ?? '');
  };

  const flushDraftToForm = (formId: string, content?: string) => {
    const nextContent = normalizeEditorHtml(
      content ?? draftHtmlByFormIdRef.current[formId] ?? '',
    );
    if (!nextContent.trim()) return;

    const currentForm = printFormsRef.current.find((printForm) => printForm.id === formId);
    if (!currentForm) return;
    if (currentForm.content === nextContent && currentForm.contentFormat === 'html') return;
    updateFormById(formId, { content: nextContent, contentFormat: 'html' });
  };

  const scheduleDraftPersist = (formId: string, content: string) => {
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      flushDraftToForm(formId, content);
      persistTimerRef.current = null;
    }, EDITOR_PERSIST_DEBOUNCE_MS);
  };

  const syncDraftContent = (formId: string, content: string, persist = true) => {
    setDraftHtmlByFormId((current) =>
      current[formId] === content ? current : { ...current, [formId]: content },
    );
    if (persist) {
      scheduleDraftPersist(formId, content);
    }
  };

  const updateEditorContent = (content: string) => {
    if (!selectedForm) return;
    syncDraftContent(selectedForm.id, content);
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(settingsTabStorageKey, activeTab);
    } catch {
      // Ignore localStorage write errors.
    }
  }, [activeTab]);

  useEffect(() => {
    if (!selectedForm) return;
    setDraftHtmlByFormId((current) =>
      current[selectedForm.id] !== undefined
        ? current
        : { ...current, [selectedForm.id]: selectedForm.content },
    );
  }, [selectedForm?.id, selectedFormContent]);

  useEffect(() => {
    if (!selectedForm || isHtmlMode || !editorRef.current) return;
    if (editorRef.current.innerHTML !== selectedEditorContent) {
      editorRef.current.innerHTML = selectedEditorContent;
    }
  }, [isHtmlMode, selectedEditorContent, selectedForm?.id]);

  useEffect(
    () => () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
      }
    },
    [],
  );

  const insertHtmlIntoEditor = (html: string) => {
    if (!selectedForm) return;

    if (isHtmlMode) {
      const nextContent = `${selectedEditorContent}${selectedEditorContent ? '\n' : ''}${html}`;
      syncDraftContent(selectedForm.id, nextContent);
      return;
    }

    editorRef.current?.focus();
    document.execCommand('insertHTML', false, html);
    const nextContent =
      normalizeEditorHtml(editorRef.current?.innerHTML ?? `${selectedEditorContent}${html}`);
    if (editorRef.current && editorRef.current.innerHTML !== nextContent) {
      editorRef.current.innerHTML = nextContent;
    }
    syncDraftContent(selectedForm.id, nextContent);
  };

  const insertVariable = (variable: string) => {
    insertHtmlIntoEditor(
      `<span class="settings-print-variable-token" contenteditable="false">{{${variable}}}</span>&nbsp;`,
    );
  };

  const runEditorCommand = (command: string, value?: string) => {
    if (!selectedForm || isHtmlMode) return;
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    const nextContent = normalizeEditorHtml(
      editorRef.current?.innerHTML ?? selectedEditorContent,
    );
    if (editorRef.current && editorRef.current.innerHTML !== nextContent) {
      editorRef.current.innerHTML = nextContent;
    }
    syncDraftContent(selectedForm.id, nextContent);
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

  const handleSubmit = () => {
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    Object.entries(draftHtmlByFormIdRef.current).forEach(([formId, content]) => {
      flushDraftToForm(formId, content);
    });
    onSubmit();
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
          onClick={handleSubmit}
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
                          updateSelectedFormPageSize(
                            event.target.value === 'label' ? 'label' : 'A4',
                          )
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
                  {selectedForm.pageSize === 'label' ? (
                    <div className="settings-print-options-row settings-label-size-row">
                      <label className="field">
                        <span>Label size</span>
                        <select
                          value={selectedLabelSize.presetId}
                          onChange={(event) =>
                            updateSelectedLabelPreset(event.target.value)
                          }
                        >
                          {labelSizePresets.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.label}
                            </option>
                          ))}
                          <option value={customLabelSizePresetId}>Custom</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Width, mm</span>
                        <input
                          type="number"
                          min={10}
                          max={120}
                          step={1}
                          value={selectedLabelSize.widthMm}
                          disabled={selectedLabelSize.presetId !== customLabelSizePresetId}
                          onChange={(event) =>
                            updateSelectedLabelSize('widthMm', Number(event.target.value))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Height, mm</span>
                        <input
                          type="number"
                          min={10}
                          max={120}
                          step={1}
                          value={selectedLabelSize.heightMm}
                          disabled={selectedLabelSize.presetId !== customLabelSizePresetId}
                          onChange={(event) =>
                            updateSelectedLabelSize('heightMm', Number(event.target.value))
                          }
                        />
                      </label>
                    </div>
                  ) : null}
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
                      {specialPrintBlockButtons.map((button) => (
                        <button
                          key={button.label}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => insertHtmlIntoEditor(button.html)}
                          disabled={isHtmlMode}
                        >
                          {button.label}
                        </button>
                      ))}
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
                        value={selectedEditorContent}
                        onChange={(event) => updateEditorContent(event.target.value)}
                        onBlur={() =>
                          selectedForm && flushDraftToForm(selectedForm.id, selectedEditorContent)
                        }
                      />
                    ) : (
                      <div
                        ref={editorRef}
                        className="settings-content-editable"
                        contentEditable
                        suppressContentEditableWarning
                        onInput={(event) =>
                          selectedForm &&
                          syncDraftContent(
                            selectedForm.id,
                            normalizeEditorHtml(event.currentTarget.innerHTML),
                          )
                        }
                        onBlur={() =>
                          selectedForm &&
                          flushDraftToForm(
                            selectedForm.id,
                            editorRef.current?.innerHTML ?? selectedEditorContent,
                          )
                        }
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
                  <PrintPreview html={selectedPreview} form={selectedForm} />
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
