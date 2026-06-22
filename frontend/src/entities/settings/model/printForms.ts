import type {
  PrintForm,
  PrintLayoutBlock,
  PrintLayoutField,
  PrintLayoutTableColumn,
  PrintLayoutTableRow,
} from './types';

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

export const defaultBarcodeLabelSize = {
  presetId: '40x25',
  widthMm: 40,
  heightMm: 25,
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

export const getOrientedLabelSize = (
  labelSize: NonNullable<PrintForm['labelSize']>,
  orientation: PrintForm['orientation'],
) =>
  orientation === 'landscape' && labelSize.heightMm > labelSize.widthMm
    ? {
        ...labelSize,
        widthMm: labelSize.heightMm,
        heightMm: labelSize.widthMm,
      }
    : labelSize;

export type PrintFormVariable =
  | 'id'
  | 'orderNumber'
  | 'labelCode'
  | 'labelTitle'
  | 'labelContact'
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
  | 'company_email'
  | 'company_site'
  | 'customer_reg_id'
  | 'customer_address'
  | 'customer_iban'
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
    title: 'Order',
    variables: [
      { key: 'id', label: 'Order ID' },
      { key: 'orderNumber', label: 'Order number' },
      { key: 'labelCode', label: 'Label code' },
      { key: 'labelTitle', label: 'Label title' },
      { key: 'labelContact', label: 'Label contact' },
      { key: 'date', label: 'Created date' },
      { key: 'createdAt', label: 'Created date and time' },
      { key: 'due_date', label: 'Due date' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    title: 'Client',
    variables: [
      { key: 'clientName', label: 'Client name' },
      { key: 'clientPhone', label: 'Client phone' },
      { key: 'customer_reg_id', label: 'Client registration ID' },
      { key: 'customer_address', label: 'Client address' },
      { key: 'customer_iban', label: 'Client IBAN' },
    ],
  },
  {
    title: 'Device',
    variables: [
      { key: 'deviceName', label: 'Device' },
      { key: 'serialNumber', label: 'Serial number' },
      { key: 'article', label: 'Article' },
      { key: 'defect', label: 'Defect' },
      { key: 'comment', label: 'Comment' },
      { key: 'note', label: 'Note' },
    ],
  },
  {
    title: 'Finance',
    variables: [
      { key: 'total', label: 'Total' },
      { key: 'paid', label: 'Paid' },
      { key: 'toPay', label: 'To pay' },
      { key: 'currency', label: 'Currency' },
      { key: 'discount', label: 'Discount' },
      { key: 'net_amount', label: 'Total without VAT' },
      { key: 'vat_amount', label: 'VAT' },
      { key: 'total_amount', label: 'Total with VAT' },
      { key: 'total_written', label: 'Total in words' },
    ],
  },
  {
    title: 'Team',
    variables: [
      { key: 'managerName', label: 'Manager' },
      { key: 'masterName', label: 'Master' },
    ],
  },
  {
    title: 'Company and warehouse',
    variables: [
      { key: 'company', label: 'Company name' },
      { key: 'company_address', label: 'Company address' },
      { key: 'company_id', label: 'Company registration ID' },
      { key: 'company_iban', label: 'Company IBAN' },
      { key: 'company_email', label: 'Company e-mail' },
      { key: 'company_site', label: 'Company site' },
      { key: 'warehouse', label: 'Warehouse' },
      { key: 'warehouse_address', label: 'Warehouse address' },
      { key: 'warehouse_phone', label: 'Warehouse phone' },
      { key: 'seller_occupation', label: 'Signer position' },
      { key: 'seller_name', label: 'Signer name' },
      { key: 'note_label', label: 'Note label' },
    ],
  },
  {
    title: 'Special blocks',
    variables: [
      { key: 'barcode', label: 'Barcode' },
      { key: 'products_table', label: 'Products' },
      { key: 'services_table', label: 'Services' },
      { key: 'invoice_items_table', label: 'Invoice items with VAT' },
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

const labelShell = (body: string) => `
  <div class="print-label">
    ${body}
  </div>
`;

const makeBlockId = (prefix: string, index: number) => `${prefix}-${index}`;

const alignClass = (align: 'left' | 'center' | 'right' | undefined) =>
  align && align !== 'left' ? ` print-align-${align}` : '';

export const clampTextLevel = (level: unknown): 1 | 2 | 3 =>
  level === 1 || level === 2 || level === 3 ? level : 3;

export const normalizePrintLayoutBlock = (block: PrintLayoutBlock): PrintLayoutBlock => {
  switch (block.type) {
    case 'heading':
      return { ...block, level: clampTextLevel(block.level) };
    case 'paragraph':
      return { ...block, level: clampTextLevel(block.level) };
    case 'columns':
      return {
        ...block,
        columns: block.columns.map((column) => ({
          ...column,
          blocks: column.blocks.map(normalizePrintLayoutBlock),
        })),
      };
    default:
      return block;
  }
};

export const normalizePrintLayoutBlocks = (blocks: PrintLayoutBlock[]) =>
  blocks.map(normalizePrintLayoutBlock);

const codeSizeClass = (
  size: 'compact' | 'standard' | 'large' | undefined,
) => (size && size !== 'standard' ? ` print-code-row-${size}` : '');

const renderInlineTemplate = (value: string) => escapeHtml(value).replace(
  /\{\{([a-zA-Z0-9_]+)\}\}/g,
  '{{$1}}',
).replace(/\r?\n/g, '<br>');

const renderFieldLabel = (label: string) =>
  label.trim() ? `<td>${renderInlineTemplate(label)}</td>` : '<td></td>';

const renderFieldValue = (value: string) =>
  `<td><strong>${renderInlineTemplate(value)}</strong></td>`;

const renderFieldRows = (fields: PrintLayoutField[], columns: number) => {
  const safeColumns = Math.max(1, Math.min(columns, 4));
  const rows: PrintLayoutField[][] = [];
  for (let index = 0; index < fields.length; index += safeColumns) {
    rows.push(fields.slice(index, index + safeColumns));
  }

  return rows
    .map((row) => {
      const cells = Array.from({ length: safeColumns }).flatMap((_, index) => {
        const field = row[index] ?? { label: '', value: '' };
        return [renderFieldLabel(field.label), renderFieldValue(field.value)];
      });
      return `<tr>${cells.join('')}</tr>`;
    })
    .join('');
};

const renderCustomTable = (
  columns: PrintLayoutTableColumn[],
  rows: PrintLayoutTableRow[],
) => {
  const safeColumns = columns.length > 0
    ? columns
    : [{ id: 'name', label: 'Name' }];
  const header = safeColumns
    .map((column) => `<th>${renderInlineTemplate(column.label)}</th>`)
    .join('');
  const bodyRows = (rows.length > 0
    ? rows
    : [{ id: 'row-1', cells: Object.fromEntries(safeColumns.map((column) => [column.id, ''])) }]
  )
    .map((row) =>
      `<tr>${safeColumns
        .map((column) => `<td>${renderInlineTemplate(row.cells[column.id] ?? '')}</td>`)
        .join('')}</tr>`,
    )
    .join('');

  return `<table class="print-line-table"><thead><tr>${header}</tr></thead><tbody>${bodyRows}</tbody></table>`;
};

const renderBarcodeBlock = (
  block: Extract<PrintLayoutBlock, { type: 'barcode' }>,
) => {
  const value = block.value?.trim() || '{{barcode}}';
  const barcode =
    value === '{{barcode}}'
      ? '{{barcode}}'
      : `<svg class="print-barcode" data-barcode-value="${renderInlineTemplate(value)}"></svg>`;
  const visibleValue = block.showValue
    ? `<strong class="print-code-value">${renderInlineTemplate(value)}</strong>`
    : '';

  return `<div class="print-code-row${codeSizeClass(block.size)}">${block.label ? `<span>${renderInlineTemplate(block.label)}</span>` : ''}${barcode}${visibleValue}</div>`;
};

export const renderPrintLayoutBlocks = (blocks: PrintLayoutBlock[]): string =>
  blocks
    .map((block) => {
      switch (block.type) {
        case 'heading': {
          const level = clampTextLevel(block.level);
          return `<h${level} class="print-block-heading${alignClass(block.align)}">${renderInlineTemplate(block.text)}</h${level}>`;
        }
        case 'paragraph': {
          const level = clampTextLevel(block.level);
          return `<p class="print-block-paragraph print-block-paragraph-level-${level}${alignClass(block.align)}">${renderInlineTemplate(block.text)}</p>`;
        }
        case 'fieldRow':
          return `<table class="print-details-table"><tbody>${renderFieldRows(block.fields, 2)}</tbody></table>`;
        case 'fieldGrid':
          return `<table class="print-details-table"><tbody>${renderFieldRows(block.fields, block.columns ?? 2)}</tbody></table>`;
        case 'customTable':
          return renderCustomTable(block.columns, block.rows);
        case 'lineItemsTable':
          return `${block.title ? `<h3>${renderInlineTemplate(block.title)}</h3>` : ''}${block.kind === 'services' ? '{{services_table}}' : '{{products_table}}'}`;
        case 'invoiceItemsTable':
          return `${block.title ? `<h3>${renderInlineTemplate(block.title)}</h3>` : ''}{{invoice_items_table}}`;
        case 'barcode':
          return renderBarcodeBlock(block);
        case 'signatures':
          return `<div class="print-signatures"><span>${renderInlineTemplate(block.left)}</span><span>${renderInlineTemplate(block.right)}</span></div>`;
        case 'divider':
          return '<hr class="print-divider" />';
        case 'spacer':
          return `<div class="print-spacer print-spacer-${block.size}"></div>`;
        case 'columns':
          return `<div class="print-columns">${block.columns
            .map((column) => `<div>${renderPrintLayoutBlocks(column.blocks)}</div>`)
            .join('')}</div>`;
        default:
          return '';
      }
    })
    .join('');

export const renderPrintLayout = (
  blocks: PrintLayoutBlock[],
  shell: 'document' | 'label' = 'document',
) => {
  const body = renderPrintLayoutBlocks(blocks);
  return shell === 'label' ? labelShell(body) : documentShell(body);
};

const detailsTable = `
  <table class="print-details-table">
    <tbody>
      <tr><td>Repair type:</td><td><strong>{{comment}}</strong></td><td>Device:</td><td><strong>{{deviceName}}</strong></td></tr>
      <tr><td>Customer:</td><td><strong>{{clientName}}</strong></td><td>Serial No.:</td><td><strong>{{serialNumber}}</strong></td></tr>
      <tr><td>Contact details:</td><td><strong>{{clientPhone}}</strong></td><td>Article:</td><td><strong>{{article}}</strong></td></tr>
      <tr><td>Reported defect:</td><td><strong>{{defect}}</strong></td><td>Prepayment:</td><td><strong>{{paid}}</strong></td></tr>
      <tr><td>Estimated cost:</td><td><strong>{{total}}</strong></td><td>To pay:</td><td><strong>{{toPay}}</strong></td></tr>
    </tbody>
  </table>
`;

const lineItemsSections = `
  <h3>Services</h3>
  {{services_table}}
  <h3>Products</h3>
  {{products_table}}
`;

export const defaultPrintForms: PrintForm[] = [
  {
    id: 'receipt',
    title: 'Receipt',
    type: 'receipt',
    content: documentShell(`
      <div class="print-header print-header-right">
        <div>
          <h2>{{company}}</h2>
          <p>{{warehouse_address}} {{warehouse_phone}}</p>
        </div>
      </div>
      <div class="print-title-row">
        <h1>Receipt #{{orderNumber}} from {{date}}</h1>
        <div class="print-code-block">{{barcode}}</div>
      </div>
      ${detailsTable}
      ${lineItemsSections}
      <ol class="print-terms">
        <li>The service center is not responsible for data loss in the device memory.</li>
        <li>Diagnostics takes 1 to 3 days. Repair starts after the cost is approved.</li>
        <li>Warranty applies only to completed work and installed parts.</li>
      </ol>
      <div class="print-signatures">
        <span>Accepted by: {{managerName}}</span>
        <span>Client: __________________</span>
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
    title: 'Check',
    type: 'check',
    content: documentShell(`
      <h1>Payment check</h1>
      <table class="print-summary-table">
        <tbody>
          <tr><td>Order</td><td>{{orderNumber}}</td></tr>
          <tr><td>Client</td><td>{{clientName}}</td></tr>
          <tr><td>Total</td><td><strong>{{total}}</strong></td></tr>
          <tr><td>Paid</td><td><strong>{{paid}}</strong></td></tr>
          <tr><td>To pay</td><td><strong>{{toPay}}</strong></td></tr>
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
    title: 'Warranty card',
    type: 'warranty',
    content: documentShell(`
      <h1>Warranty card</h1>
      <p>Order #{{orderNumber}} from {{date}}</p>
      ${detailsTable}
      ${lineItemsSections}
      <p><strong>Master:</strong> {{masterName}}</p>
      <p>Warranty is valid if there are no mechanical damages or third-party intervention traces.</p>
      <div class="print-signatures">
        <span>Service: __________________</span>
        <span>Client: __________________</span>
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
    title: 'Completion act',
    type: 'completion-act',
    content: documentShell(`
      <h1>Completion act #{{orderNumber}}</h1>
      <p>Date: {{date}}</p>
      <p><strong>Client:</strong> {{clientName}}, {{clientPhone}}</p>
      ${lineItemsSections}
      <p class="print-total-line">Total: <strong>{{total}}</strong></p>
      <div class="print-signatures">
        <span>Executor: {{masterName}}</span>
        <span>Customer: __________________</span>
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
    title: 'Invoice',
    type: 'invoice',
    content: documentShell(`
      <div class="invoice-party">
        <strong>Supplier</strong>
        <div>
          <b>{{company}}</b><br>
          Address: {{company_address}}<br>
          ID: {{company_id}}<br>
          Not a VAT payer<br>
          <b>Account {{company_iban}}</b>
        </div>
      </div>
      <div class="invoice-party">
        <strong>Customer</strong>
        <div>
          <b>{{clientName}}</b><br>
          Address: {{customer_address}}<br>
          ID: {{customer_reg_id}}<br>
          {{clientPhone}}<br>
          <b>Account {{customer_iban}}</b>
        </div>
      </div>
      <div class="invoice-title">
        <h1>Invoice #{{orderNumber}}</h1>
        <p>from {{date}}</p>
      </div>
      {{invoice_items_table}}
      <table class="invoice-totals">
        <tbody>
          <tr><td>Total without VAT:</td><td>{{net_amount}}</td></tr>
          <tr><td>VAT:</td><td>{{vat_amount}}</td></tr>
          <tr><td>Total with VAT:</td><td>{{total_amount}}</td></tr>
        </tbody>
      </table>
      <div class="invoice-written">
        <p>Total in words: <strong>{{total_written}}</strong></p>
        <p>VAT: {{vat_amount}}</p>
      </div>
      <div class="invoice-payable">
        <strong>Amount payable:</strong>
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
    title: 'Barcode',
    type: 'barcode',
    content: `
      <div class="print-label">
        <div class="print-label-code">{{barcode}}</div>
        <strong>{{labelCode}}</strong>
        <span>{{labelTitle}}</span>
        <span>{{labelContact}}</span>
      </div>
    `,
    contentFormat: 'html',
    pageSize: 'label',
    labelSize: defaultBarcodeLabelSize,
    orientation: 'landscape',
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

const legacyDefaultPrintFormTitles: Record<string, string[]> = {
  receipt: ['Квитанція', 'РљРІРёС‚Р°РЅС†С–СЏ'],
  check: ['Чек', 'Р§РµРє'],
  warranty: ['Гарантійний талон', 'Р“Р°СЂР°РЅС‚С–Р№РЅРёР№ С‚Р°Р»РѕРЅ'],
  'completion-act': ['Акт виконаних робіт', 'РђРєС‚ РІРёРєРѕРЅР°РЅРёС… СЂРѕР±С–С‚'],
  invoice: ['Рахунок', 'Р Р°С…СѓРЅРѕРє'],
  barcode: ['Штрих-код', 'РЁС‚СЂРёС…-РєРѕРґ'],
};

export const createPrintLayoutBlock = (
  type: PrintLayoutBlock['type'],
  index = Date.now(),
): PrintLayoutBlock => {
  const id = makeBlockId(type, index);
  switch (type) {
    case 'heading':
      return { id, type, level: 1, text: 'New heading', align: 'left' };
    case 'paragraph':
      return { id, type, level: 3, text: 'New text {{orderNumber}}', align: 'left' };
    case 'fieldRow':
      return {
        id,
        type,
        fields: [
          { label: 'Order', value: '{{orderNumber}}' },
          { label: 'Client', value: '{{clientName}}' },
        ],
      };
    case 'fieldGrid':
      return {
        id,
        type,
        columns: 2,
        fields: [
          { label: 'Phone', value: '{{clientPhone}}' },
          { label: 'Total', value: '{{total}}' },
          { label: 'Paid', value: '{{paid}}' },
          { label: 'To pay', value: '{{toPay}}' },
        ],
      };
    case 'customTable':
      return {
        id,
        type,
        columns: [
          { id: 'name', label: 'Name' },
          { id: 'qty', label: 'Qty' },
          { id: 'price', label: 'Price' },
          { id: 'sum', label: 'Sum' },
        ],
        rows: [
          {
            id: `${id}-row-1`,
            cells: {
              name: 'Item',
              qty: '1',
              price: '{{total}}',
              sum: '{{total}}',
            },
          },
        ],
      };
    case 'lineItemsTable':
      return { id, type, kind: 'products', title: 'Products' };
    case 'invoiceItemsTable':
      return { id, type, title: '' };
    case 'barcode':
      return { id, type, label: '', value: '{{barcode}}', showValue: false, size: 'standard' };
    case 'signatures':
      return {
        id,
        type,
        left: 'Manager: {{managerName}}',
        right: 'Client: __________________',
      };
    case 'divider':
      return { id, type };
    case 'spacer':
      return { id, type, size: 'medium' };
    case 'columns':
      return {
        id,
        type,
        columns: [
          { id: `${id}-left`, blocks: [createPrintLayoutBlock('paragraph', index + 1)] },
          { id: `${id}-right`, blocks: [createPrintLayoutBlock('paragraph', index + 2)] },
        ],
      };
    default:
      return { id, type: 'paragraph', level: 3, text: 'New text', align: 'left' };
  }
};

const receiptLayoutBlocks: PrintLayoutBlock[] = [
  {
    id: 'receipt-company',
    type: 'paragraph',
    level: 3,
    text: '{{company}}\n{{warehouse_address}} {{warehouse_phone}}',
    align: 'right',
  },
  { id: 'receipt-title', type: 'heading', level: 1, text: 'Receipt #{{orderNumber}} from {{date}}' },
  { id: 'receipt-barcode', type: 'barcode' },
  {
    id: 'receipt-details',
    type: 'fieldGrid',
    columns: 2,
    fields: [
      { label: 'Order', value: '{{orderNumber}}' },
      { label: 'Client', value: '{{clientName}}' },
      { label: 'Phone', value: '{{clientPhone}}' },
      { label: 'Device', value: '{{deviceName}}' },
      { label: 'Paid', value: '{{paid}}' },
      { label: 'To pay', value: '{{toPay}}' },
      { label: 'Total', value: '{{total}}' },
      { label: 'Manager', value: '{{managerName}}' },
    ],
  },
  { id: 'receipt-services', type: 'lineItemsTable', kind: 'services', title: 'Services' },
  { id: 'receipt-products', type: 'lineItemsTable', kind: 'products', title: 'Products' },
  {
    id: 'receipt-terms',
    type: 'paragraph',
    level: 3,
    text: 'Service center is not responsible for data loss. Diagnostics term is 1-3 days. Warranty covers completed works and installed parts.',
  },
  { id: 'receipt-signatures', type: 'signatures', left: 'Accepted by: {{managerName}}', right: 'Client: __________________' },
];

const checkLayoutBlocks: PrintLayoutBlock[] = [
  { id: 'check-title', type: 'heading', level: 1, text: 'Payment check' },
  {
    id: 'check-summary',
    type: 'fieldRow',
    fields: [
      { label: 'Order', value: '{{orderNumber}}' },
      { label: 'Client', value: '{{clientName}}' },
      { label: 'Total', value: '{{total}}' },
      { label: 'Paid', value: '{{paid}}' },
      { label: 'To pay', value: '{{toPay}}' },
    ],
  },
  { id: 'check-services', type: 'lineItemsTable', kind: 'services', title: 'Services' },
  { id: 'check-products', type: 'lineItemsTable', kind: 'products', title: 'Products' },
  { id: 'check-barcode', type: 'barcode' },
];

const warrantyLayoutBlocks: PrintLayoutBlock[] = [
  { id: 'warranty-title', type: 'heading', level: 1, text: 'Warranty card' },
  { id: 'warranty-order', type: 'paragraph', level: 3, text: 'Order #{{orderNumber}} from {{date}}' },
  {
    id: 'warranty-details',
    type: 'fieldGrid',
    columns: 2,
    fields: [
      { label: 'Client', value: '{{clientName}}' },
      { label: 'Phone', value: '{{clientPhone}}' },
      { label: 'Device', value: '{{deviceName}}' },
      { label: 'Serial', value: '{{serialNumber}}' },
      { label: 'Master', value: '{{masterName}}' },
      { label: 'Total', value: '{{total}}' },
    ],
  },
  { id: 'warranty-services', type: 'lineItemsTable', kind: 'services', title: 'Services' },
  { id: 'warranty-products', type: 'lineItemsTable', kind: 'products', title: 'Products' },
  { id: 'warranty-text', type: 'paragraph', level: 3, text: 'Warranty is valid if there are no mechanical damages or third-party intervention traces.' },
  { id: 'warranty-signatures', type: 'signatures', left: 'Service: __________________', right: 'Client: __________________' },
];

const completionActLayoutBlocks: PrintLayoutBlock[] = [
  { id: 'act-title', type: 'heading', level: 1, text: 'Completion act #{{orderNumber}}' },
  { id: 'act-date', type: 'paragraph', level: 3, text: 'Date: {{date}}' },
  { id: 'act-client', type: 'paragraph', level: 3, text: 'Client: {{clientName}}, {{clientPhone}}' },
  { id: 'act-services', type: 'lineItemsTable', kind: 'services', title: 'Services' },
  { id: 'act-products', type: 'lineItemsTable', kind: 'products', title: 'Products' },
  { id: 'act-total', type: 'paragraph', level: 3, text: 'Total: {{total}}', align: 'right' },
  { id: 'act-signatures', type: 'signatures', left: 'Executor: {{masterName}}', right: 'Customer: __________________' },
];

const invoiceLayoutBlocks: PrintLayoutBlock[] = [
  {
    id: 'invoice-parties',
    type: 'columns',
    columns: [
      {
        id: 'invoice-seller',
        blocks: [
          { id: 'invoice-seller-text', type: 'paragraph', level: 3, text: 'Supplier\n{{company}}\nAddress: {{company_address}}\nID: {{company_id}}\nIBAN: {{company_iban}}' },
        ],
      },
      {
        id: 'invoice-customer',
        blocks: [
          { id: 'invoice-customer-text', type: 'paragraph', level: 3, text: 'Customer\n{{clientName}}\nAddress: {{customer_address}}\nID: {{customer_reg_id}}\n{{clientPhone}}\nIBAN: {{customer_iban}}' },
        ],
      },
    ],
  },
  { id: 'invoice-title', type: 'heading', level: 1, text: 'Invoice #{{orderNumber}}', align: 'center' },
  { id: 'invoice-date', type: 'paragraph', level: 3, text: 'from {{date}}', align: 'center' },
  { id: 'invoice-items', type: 'invoiceItemsTable' },
  {
    id: 'invoice-totals',
    type: 'fieldRow',
    fields: [
      { label: 'Total without VAT', value: '{{net_amount}}' },
      { label: 'VAT', value: '{{vat_amount}}' },
      { label: 'Total with VAT', value: '{{total_amount}}' },
    ],
  },
  { id: 'invoice-written', type: 'paragraph', level: 3, text: 'Total in words: {{total_written}}\nVAT: {{vat_amount}}' },
  { id: 'invoice-payable', type: 'paragraph', level: 3, text: 'Amount payable: {{total_amount}}', align: 'right' },
  { id: 'invoice-signature', type: 'signatures', left: '{{seller_occupation}}', right: '{{seller_name}}' },
  { id: 'invoice-note', type: 'paragraph', level: 3, text: '{{note_label}}: {{note}}' },
];

const barcodeLayoutBlocks: PrintLayoutBlock[] = [
  { id: 'barcode-code', type: 'barcode', value: '{{barcode}}', showValue: false, size: 'large' },
  { id: 'barcode-number', type: 'heading', level: 3, text: '{{labelCode}}', align: 'center' },
  { id: 'barcode-title', type: 'paragraph', level: 3, text: '{{labelTitle}}', align: 'center' },
  { id: 'barcode-contact', type: 'paragraph', level: 3, text: '{{labelContact}}', align: 'center' },
];

export const defaultPrintLayouts: Record<string, PrintLayoutBlock[]> = {
  receipt: receiptLayoutBlocks,
  check: checkLayoutBlocks,
  warranty: warrantyLayoutBlocks,
  'completion-act': completionActLayoutBlocks,
  invoice: invoiceLayoutBlocks,
  barcode: barcodeLayoutBlocks,
};

export const getDefaultPrintLayoutBlocks = (formType: string) =>
  defaultPrintLayouts[formType]?.map((block) => ({ ...block })) ?? [
    createPrintLayoutBlock('heading', 1),
    createPrintLayoutBlock('fieldGrid', 2),
    createPrintLayoutBlock('signatures', 3),
  ];

export const createLayoutPrintForm = (form: PrintForm): PrintForm =>
  withGeneratedContent({
    ...form,
    layoutVersion: 1,
    layoutBlocks: normalizePrintLayoutBlocks(
      form.layoutBlocks?.length
        ? form.layoutBlocks
        : getDefaultPrintLayoutBlocks(form.type || form.id),
    ),
  });

const isBarcodeForm = (form: PrintForm) =>
  form.type === 'barcode' || form.id === 'barcode';

const withGeneratedContent = (form: PrintForm): PrintForm =>
  form.layoutBlocks && form.layoutBlocks.length > 0
    ? {
        ...form,
        layoutVersion: 1,
        content: renderPrintLayout(
          form.layoutBlocks,
          isBarcodeForm(form) ? 'label' : 'document',
        ),
        contentFormat: 'html',
      }
    : form;

const hasBuiltInDefaultTitle = (form: PrintForm) => {
  const defaultForm = defaultPrintForms.find((item) => item.id === form.id);
  return (
    form.title === defaultForm?.title ||
    (legacyDefaultPrintFormTitles[form.id] ?? []).includes(form.title)
  );
};

const isPreviousDefaultInvoice = (form: PrintForm) =>
  form.id === 'invoice' &&
  hasBuiltInDefaultTitle(form) &&
  (form.content.includes('<h1>Рахунок на оплату №{{orderNumber}}</h1>') ||
    form.content.includes('<h1>Р Р°С…СѓРЅРѕРє РЅР° РѕРїР»Р°С‚Рё в„–{{orderNumber}}</h1>') ||
    !form.content.includes('{{customer_address}}') ||
    !form.content.includes('{{customer_iban}}'));

const isPreviousDefaultBarcode = (form: PrintForm) =>
  form.id === 'barcode' &&
  hasBuiltInDefaultTitle(form) &&
  (!form.content.includes('{{labelCode}}') ||
    form.content.includes('{{orderNumber}}') ||
    form.content.includes('{{clientPhone}}') ||
    form.content.includes('{{deviceName}}'));

const isLegacyStandardPrintForm = (form: PrintForm) => {
  if (!legacyDefaultPrintFormIds.has(form.id)) return false;
  const defaultForm = defaultPrintForms.find((item) => item.id === form.id);
  if (!defaultForm || !hasBuiltInDefaultTitle(form)) return false;
  if (form.id === 'invoice' || form.id === 'barcode') return false;
  if (form.id === 'completion-act' && form.content.includes('{{deviceName}}')) return true;
  return !form.content.includes('{{products_table}}') ||
    !form.content.includes('{{services_table}}');
};

const isRecognizableDefaultPrintForm = (form: PrintForm) => {
  if (form.id === 'barcode') return false;
  const defaultForm = defaultPrintForms.find((item) => item.id === form.id);
  return Boolean(defaultForm) && hasBuiltInDefaultTitle(form);
};

const hasLayoutBlocks = (form: PrintForm) =>
  form.layoutVersion === 1 && Array.isArray(form.layoutBlocks) && form.layoutBlocks.length > 0;

export const createDefaultSettingsForm = () => ({
  serviceName: 'Service CRM',
  company: 'Service CRM',
  companyAddress: '',
  companyId: '',
  companyIban: '',
  companyEmail: '',
  companySite: '',
  printForms: defaultPrintForms.map(createLayoutPrintForm),
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
      const shouldUseDefaultLayout =
        isPreviousDefaultBarcode(form) ||
        (!hasLayoutBlocks(form) &&
          (isPreviousDefaultInvoice(form) ||
            isLegacyStandardPrintForm(form) ||
            isRecognizableDefaultPrintForm(form)));
      const normalizedForm = shouldUseDefaultLayout
        ? createLayoutPrintForm(defaultPrintForms.find((defaultForm) => defaultForm.id === form.id) ?? form)
        : hasLayoutBlocks(form)
          ? withGeneratedContent({
              ...form,
              layoutBlocks: normalizePrintLayoutBlocks(form.layoutBlocks ?? []),
            })
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
    ...defaultPrintForms
      .filter((form) => !existingIds.has(form.id))
      .map(createLayoutPrintForm),
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
  html || '<p class="print-muted">No products</p>';

const renderServicesTable = (html: string) =>
  html || '<p class="print-muted">No services</p>';

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
        `<svg class="print-barcode" data-barcode-value="${escapeHtml(values.barcode || values.orderNumber || values.id || '')}"></svg>`,
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
  .print-form { page-break-after: always; padding: 16mm; }
  .print-document { font-size: 13px; line-height: 1.45; }
  .print-document h1 { font-size: 22px; margin: 0 0 16px; font-weight: 500; }
  .print-document h2 { font-size: 18px; margin: 0 0 6px; }
  .print-document h3 { font-size: 15px; margin: 16px 0 8px; }
  .print-header-right { display: flex; justify-content: flex-end; text-align: right; }
  .print-title-row { display: flex; justify-content: space-between; gap: 20px; align-items: center; margin: 18px 0; }
  .print-code-block { min-width: 180px; text-align: center; }
  .print-code-row { display: flex; gap: 20px; align-items: center; margin-top: 16px; }
  .print-barcode { max-width: 220px; height: 52px; }
  .print-code-row-compact .print-barcode { height: 36px; max-width: 180px; }
  .print-code-row-large .print-barcode { height: 68px; max-width: 320px; }
  .print-code-value { font-family: Consolas, monospace; font-size: 13px; line-height: 1; }
  .print-details-table, .print-summary-table, .print-line-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  .print-details-table td, .print-summary-table td, .print-line-table th, .print-line-table td { border: 1px solid #d1d5db; padding: 5px 7px; vertical-align: top; }
  .print-line-table th { background: #f3f4f6; text-align: left; }
  .print-summary-table td:first-child { color: #4b5563; width: 55%; }
  .print-summary-right { margin-left: auto; max-width: 360px; }
  .print-terms { margin: 18px 0; padding-left: 20px; }
  .print-signatures { display: flex; justify-content: space-between; gap: 32px; margin-top: 28px; }
  .print-total-line { text-align: right; font-size: 16px; }
  .print-muted { color: #6b7280; }
  .print-align-center { text-align: center; }
  .print-align-right { text-align: right; }
  .print-block-paragraph { white-space: normal; }
  .print-document .print-block-paragraph-level-1 { font-size: 22px; }
  .print-document .print-block-paragraph-level-2 { font-size: 18px; }
  .print-document .print-block-paragraph-level-3 { font-size: 13px; }
  .print-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
  .print-divider { border: 0; border-top: 1px solid #d1d5db; margin: 14px 0; }
  .print-spacer-small { height: 6px; }
  .print-spacer-medium { height: 14px; }
  .print-spacer-large { height: 26px; }
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
  @media print {
    body { margin: 0; }
    .print-form { border: 0 !important; margin: 0 !important; padding: 0 !important; }
  }
`;

export const printLabelDocumentStyles = `
  html.print-html-label:not(.print-screen-preview), html.print-html-label:not(.print-screen-preview) body { width: var(--label-width, 25mm); height: var(--label-height, 40mm); margin: 0; overflow: hidden; }
  .print-body-label { width: var(--label-width, 25mm); height: var(--label-height, 40mm); margin: 0; overflow: hidden; }
  html.print-screen-preview, html.print-screen-preview body.print-screen-preview { width: auto; height: auto; min-width: 100%; min-height: 100%; overflow: auto; }
  body.print-screen-preview { box-sizing: border-box; margin: 0; padding: 18px; background: #9aa0a6; }
  .print-form-label { width: var(--label-width, 25mm); height: var(--label-height, 40mm); padding: 0; margin: 0; overflow: hidden; box-sizing: border-box; }
  .print-form-label .print-label { width: 100%; height: 100%; box-sizing: border-box; }
  body.print-screen-preview .print-form-label { margin: 0 auto 18px; background: #fff; box-shadow: 0 6px 18px rgba(15, 23, 42, 0.32); page-break-after: auto; zoom: 3.6; }
  .print-label { box-sizing: border-box; width: var(--label-width, 25mm); height: var(--label-height, 40mm); display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 0.2mm; overflow: hidden; padding: 0.45mm 1.25mm 0.45mm; text-align: center; font-size: 8px; line-height: 1.1; }
  .print-label-code { width: 100%; display: flex; justify-content: center; }
  .print-label-code .print-barcode { width: calc(var(--label-width, 25mm) - 2.5mm); max-width: 100%; height: 11.6mm; }
  .print-label .print-code-row { width: 100%; margin: 0; justify-content: center; }
  .print-label .print-code-row-compact .print-barcode { height: 9mm; }
  .print-label .print-code-row-standard .print-barcode { height: 10.4mm; }
  .print-label .print-code-row-large .print-barcode { height: 11.6mm; }
  .print-label .print-code-value { width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 8px; }
  .print-label .print-order-number { display: block; font-size: 12px; font-weight: 800; line-height: 1; }
  .print-label .print-block-heading { width: 100%; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 800; line-height: 1; }
  .print-label .print-block-paragraph { width: 100%; margin: 0; min-height: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 8.2px; line-height: 1; }
  .print-label .print-block-paragraph-level-1 { font-size: 12px; }
  .print-label .print-block-paragraph-level-2 { font-size: 10px; }
  .print-label .print-block-paragraph-level-3 { font-size: 8.2px; }
  .print-label strong { display: block; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; line-height: 1; }
  .print-label span { display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .print-label span:empty, .print-label .print-block-paragraph:empty { display: none; }
  @media print {
    body.print-screen-preview { padding: 0; background: #fff; }
    .print-form-label { padding: 0 !important; margin: 0 !important; }
    body.print-screen-preview .print-form-label { box-shadow: none; margin: 0; zoom: 1; }
    .print-form-label { page-break-after: always; }
  }
`;
