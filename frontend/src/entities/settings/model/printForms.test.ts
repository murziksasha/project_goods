import { describe, expect, it } from 'vitest';
import type { PrintLayoutBlock } from './types';
import {
  createLayoutPrintForm,
  createPrintLayoutBlock,
  defaultDocumentContentMargins,
  defaultLabelContentMargins,
  defaultPrintForms,
  getWarehouseLabelTemplateData,
  normalizeContentMargins,
  normalizePrintFormsForView,
  normalizePrintLayoutBlocks,
  renderPrintLayout,
  renderPrintTemplate,
} from './printForms';

const templateData = {
  orderNumber: 'r000124',
  clientName: 'Ivan',
  clientPhone: '+380671112233',
  deviceName: 'iPhone',
  serialNumber: 'SN-1',
  article: 'IPH',
  total: '100 UAH',
  paid: '20 UAH',
  toPay: '80 UAH',
  note: 'Battery',
  managerName: 'Manager',
  masterName: 'Master',
  createdAt: '29.05.2026 10:30',
};

describe('renderPrintTemplate', () => {
  it('renders supported print variables', () => {
    expect(
      renderPrintTemplate(
        '{{orderNumber}} {{clientName}} {{deviceName}} {{total}} {{masterName}} {{customer_address}} {{customer_iban}}',
        {
          ...templateData,
          customer_address: 'Kyiv, Main street 1',
          customer_iban: 'UA123456789123456789123456789',
        },
      ),
    ).toContain('r000124 Ivan iPhone 100 UAH Master Kyiv, Main street 1 UA123456789123456789123456789');
  });

  it('renders English empty table fallbacks', () => {
    const rendered = renderPrintTemplate(
      '{{products_table}} {{services_table}}',
      templateData,
      'html',
    );

    expect(rendered).toContain('No products');
    expect(rendered).toContain('No services');
    expect(rendered).not.toContain('Р');
  });

  it('leaves unknown variables visible', () => {
    expect(
      renderPrintTemplate('Order {{orderNumber}} {{unknownValue}}', templateData),
    ).toContain('Order r000124 {{unknownValue}}');
  });

  it('renders tables and barcode without dropping surrounding html', () => {
    const rendered = renderPrintTemplate(
      '<section>{{products_table}}{{services_table}}{{barcode}}{{qrcode}}</section>',
      {
        ...templateData,
        products_table: '<table><tbody><tr><td>Display</td></tr></tbody></table>',
        services_table: '<table><tbody><tr><td>Install</td></tr></tbody></table>',
      },
      'html',
    );

    expect(rendered).toContain('<section>');
    expect(rendered).toContain('Display');
    expect(rendered).toContain('Install');
    expect(rendered).toContain('data-barcode-value="r000124"');
    expect(rendered).not.toContain('{{qrcode}}');
    expect(rendered).not.toContain('data-qrcode-value');
  });

  it('uses the explicit barcode value and renders label variables', () => {
    const rendered = renderPrintTemplate(
      '<div class="print-label">{{barcode}}<strong>{{labelCode}}</strong><span>{{labelTitle}}</span><span>{{labelContact}}</span></div>',
      {
        ...templateData,
        barcode: 'SN-ABC-1',
        labelCode: 'SN-ABC-1',
        labelTitle: 'Adapter <Fujitsu>',
        labelContact: '+380671112233',
      },
      'html',
    );

    expect(rendered).toContain('data-barcode-value="SN-ABC-1"');
    expect(rendered).toContain('<strong>SN-ABC-1</strong>');
    expect(rendered).toContain('Adapter &lt;Fujitsu&gt;');
    expect(rendered).toContain('+380671112233');
  });

  it('removes editor token wrappers from rendered output', () => {
    const rendered = renderPrintTemplate(
      '<div class="print-label"><span class="settings-print-variable-token" contenteditable="false">{{orderNumber}}</span>&nbsp;</div>',
      templateData,
      'html',
    );

    expect(rendered).toContain('<span class="print-order-number">r000124</span>');
    expect(rendered).not.toContain('settings-print-variable-token');
    expect(rendered).not.toContain('&nbsp;');
  });
});

