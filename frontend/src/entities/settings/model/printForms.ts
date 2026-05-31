import type { PrintForm } from './types';

export type LabelSizePreset = {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
};

export const defaultLabelSize = {
  presetId: '25x40',
  widthMm: 25,
  heightMm: 40,
};

export const labelSizePresets: LabelSizePreset[] = [
  { id: '25x40', label: '25 x 40 mm', widthMm: 25, heightMm: 40 },
  { id: '40x25', label: '40 x 25 mm', widthMm: 40, heightMm: 25 },
  { id: '30x20', label: '30 x 20 mm', widthMm: 30, heightMm: 20 },
  { id: '58x40', label: '58 x 40 mm', widthMm: 58, heightMm: 40 },
  { id: '58x30', label: '58 x 30 mm', widthMm: 58, heightMm: 30 },
];

export const customLabelSizePresetId = 'custom';
export const minLabelSizeMm = 10;
export const maxLabelSizeMm = 120;

const clampLabelSize = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minLabelSizeMm), maxLabelSizeMm);
};

export const normalizeLabelSize = (
  labelSize: PrintForm['labelSize'] | undefined,
) => {
  const preset = labelSizePresets.find(
    (item) => item.id === labelSize?.presetId,
  );

  if (preset) {
    return {
      presetId: preset.id,
      widthMm: preset.widthMm,
      heightMm: preset.heightMm,
    };
  }

  if (labelSize?.presetId === customLabelSizePresetId) {
    return {
      presetId: customLabelSizePresetId,
      widthMm: clampLabelSize(labelSize.widthMm, defaultLabelSize.widthMm),
      heightMm: clampLabelSize(labelSize.heightMm, defaultLabelSize.heightMm),
    };
  }

  return defaultLabelSize;
};

export type PrintFormVariable =
  | 'id'
  | 'orderNumber'
  | 'date'
  | 'createdAt'
  | 'status'
  | 'clientName'
  | 'clientPhone'
  | 'deviceName'
  | 'serialNumber'
  | 'article'
  | 'defect'
  | 'comment'
  | 'total'
  | 'paid'
  | 'toPay'
  | 'currency'
  | 'discount'
  | 'managerName'
  | 'masterName'
  | 'company'
  | 'warehouse'
  | 'warehouse_address'
  | 'warehouse_phone'
  | 'company_address'
  | 'company_id'
  | 'company_iban'
  | 'customer_reg_id'
  | 'due_date'
  | 'net_amount'
  | 'vat_amount'
  | 'total_amount'
  | 'total_written'
  | 'seller_occupation'
  | 'seller_name'
  | 'note_label'
  | 'barcode'
  | 'products_table'
  | 'services_table'
  | 'invoice_items_table'
  | 'note';

export type PrintTemplateData = Partial<Record<PrintFormVariable, string>> &
  Record<string, string | undefined>;

export const printFormVariableGroups: Array<{
  title: string;
  variables: Array<{ key: PrintFormVariable; label: string }>;
}> = [
  {
    title: 'Замовлення',
    variables: [
      { key: 'id', label: 'ID замовлення' },
      { key: 'orderNumber', label: 'Номер замовлення' },
      { key: 'date', label: 'Дата створення' },
      { key: 'createdAt', label: 'Дата та час створення' },
      { key: 'due_date', label: 'Сплатити до' },
      { key: 'status', label: 'Статус' },
    ],
  },
  {
    title: 'Клієнт',
    variables: [
      { key: 'clientName', label: 'ПІБ або назва клієнта' },
      { key: 'clientPhone', label: 'Телефон клієнта' },
      { key: 'customer_reg_id', label: 'ЄДРПОУ або ІПН клієнта' },
    ],
  },
  {
    title: 'Пристрій',
    variables: [
      { key: 'deviceName', label: 'Пристрій' },
      { key: 'serialNumber', label: 'Серійний номер' },
      { key: 'article', label: 'Артикул' },
      { key: 'defect', label: 'Несправність' },
      { key: 'comment', label: 'Коментар' },
      { key: 'note', label: 'Примітка' },
    ],
  },
  {
    title: 'Фінанси',
    variables: [
      { key: 'total', label: 'Сума' },
      { key: 'paid', label: 'Сплачено' },
      { key: 'toPay', label: 'До сплати' },
      { key: 'currency', label: 'Валюта' },
      { key: 'discount', label: 'Знижка' },
      { key: 'net_amount', label: 'Разом без ПДВ' },
      { key: 'vat_amount', label: 'ПДВ' },
      { key: 'total_amount', label: 'Всього з ПДВ' },
      { key: 'total_written', label: 'Сума прописом' },
    ],
  },
  {
    title: 'Команда',
    variables: [
      { key: 'managerName', label: 'Менеджер' },
      { key: 'masterName', label: 'Майстер' },
    ],
  },
  {
    title: 'Сервіс і склад',
    variables: [
      { key: 'company', label: 'Назва компанії' },
      { key: 'company_address', label: 'Адреса компанії' },
      { key: 'company_id', label: 'ЄДРПОУ або ІПН компанії' },
      { key: 'company_iban', label: 'IBAN компанії' },
      { key: 'warehouse', label: 'Склад' },
      { key: 'warehouse_address', label: 'Адреса складу' },
      { key: 'warehouse_phone', label: 'Телефон складу' },
      { key: 'seller_occupation', label: 'Посада підписанта' },
      { key: 'seller_name', label: 'ПІБ підписанта' },
      { key: 'note_label', label: 'Назва примітки' },
    ],
  },
  {
    title: 'Спец-блоки',
    variables: [
      { key: 'barcode', label: 'Штрих-код' },
      { key: 'products_table', label: 'Товари' },
      { key: 'services_table', label: 'Послуги' },
      { key: 'invoice_items_table', label: 'Позиції рахунку з ПДВ' },
    ],
  },
];

