import { describe, expect, it } from 'vitest';
import type { Sale } from '../../../entities/sale/model/types';
import {
  buildOrderPrintHtml,
  getPrintTemplateData,
  isIssueWithoutPaymentBlockedForSale,
  isRepairStatusChangeLockedByStock,
  type OrderLineItem,
} from './orders-workspace-shared';

const repairProductLineItems: OrderLineItem[] = [
  {
    id: 'line-product-1',
    kind: 'product',
    productId: 'product-1',
    name: 'Wireless mouse M22',
    price: 500,
    quantity: 1,
    warrantyPeriod: 0,
    serialNumbers: ['S000003'],
  },
  {
    id: 'line-product-2',
    kind: 'product',
    productId: 'product-2',
    name: 'Wireless mouse M22',
    price: 500,
    quantity: 1,
    warrantyPeriod: 0,
    serialNumbers: ['S000004'],
  },
];

const repairSale = (overrides: Partial<Sale> = {}): Sale => ({
  id: 'repair-1',
  recordNumber: 'r000003',
  saleDate: '2026-06-05T00:00:00.000Z',
  quantity: 1,
  salePrice: 0,
  kind: 'repair',
  status: 'ready',
  paidAmount: 1000,
  note: '',
  timeline: [],
  paymentHistory: [],
  lineItems: repairProductLineItems,
  client: {
    id: 'client-1',
    name: 'Client',
    phone: '+380000000000',
    status: 'new',
  },
  product: {
    id: '',
    article: '',
    name: 'Repair device',
    serialNumber: '',
  },
  manager: null,
  master: null,
  issuedBy: null,
  createdAt: '2026-06-05T00:00:00.000Z',
  updatedAt: '2026-06-05T00:00:00.000Z',
  ...overrides,
});

const printCompanySettings = {
  serviceName: 'Service CRM',
  company: 'Service CRM',
  companyAddress: '',
  companyId: '',
  companyIban: '',
  companyEmail: '',
  companySite: '',
};

describe('repair stock status guards', () => {
  it('does not block issuing a repair order with bound stock serials', () => {
    expect(
      isRepairStatusChangeLockedByStock(
        repairSale(),
        'issued',
        repairProductLineItems,
      ),
    ).toBe(false);
  });

  it('does not block marking a repair order with bound stock serials as paid', () => {
    expect(
      isRepairStatusChangeLockedByStock(
        repairSale(),
        'paid',
        repairProductLineItems,
      ),
    ).toBe(false);
  });

  it('blocks refusal statuses while bound stock serials are still attached', () => {
    expect(
      isRepairStatusChangeLockedByStock(
        repairSale(),
        'clientRejected',
        repairProductLineItems,
      ),
    ).toBe(true);
    expect(
      isRepairStatusChangeLockedByStock(
        repairSale(),
        'issuedWithoutRepair',
        repairProductLineItems,
      ),
    ).toBe(true);
  });

  it('does not block refusal statuses after stock serials are unbound', () => {
    const unboundItems = repairProductLineItems.map((item) => ({
      ...item,
      serialNumbers: [],
    }));

    expect(
      isRepairStatusChangeLockedByStock(
        repairSale({ lineItems: unboundItems }),
        'clientRejected',
        unboundItems,
      ),
    ).toBe(false);
  });

  it('still blocks issuing a repair order with products when payment remains', () => {
    expect(
      isIssueWithoutPaymentBlockedForSale(
        repairSale({ paidAmount: 500 }),
        'issued',
        repairProductLineItems,
        500,
      ),
    ).toBe(true);
  });
});