describe('renderPrintLayout', () => {
  it('renders supported layout blocks to stable html', () => {
    const rendered = renderPrintLayout([
      { id: 'h', type: 'heading', level: 1, text: 'Order {{orderNumber}}' },
      { id: 'p', type: 'paragraph', level: 3, text: 'Client {{clientName}}' },
      {
        id: 'fields',
        type: 'fieldGrid',
        columns: 2,
        fields: [
          { label: 'Phone', value: '{{clientPhone}}' },
          { label: 'Total', value: '{{total}}' },
        ],
      },
      { id: 'products', type: 'lineItemsTable', kind: 'products', title: 'Products' },
      { id: 'services', type: 'lineItemsTable', kind: 'services', title: 'Services' },
      { id: 'invoice', type: 'invoiceItemsTable' },
      { id: 'code', type: 'barcode' },
      {
        id: 'custom-code',
        type: 'barcode',
        value: '{{labelCode}}',
        showValue: true,
        size: 'large',
      },
      { id: 'sign', type: 'signatures', left: 'Manager', right: 'Client' },
      { id: 'divider', type: 'divider' },
      { id: 'spacer', type: 'spacer', size: 'medium' },
      {
        id: 'cols',
        type: 'columns',
        columns: [
          { id: 'left', blocks: [{ id: 'left-text', type: 'paragraph', level: 3, text: '{{company}}' }] },
          { id: 'right', blocks: [{ id: 'right-text', type: 'paragraph', level: 3, text: '{{clientName}}' }] },
        ],
      },
    ]);

    expect(rendered).toContain('<div class="print-document">');
    expect(rendered).toContain('<h1 class="print-block-heading">Order {{orderNumber}}</h1>');
    expect(rendered).toContain('<p class="print-block-paragraph print-block-paragraph-level-3">Client {{clientName}}</p>');
    expect(rendered).toContain('{{products_table}}');
    expect(rendered).toContain('{{services_table}}');
    expect(rendered).toContain('{{invoice_items_table}}');
    expect(rendered).toContain('{{barcode}}');
    expect(rendered).toContain('print-code-row-large');
    expect(rendered).toContain('data-barcode-value="{{labelCode}}"');
    expect(rendered).toContain('<strong class="print-code-value">{{labelCode}}</strong>');
    expect(rendered).toContain('print-signatures');
    expect(rendered).toContain('print-columns');
  });

  it('escapes literal html while preserving variables', () => {
    const rendered = renderPrintLayout([
      { id: 'p', type: 'paragraph', level: 3, text: '<script>x</script> {{clientName}}' },
    ]);

    expect(rendered).toContain('&lt;script&gt;x&lt;/script&gt; {{clientName}}');
    expect(rendered).not.toContain('<script>');
  });

  it('renders paragraph level classes for font sizing', () => {
    const rendered = renderPrintLayout([
      { id: 'large', type: 'paragraph', level: 1, text: 'Large text' },
      { id: 'medium', type: 'paragraph', level: 2, text: 'Medium text' },
      { id: 'normal', type: 'paragraph', level: 3, text: 'Normal text' },
    ]);

    expect(rendered).toContain('print-block-paragraph-level-1');
    expect(rendered).toContain('print-block-paragraph-level-2');
    expect(rendered).toContain('print-block-paragraph-level-3');
  });

  it('defaults missing paragraph level to level 3 in rendered output', () => {
    const legacyParagraph = {
      id: 'legacy',
      type: 'paragraph',
      text: 'Legacy text',
    } as PrintLayoutBlock;

    const rendered = renderPrintLayout([legacyParagraph]);

    expect(rendered).toContain('print-block-paragraph-level-3');
  });
});