export const printFormVariables = printFormVariableGroups.flatMap((group) =>
  group.variables.map((variable) => variable.key),
);

const documentShell = (body: string) => `
  <div class="print-document">
    ${body}
  </div>
`;

const detailsTable = `
  <table class="print-details-table">
    <tbody>
      <tr><td>Вид ремонту:</td><td><strong>{{comment}}</strong></td><td>Пристрій:</td><td><strong>{{deviceName}}</strong></td></tr>
      <tr><td>Замовник:</td><td><strong>{{clientName}}</strong></td><td>Серійний №:</td><td><strong>{{serialNumber}}</strong></td></tr>
      <tr><td>Контактні дані:</td><td><strong>{{clientPhone}}</strong></td><td>Артикул:</td><td><strong>{{article}}</strong></td></tr>
      <tr><td>Заявлена несправність:</td><td><strong>{{defect}}</strong></td><td>Передплата:</td><td><strong>{{paid}}</strong></td></tr>
      <tr><td>Орієнтована вартість:</td><td><strong>{{total}}</strong></td><td>До сплати:</td><td><strong>{{toPay}}</strong></td></tr>
    </tbody>
  </table>
`;

const lineItemsSections = `
  <h3>Послуги</h3>
  {{services_table}}
  <h3>Товари</h3>
  {{products_table}}
`;