describe('order print labels', () => {
  it('uses order number and client phone for repair labels', () => {
    const data = getPrintTemplateData(
      repairSale({
        recordNumber: 'r000777',
        product: {
          id: 'device-1',
          article: 'IPH',
          name: 'iPhone 13 Pro',
          serialNumber: 'DEVICE-SN',
        },
      }),
      [],
      0,
      'r000777',
      printCompanySettings,
    );

    expect(data.barcode).toBe('r000777');
    expect(data.labelCode).toBe('r000777');
    expect(data.labelTitle).toBe('iPhone 13 Pro');
    expect(data.labelContact).toBe('+380000000000');
  });

  it('uses repair label data for legacy r-prefixed records even when kind is sale', () => {
    const data = getPrintTemplateData(
      repairSale({
        kind: 'sale',
        recordNumber: 'r000778',
        product: {
          id: 'device-1',
          article: 'IPH',
          name: 'Legacy repair device',
          serialNumber: 'DEVICE-SN',
        },
      }),
      [],
      0,
      'r000778',
      printCompanySettings,
    );

    expect(data.barcode).toBe('r000778');
    expect(data.labelTitle).toBe('Legacy repair device');
    expect(data.labelContact).toBe('+380000000000');
  });

  it('uses the first product serial and hides phone for sale labels', () => {
    const productItems: OrderLineItem[] = [
      {
        id: 'sale-product-1',
        kind: 'product',
        productId: 'product-1',
        name: 'Fujitsu 19V 4.74A power adapter',
        price: 600,
        quantity: 1,
        warrantyPeriod: 0,
        serialNumbers: ['SN-SALE-001'],
      },
    ];
    const data = getPrintTemplateData(
      repairSale({
        kind: 'sale',
        recordNumber: 's000101',
        lineItems: productItems,
      }),
      productItems,
      0,
      's000101',
      printCompanySettings,
    );

    expect(data.barcode).toBe('SN-SALE-001');
    expect(data.labelCode).toBe('SN-SALE-001');
    expect(data.labelTitle).toBe('Fujitsu 19V 4.74A power adapter');
    expect(data.labelContact).toBe('');
  });

  it('prints label pages in the selected orientation', () => {
    const landscape = buildOrderPrintHtml({
      title: 'Label',
      body: '',
      pageSize: 'label',
      labelSize: { presetId: '25x40', widthMm: 25, heightMm: 40 },
      orientation: 'landscape',
    });
    const portrait = buildOrderPrintHtml({
      title: 'Label',
      body: '',
      pageSize: 'label',
      labelSize: { presetId: '25x40', widthMm: 25, heightMm: 40 },
      orientation: 'portrait',
    });

    expect(landscape).toContain('@page { size: 40mm 25mm; margin: 0; }');
    expect(landscape).toContain('class="print-html-label"');
    expect(landscape).toContain('--label-width: 40mm; --label-height: 25mm;');
    expect(portrait).toContain('@page { size: 25mm 40mm; margin: 0; }');
  });

  it('uses a scaled screen mode only for preview windows', () => {
    const preview = buildOrderPrintHtml({
      title: 'Label preview',
      body: '',
      pageSize: 'label',
      labelSize: { presetId: '40x25', widthMm: 40, heightMm: 25 },
      orientation: 'landscape',
      screenPreview: true,
    });

    expect(preview).toContain('class="print-html-label print-screen-preview"');
    expect(preview).toContain('class="print-body-label print-screen-preview"');
    expect(preview).toContain('@page { size: 40mm 25mm; margin: 0; }');
  });

  it('label print HTML contains label @page, label classes/vars, no A4 @page', () => {
    const html = buildOrderPrintHtml({
      title: 'Barcode label',
      body: '<section class="print-form print-form-label" style="--label-width: 40mm; --label-height: 25mm;"><div class="print-label">X</div></section>',
      pageSize: 'label',
      labelSize: { presetId: '40x25', widthMm: 40, heightMm: 25 },
      orientation: 'landscape',
    });

    expect(html).toContain('@page { size: 40mm 25mm; margin: 0; }');
    expect(html).not.toContain('A4');
    expect(html).toContain('class="print-html-label"');
    expect(html).toContain('class="print-body-label"');
    expect(html).toContain('--label-width: 40mm; --label-height: 25mm;');
    expect(html).toContain('class="print-form-label"');
    expect(html).toContain('class="print-label"');
  });

  it('A4 print HTML contains A4 @page with 12mm margin, no label-only classes', () => {
    const html = buildOrderPrintHtml({
      title: 'Receipt',
      body: '<section class="print-form">content</section>',
      pageSize: 'A4',
      labelSize: { presetId: '40x25', widthMm: 40, heightMm: 25 },
      orientation: 'portrait',
    });

    expect(html).toContain('@page { size: A4 portrait; margin: 12mm; }');
    expect(html).not.toContain('print-html-label');
    expect(html).not.toContain('print-body-label');
    expect(html).not.toContain('--label-width');
  });
});