describe('normalizePrintLayoutBlocks', () => {
  it('adds default level 3 to legacy paragraph blocks', () => {
    const legacyParagraph = {
      id: 'legacy',
      type: 'paragraph',
      text: 'Legacy text',
    } as PrintLayoutBlock;

    const normalized = normalizePrintLayoutBlocks([legacyParagraph]);

    expect(normalized[0]).toMatchObject({ type: 'paragraph', level: 3 });
  });

  it('normalizes nested column paragraph blocks', () => {
    const normalized = normalizePrintLayoutBlocks([
      {
        id: 'cols',
        type: 'columns',
        columns: [
          {
            id: 'left',
            blocks: [{ id: 'left-text', type: 'paragraph', text: '{{company}}' } as PrintLayoutBlock],
          },
        ],
      },
    ]);

    expect(normalized[0]).toMatchObject({
      type: 'columns',
      columns: [{ blocks: [{ type: 'paragraph', level: 3 }] }],
    });
  });
});

describe('normalizeContentMargins', () => {
  it('clamps custom margins and keeps label defaults when missing', () => {
    expect(normalizeContentMargins(undefined, 'label')).toEqual(
      defaultLabelContentMargins,
    );
    expect(
      normalizeContentMargins(
        { topMm: 2, rightMm: 99, bottomMm: -1, leftMm: 3.2 },
        'label',
      ),
    ).toEqual({
      topMm: 2,
      rightMm: 60,
      bottomMm: 0,
      leftMm: 3.2,
    });
  });
});