export const defaultPrintForms: PrintForm[] = [
  {
    id: 'receipt',
    title: 'Квитанція',
    type: 'receipt',
    content: documentShell(`
      <div class="print-header print-header-right">
        <div>
          <h2>{{company}}</h2>
          <p>{{warehouse_address}} {{warehouse_phone}}</p>
        </div>
      </div>
      <div class="print-title-row">
        <h1>Квитанція №{{orderNumber}} від {{date}}</h1>
        <div class="print-code-block">{{barcode}}</div>
      </div>
      ${detailsTable}
      ${lineItemsSections}
      <ol class="print-terms">
        <li>Сервісний центр не несе відповідальності за втрату даних в індивідуальній пам'яті пристрою.</li>
        <li>Термін проведення діагностики - від 1 до 3-х днів. Ремонт проводиться після погодження вартості.</li>
        <li>Гарантія поширюється тільки на виконані роботи та встановлені деталі.</li>
      </ol>
      <div class="print-signatures">
        <span>Прийняв: {{managerName}}</span>
        <span>Клієнт: __________________</span>
      </div>
    `),
    contentFormat: 'html',
    pageSize: 'A4',
    orientation: 'portrait',
    isActive: true,
    sortOrder: 10,
  },
  {
    id: 'check',
    title: 'Чек',
    type: 'check',
    content: documentShell(`
      <h1>Чек оплати</h1>
      <table class="print-summary-table">
        <tbody>
          <tr><td>Замовлення</td><td>{{orderNumber}}</td></tr>
          <tr><td>Клієнт</td><td>{{clientName}}</td></tr>
          <tr><td>Сума</td><td><strong>{{total}}</strong></td></tr>
          <tr><td>Сплачено</td><td><strong>{{paid}}</strong></td></tr>
          <tr><td>До сплати</td><td><strong>{{toPay}}</strong></td></tr>
        </tbody>
      </table>
      ${lineItemsSections}
      <div class="print-code-row">{{barcode}}</div>
    `),
    contentFormat: 'html',
    pageSize: 'A4',
    orientation: 'portrait',
    isActive: true,
    sortOrder: 20,
  },
  {
    id: 'warranty',
    title: 'Гарантійний талон',
    type: 'warranty',
    content: documentShell(`
      <h1>Гарантійний талон</h1>
      <p>Замовлення №{{orderNumber}} від {{date}}</p>
      ${detailsTable}
      ${lineItemsSections}
      <p><strong>Майстер:</strong> {{masterName}}</p>
      <p>Гарантійні зобов'язання діють за умови відсутності механічних пошкоджень та слідів стороннього втручання.</p>
      <div class="print-signatures">
        <span>Сервіс: __________________</span>
        <span>Клієнт: __________________</span>
      </div>
    `),
    contentFormat: 'html',
    pageSize: 'A4',
    orientation: 'portrait',
    isActive: true,
    sortOrder: 30,
  },
  {
    id: 'completion-act',
    title: 'Акт виконаних робіт',
    type: 'completion-act',
    content: documentShell(`
      <h1>Акт виконаних робіт №{{orderNumber}}</h1>
      <p>Дата: {{date}}</p>
      <p><strong>Клієнт:</strong> {{clientName}}, {{clientPhone}}</p>
      ${lineItemsSections}
      <p class="print-total-line">Разом: <strong>{{total}}</strong></p>
      <div class="print-signatures">
        <span>Виконавець: {{masterName}}</span>
        <span>Замовник: __________________</span>
      </div>
    `),
    contentFormat: 'html',
    pageSize: 'A4',
    orientation: 'portrait',
    isActive: true,
    sortOrder: 40,
  },
  {
    id: 'invoice',
    title: 'Рахунок',
    type: 'invoice',
    content: documentShell(`
      <div class="invoice-party">
        <strong>Постачальник</strong>
        <div>
          <b>{{company}}</b><br>
          Адреса: {{company_address}}<br>
          ЄДРПОУ або ІПН: {{company_id}}<br>
          не є платником податку на прибуток на загальних умовах<br>
          <b>Р/р {{company_iban}}</b>
        </div>
      </div>
      <div class="invoice-party">
        <strong>Одержувач</strong>
        <div>
          <b>{{clientName}}</b><br>
          ЄДРПОУ або ІПН: {{customer_reg_id}}<br>
          {{clientPhone}}<br>
          {{warehouse_address}}
        </div>
      </div>
      <div class="invoice-title">
        <h1>Рахунок фактура № {{orderNumber}}</h1>
        <p>від {{date}} р.</p>
      </div>
      {{invoice_items_table}}
      <table class="invoice-totals">
        <tbody>
          <tr><td>Разом без ПДВ:</td><td>{{net_amount}}</td></tr>
          <tr><td>ПДВ:</td><td>{{vat_amount}}</td></tr>
          <tr><td>Всього з ПДВ:</td><td>{{total_amount}}</td></tr>
        </tbody>
      </table>
      <div class="invoice-written">
        <p>Всього на суму: <strong>{{total_written}}</strong></p>
        <p>ПДВ: {{vat_amount}}</p>
      </div>
      <div class="invoice-payable">
        <strong>Загальна сума до оплати:</strong>
        <strong>{{total_amount}}</strong>
      </div>
      <div class="invoice-signature">
        <strong><em>{{seller_occupation}}</em></strong>
        <span></span>
        <strong><em>{{seller_name}}</em></strong>
      </div>
      <p class="invoice-note"><strong>{{note_label}}:</strong> {{note}}</p>
    `),
    contentFormat: 'html',
    pageSize: 'A4',
    orientation: 'portrait',
    isActive: true,
    sortOrder: 50,
  },
  {
    id: 'barcode',
    title: 'Штрих-код',
    type: 'barcode',
    content: `
      <div class="print-label">
        <div class="print-label-code">{{barcode}}</div>
        <strong>{{orderNumber}}</strong>
        <span>{{clientPhone}}</span>
        <span>{{deviceName}}</span>
      </div>
    `,
    contentFormat: 'html',
    pageSize: 'label',
    labelSize: defaultLabelSize,
    orientation: 'portrait',
    isActive: true,
    sortOrder: 60,
  },
];

