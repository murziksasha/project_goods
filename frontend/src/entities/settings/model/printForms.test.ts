import { describe, expect, it } from 'vitest';
import {
  defaultPrintForms,
  normalizePrintFormsForView,
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

describe('normalizePrintFormsForView', () => {
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

  it('updates recognizable legacy standard forms only', () => {
    const normalized = normalizePrintFormsForView([
      {
        id: 'receipt',
        title: defaultPrintForms.find((form) => form.id === 'receipt')?.title ?? '',
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
    expect(normalized.find((form) => form.id === 'custom-receipt')?.content).toBe('<div>{{orderNumber}}</div>');
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