describe('normalizePrintFormsForView', () => {
  it('normalizes legacy paragraph levels when loading layout forms', () => {
    const normalized = normalizePrintFormsForView([
      {
        id: 'legacy-paragraph',
        title: 'Legacy paragraph',
        type: 'custom',
        content: '<p>old</p>',
        contentFormat: 'html',
        layoutVersion: 1,
        layoutBlocks: [{ id: 'text', type: 'paragraph', text: 'Hello' } as PrintLayoutBlock],
        pageSize: 'A4',
        orientation: 'portrait',
        isActive: true,
        sortOrder: 10,
      },
    ]);

    expect(
      normalized.find((form) => form.id === 'legacy-paragraph')?.layoutBlocks?.[0],
    ).toMatchObject({ type: 'paragraph', level: 3 });
  });

  it('generates content from layout blocks', () => {
    const form = createLayoutPrintForm({
      id: 'custom-layout',
      title: 'Custom layout',
      type: 'custom',
      content: 'old html',
      contentFormat: 'html',
      layoutVersion: 1,
      layoutBlocks: [createPrintLayoutBlock('heading', 1)],
      pageSize: 'A4',
      orientation: 'portrait',
      isActive: true,
      sortOrder: 10,
    });
    const normalized = normalizePrintFormsForView([form]);

    expect(normalized.find((item) => item.id === 'custom-layout')?.content).toContain('New heading');
    expect(normalized.find((item) => item.id === 'custom-layout')?.content).not.toBe('old html');
  });

  it('keeps legacy custom html unchanged', () => {
    const normalized = normalizePrintFormsForView([
      {
        id: 'legacy-custom',
        title: 'Legacy custom',
        type: 'custom',
        content: '<div>{{orderNumber}}</div>',
        contentFormat: 'html',
        pageSize: 'A4',
        orientation: 'portrait',
        isActive: true,
        sortOrder: 10,
      },
    ]);

    expect(normalized.find((form) => form.id === 'legacy-custom')?.content).toBe('<div>{{orderNumber}}</div>');
    expect(normalized.find((form) => form.id === 'legacy-custom')?.layoutBlocks).toBeUndefined();
  });

  it('applies legacy label content margins by default', () => {
    const normalized = normalizePrintFormsForView([
      {
        id: 'barcode-custom',
        title: 'Barcode custom',
        type: 'barcode',
        content: '{{barcode}}',
        contentFormat: 'html',
        pageSize: 'label',
        orientation: 'portrait',
        isActive: true,
        sortOrder: 10,
      },
    ]);

    expect(
      normalized.find((form) => form.id === 'barcode-custom')?.contentMargins,
    ).toEqual(defaultLabelContentMargins);
  });

  it('applies zero document content margins by default', () => {
    const normalized = normalizePrintFormsForView([
      {
        id: 'receipt-custom',
        title: 'Receipt custom',
        type: 'receipt',
        content: '{{orderNumber}}',
        contentFormat: 'html',
        pageSize: 'A4',
        orientation: 'portrait',
        isActive: true,
        sortOrder: 10,
      },
    ]);

    expect(
      normalized.find((form) => form.id === 'receipt-custom')?.contentMargins,
    ).toEqual(defaultDocumentContentMargins);
  });

  it('adds the default label size to label forms', () => {
    const normalized = normalizePrintFormsForView([
      {
        id: 'barcode-custom',
        title: 'Barcode custom',
        type: 'barcode',
        content: '{{barcode}}',
        contentFormat: 'html',
        pageSize: 'label',
        orientation: 'portrait',
        isActive: true,
        sortOrder: 10,
      },
    ]);

    expect(normalized.find((form) => form.id === 'barcode-custom')?.labelSize).toEqual({
      presetId: '25x40',
      widthMm: 25,
      heightMm: 40,
    });
  });

  it('keeps the built-in barcode default horizontal and label-focused', () => {
    const barcode = normalizePrintFormsForView(defaultPrintForms).find(
      (form) => form.id === 'barcode',
    );

    expect(barcode?.pageSize).toBe('label');
    expect(barcode?.orientation).toBe('landscape');
    expect(barcode?.labelSize).toEqual({
      presetId: '40x25',
      widthMm: 40,
      heightMm: 25,
    });
    expect(barcode?.content).toContain('class="print-label"');
    expect(barcode?.content).not.toContain('class="print-document"');
    expect(barcode?.content).toContain('{{labelCode}}');
    expect(barcode?.content).toContain('{{labelTitle}}');
    expect(barcode?.content).toContain('{{labelContact}}');
  });

  it('adds warehouse-barcode form by copying layout settings from the current barcode form', () => {
    const normalized = normalizePrintFormsForView([
      {
        id: 'barcode',
        title: 'Штрих-код',
        type: 'barcode',
        content: '<div class="print-label">{{barcode}}</div>',
        contentFormat: 'html',
        layoutVersion: 1,
        layoutBlocks: [
          {
            id: 'barcode-code',
            type: 'barcode',
            value: '{{barcode}}',
            showValue: false,
            size: 'large',
          },
          {
            id: 'barcode-number',
            type: 'heading',
            level: 3,
            text: '{{labelCode}}',
            align: 'center',
          },
        ],
        pageSize: 'label',
        labelSize: { presetId: '58x40', widthMm: 58, heightMm: 40 },
        orientation: 'portrait',
        contentMargins: {
          topMm: 2.5,
          rightMm: 1.5,
          bottomMm: 2.5,
          leftMm: 1.5,
        },
        isActive: true,
        sortOrder: 60,
      },
    ]);

    const warehouseBarcode = normalized.find(
      (form) => form.id === 'warehouse-barcode',
    );

    expect(warehouseBarcode).toBeDefined();
    expect(warehouseBarcode?.labelSize).toEqual({
      presetId: '58x40',
      widthMm: 58,
      heightMm: 40,
    });
    expect(warehouseBarcode?.orientation).toBe('portrait');
    expect(warehouseBarcode?.contentMargins).toEqual({
      topMm: 2.5,
      rightMm: 1.5,
      bottomMm: 2.5,
      leftMm: 1.5,
    });
    expect(warehouseBarcode?.layoutBlocks?.[0]?.id).toBe('warehouse-barcode-code');
    expect(warehouseBarcode?.content).toContain('class="print-label"');
  });

  it('maps warehouse label template data from product serial fields', () => {
    expect(
      getWarehouseLabelTemplateData({
        name: 'Display module',
        article: 'ART-42',
        serialNumber: 'SN-12345',
      }),
    ).toEqual({
      barcode: 'SN-12345',
      labelCode: 'SN-12345',
      labelTitle: 'Display module',
      labelContact: 'ART-42',
    });
  });

  it('default Barcode form: page size label, 40x25mm, landscape, renders inside .print-label', () => {
    const forms = normalizePrintFormsForView(defaultPrintForms);
    const barcode = forms.find((f) => f.id === 'barcode');
    expect(barcode?.pageSize).toBe('label');
    expect(barcode?.labelSize?.widthMm).toBe(40);
    expect(barcode?.labelSize?.heightMm).toBe(25);
    expect(barcode?.orientation).toBe('landscape');
    expect(barcode?.content).toContain('class="print-label"');
  });

  it('updates the old built-in barcode form without replacing custom barcode forms', () => {
    const normalized = normalizePrintFormsForView([
      {
        id: 'barcode',
        title: 'Barcode',
        type: 'barcode',
        content: '<div class="print-label">{{barcode}}{{orderNumber}}{{clientPhone}}{{deviceName}}</div>',
        contentFormat: 'html',
        layoutVersion: 1,
        layoutBlocks: [
          { id: 'barcode-code', type: 'barcode' },
          { id: 'barcode-number', type: 'heading', level: 3, text: '{{orderNumber}}', align: 'center' },
        ],
        pageSize: 'label',
        labelSize: { presetId: '25x40', widthMm: 25, heightMm: 40 },
        orientation: 'portrait',
        isActive: true,
        sortOrder: 10,
      },
      {
        id: 'barcode-custom',
        title: 'Barcode custom',
        type: 'barcode',
        content: '<div>{{barcode}} custom</div>',
        contentFormat: 'html',
        pageSize: 'label',
        labelSize: { presetId: '25x40', widthMm: 25, heightMm: 40 },
        orientation: 'portrait',
        isActive: true,
        sortOrder: 15,
      },
    ]);

    expect(normalized.find((form) => form.id === 'barcode')?.content).toContain('{{labelCode}}');
    expect(normalized.find((form) => form.id === 'barcode')?.orientation).toBe('landscape');
    expect(normalized.find((form) => form.id === 'barcode-custom')?.content).toBe('<div>{{barcode}} custom</div>');
  });

  it('updates recognizable legacy standard forms only', () => {
    const normalized = normalizePrintFormsForView([
      {
        id: 'receipt',
        title: 'Квитанція',
        type: 'receipt',
        content: '<div>{{orderNumber}}</div>',
        contentFormat: 'html',
        pageSize: 'A4',
        orientation: 'portrait',
        isActive: true,
        sortOrder: 10,
      },
      {
        id: 'custom-receipt',
        title: 'Custom receipt',
        type: 'receipt',
        content: '<div>{{orderNumber}}</div>',
        contentFormat: 'html',
        pageSize: 'A4',
        orientation: 'portrait',
        isActive: true,
        sortOrder: 15,
      },
    ]);

    expect(normalized.find((form) => form.id === 'receipt')?.content).toContain('{{products_table}}');
    expect(normalized.find((form) => form.id === 'receipt')?.title).toBe('Receipt');
    expect(normalized.find((form) => form.id === 'custom-receipt')?.content).toBe('<div>{{orderNumber}}</div>');
  });

  it('keeps built-in defaults in English', () => {
    expect(defaultPrintForms.map((form) => form.title)).toEqual([
      'Receipt',
      'Check',
      'Warranty card',
      'Completion act',
      'Invoice',
      'Barcode',
      'Product barcode',
    ]);
    expect(defaultPrintForms.map((form) => form.content).join(' ')).not.toContain('Р');
  });

  it('keeps invoice defaults aligned with client requisites', () => {
    const invoice = normalizePrintFormsForView(defaultPrintForms).find(
      (form) => form.id === 'invoice',
    );

    expect(invoice?.content).toContain('{{customer_address}}');
    expect(invoice?.content).toContain('{{customer_reg_id}}');
    expect(invoice?.content).toContain('{{customer_iban}}');
  });
});