export const legacyDefaultPrintFormIds = new Set([
  'receipt',
  'check',
  'warranty',
  'completion-act',
  'invoice',
  'barcode',
]);

const isPreviousDefaultInvoice = (form: PrintForm) =>
  form.id === 'invoice' &&
  form.title === 'Рахунок' &&
  form.content.includes('<h1>Рахунок на оплату №{{orderNumber}}</h1>');

const isLegacyStandardPrintForm = (form: PrintForm) => {
  if (!legacyDefaultPrintFormIds.has(form.id)) return false;
  const defaultForm = defaultPrintForms.find((item) => item.id === form.id);
  if (!defaultForm || form.title !== defaultForm.title) return false;
  if (form.id === 'invoice' || form.id === 'barcode') return false;
  if (form.id === 'completion-act' && form.content.includes('{{deviceName}}')) return true;
  return !form.content.includes('{{products_table}}') ||
    !form.content.includes('{{services_table}}');
};

export const createDefaultSettingsForm = () => ({
  serviceName: 'Service CRM',
  company: 'Service CRM',
  companyAddress: '',
  companyId: '',
  companyIban: '',
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

export const normalizePrintFormsForView = (forms: PrintForm[]) => {
  const normalized = (forms.length > 0 ? forms : defaultPrintForms).map(
    (form, index) => {
      const normalizedForm = isPreviousDefaultInvoice(form) || isLegacyStandardPrintForm(form)
        ? defaultPrintForms.find((defaultForm) => defaultForm.id === form.id) ?? form
        : form;

      const pageSize =
        normalizedForm.pageSize ??
        (normalizedForm.type === 'barcode' ? 'label' : 'A4');

      return {
        ...normalizedForm,
        contentFormat: normalizedForm.contentFormat ?? 'text',
        pageSize,
        labelSize:
          pageSize === 'label'
            ? normalizeLabelSize(normalizedForm.labelSize)
            : normalizedForm.labelSize,
        orientation: normalizedForm.orientation ?? 'portrait',
        sortOrder: Number.isFinite(normalizedForm.sortOrder)
          ? normalizedForm.sortOrder
          : (index + 1) * 10,
      };
    },
  );

  const existingIds = new Set(normalized.map((form) => form.id));
  const withMissingDefaults = [
    ...normalized,
    ...defaultPrintForms.filter((form) => !existingIds.has(form.id)),
  ];

  return withMissingDefaults.sort((first, second) => first.sortOrder - second.sortOrder);
};

export const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const textToHtml = (value: string) =>
  `<div class="print-document">${escapeHtml(value).replace(/\r?\n/g, '<br />')}</div>`;

const renderProductsTable = (html: string) =>
  html || '<p class="print-muted">Товари відсутні</p>';

const renderServicesTable = (html: string) =>
  html || '<p class="print-muted">Послуги відсутні</p>';

const unwrapEditorTokens = (html: string) =>
  html.replace(
    /<span\b(?=[^>]*\bsettings-print-variable-token\b)[^>]*>(.*?)<\/span>(?:&nbsp;)?/gi,
    '$1',
  );

export const renderPrintTemplate = (
  template: string,
  values: PrintTemplateData,
  contentFormat: PrintForm['contentFormat'] = 'text',
) => {
  const source =
    contentFormat === 'html' ? unwrapEditorTokens(template) : textToHtml(template);
  const isLabelTemplate = source.includes('print-label');

  const rendered = printFormVariables.reduce((result, key) => {
    if (key === 'barcode') {
      return result.replaceAll(
        '{{barcode}}',
        `<svg class="print-barcode" data-barcode-value="${escapeHtml(values.orderNumber || values.id || '')}"></svg>`,
      );
    }
    if (key === 'products_table') {
      return result.replaceAll('{{products_table}}', renderProductsTable(values.products_table ?? ''));
    }
    if (key === 'services_table') {
      return result.replaceAll('{{services_table}}', renderServicesTable(values.services_table ?? ''));
    }
    if (key === 'invoice_items_table') {
      return result.replaceAll(
        '{{invoice_items_table}}',
        renderProductsTable(values.invoice_items_table ?? ''),
      );
    }
    if (key === 'orderNumber') {
      return result.replaceAll(
        '{{orderNumber}}',
        isLabelTemplate
          ? `<span class="print-order-number">${escapeHtml(values.orderNumber ?? '')}</span>`
          : escapeHtml(values.orderNumber ?? ''),
      );
    }

    return result.replaceAll(`{{${key}}}`, escapeHtml(values[key] ?? ''));
  }, source);

  return rendered.replaceAll('{{qrcode}}', '');
};

export const printDocumentStyles = `
  body { font-family: Arial, sans-serif; color: #1f2937; background: #fff; }
  .print-body-label { width: var(--label-width, 25mm); height: var(--label-height, 40mm); margin: 0; overflow: hidden; }
  .print-form { page-break-after: always; padding: 16mm; }
  .print-form-label { width: var(--label-width, 25mm); height: var(--label-height, 40mm); padding: 0; overflow: hidden; }
  .print-document { font-size: 13px; line-height: 1.45; }
  .print-document h1 { font-size: 22px; margin: 0 0 16px; font-weight: 500; }
  .print-document h2 { font-size: 18px; margin: 0 0 6px; }
  .print-document h3 { font-size: 15px; margin: 16px 0 8px; }
  .print-header-right { display: flex; justify-content: flex-end; text-align: right; }
  .print-title-row { display: flex; justify-content: space-between; gap: 20px; align-items: center; margin: 18px 0; }
  .print-code-block { min-width: 180px; text-align: center; }
  .print-code-row { display: flex; gap: 20px; align-items: center; margin-top: 16px; }
  .print-barcode { max-width: 220px; height: 52px; }
  .print-details-table, .print-summary-table, .print-line-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  .print-details-table td, .print-summary-table td, .print-line-table th, .print-line-table td { border: 1px solid #d1d5db; padding: 5px 7px; vertical-align: top; }
  .print-line-table th { background: #f3f4f6; text-align: left; }
  .print-summary-table td:first-child { color: #4b5563; width: 55%; }
  .print-summary-right { margin-left: auto; max-width: 360px; }
  .print-terms { margin: 18px 0; padding-left: 20px; }
  .print-signatures { display: flex; justify-content: space-between; gap: 32px; margin-top: 28px; }
  .print-total-line { text-align: right; font-size: 16px; }
  .print-muted { color: #6b7280; }
  .print-label { box-sizing: border-box; width: var(--label-width, 25mm); height: var(--label-height, 40mm); display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 0.6mm; overflow: hidden; padding: 1.5mm; text-align: center; font-size: 8px; line-height: 1.1; }
  .print-label-code { width: 100%; display: flex; justify-content: center; }
  .print-label-code .print-barcode { width: calc(var(--label-width, 25mm) - 3mm); max-width: 100%; height: 10mm; }
  .print-label .print-order-number { display: block; font-size: 12px; font-weight: 800; line-height: 1; }
  .print-label strong { font-size: 16px; line-height: 1; }
  .print-label span { display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .invoice-party { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 10px; margin-bottom: 18px; font-size: 12px; }
  .invoice-party > strong { text-decoration: underline; }
  .invoice-title { margin: 26px 0 14px; text-align: center; }
  .invoice-title h1 { margin: 0; font-size: 17px; font-weight: 800; }
  .invoice-title p { margin: 2px 0 0; font-weight: 800; }
  .invoice-items-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; }
  .invoice-items-table th, .invoice-items-table td { border: 1px solid #777; padding: 5px 6px; vertical-align: top; }
  .invoice-items-table th { background: #d7d5d5; text-align: center; font-weight: 800; }
  .invoice-items-table td:nth-child(1), .invoice-items-table td:nth-child(n+3) { text-align: right; }
  .invoice-items-table td:nth-child(2) { text-align: left; }
  .invoice-item-description { display: block; margin-top: 2px; font-size: 10px; font-weight: 400; }
  .invoice-totals { width: 260px; margin: 14px 0 26px auto; border-collapse: collapse; font-size: 12px; font-weight: 800; }
  .invoice-totals td { padding: 3px 0 3px 12px; border: 0; text-align: right; }
  .invoice-written { margin-top: 18px; font-size: 12px; }
  .invoice-payable { display: grid; grid-template-columns: minmax(0, 1fr) 180px; gap: 20px; margin-top: 64px; font-size: 13px; }
  .invoice-signature { display: grid; grid-template-columns: 120px 1fr 220px; align-items: end; gap: 16px; margin-top: 24px; font-size: 12px; }
  .invoice-signature span { border-bottom: 1px solid #333; height: 18px; }
  .invoice-note { margin-top: 44px; font-size: 11px; }
  @page { size: A4 portrait; margin: 12mm; }
  @media print {
    body { margin: 0; }
    .print-form { border: 0 !important; margin: 0 !important; }
    .print-form-label { page-break-after: always; }
  }
`;
