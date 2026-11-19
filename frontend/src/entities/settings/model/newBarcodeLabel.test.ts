import { describe, expect, it } from 'vitest';
import type { PrintForm } from './types';
import {
  createLayoutPrintForm,
  defaultPrintForms,
  getPrintMenuForms,
  getWarehouseBarcodePrintForm,
  getDefaultPrintLayoutBlocks,
  isPrintFormVisibleFor,
  migrateNewBarcodeKitBlock,
  newBarcodePrintFormIds,
  normalizePrintFormsForView,
  normalizePrintLayoutBlocks,
  printFormVariables,
  printLabelDocumentStyles,
  renderPrintLayout,
  renderPrintTemplate,
} from './printForms';
import {
  formatOrderNumberShort,
  formatPrintAcceptedDate,
  formatPrintAcceptedTime,
} from './printValueFormatters';

const labelData = {
  orderNumber: 'r000124',
  orderNumberShort: '#124',
  acceptedDate: '10.11.2026',
  acceptedTime: '16:00',
  deviceName: 'Ноутбук DNS',
  kit: 'ЗП, сумка',
  kitLabel: 'ЗП / сумка',
  clientName: 'Сергій',
  clientPhone: '050-662-81-44',
  barcode: 'r000124',
};

const getDefault = (id: string) =>
  normalizePrintFormsForView(defaultPrintForms).find((form) => form.id === id)!;

describe('print value formatters', () => {
  it('shortens order numbers to #digits without prefix or leading zeros', () => {
    expect(formatOrderNumberShort('r000124')).toBe('#124');
    expect(formatOrderNumberShort('R015870')).toBe('#15870');
    expect(formatOrderNumberShort('s000001')).toBe('#1');
    expect(formatOrderNumberShort('r000000')).toBe('#0');
    expect(formatOrderNumberShort('  r42 ')).toBe('#42');
    expect(formatOrderNumberShort('ABC')).toBe('#ABC');
    expect(formatOrderNumberShort('')).toBe('');
    expect(formatOrderNumberShort(undefined)).toBe('');
  });

  it('formats accepted date and time in Europe/Kyiv', () => {
    // 14:00 UTC in November (EET, UTC+2) is 16:00 in Kyiv.
    expect(formatPrintAcceptedDate('2026-11-10T14:00:00.000Z')).toBe('10.11.2026');
    expect(formatPrintAcceptedTime('2026-11-10T14:00:00.000Z')).toBe('16:00');
    // Summer time (EEST, UTC+3) and a date change across midnight.
    expect(formatPrintAcceptedDate('2026-07-31T21:30:00.000Z')).toBe('01.08.2026');
    expect(formatPrintAcceptedTime('2026-07-31T21:30:00.000Z')).toBe('00:30');
  });

  it('returns empty strings for missing or invalid dates', () => {
    expect(formatPrintAcceptedDate('')).toBe('');
    expect(formatPrintAcceptedTime(undefined)).toBe('');
    expect(formatPrintAcceptedDate('not-a-date')).toBe('');
  });
});

describe('new template variables', () => {
  it('registers acceptedDate, acceptedTime, orderNumberShort and kit', () => {
    expect(printFormVariables).toEqual(
      expect.arrayContaining(['acceptedDate', 'acceptedTime', 'orderNumberShort', 'kit']),
    );
  });

  it('substitutes the new variables with escaped values', () => {
    const html = renderPrintTemplate(
      '<p>{{orderNumberShort}} {{acceptedDate}} {{acceptedTime}} {{kit}}</p>',
      { ...labelData, kit: '<b>ЗП</b>' },
      'html',
    );
    expect(html).toContain('#124 10.11.2026 16:00 &lt;b&gt;ЗП&lt;/b&gt;');
  });
});

describe('New Barcode label templates', () => {
  it('adds both templates as repair-only 40x25 landscape labels with Barcode margins', () => {
    for (const id of newBarcodePrintFormIds) {
      const form = getDefault(id);
      expect(form.type).toBe('barcode');
      expect(form.pageSize).toBe('label');
      expect(form.orientation).toBe('landscape');
      expect(form.labelSize).toEqual({ presetId: '40x25', widthMm: 40, heightMm: 25 });
      expect(form.contentMargins).toEqual({ topMm: 0.45, rightMm: 1.5, bottomMm: 0.45, leftMm: 5 });
      expect(form.printMenuVisibility).toEqual(['repair']);
      expect(form.layoutBlocks?.length).toBeGreaterThan(0);
    }
    expect(getDefault('new-barcode-with-bar').title).toBe('New Barcode (with bar)');
    expect(getDefault('new-barcode-without-bar').title).toBe('New Barcode (without bar)');
  });

  it('renders the top row, divider and body lines without any QR code', () => {
    const form = getDefault('new-barcode-without-bar');
    const html = renderPrintTemplate(form.content, labelData, form.contentFormat);
    expect(html).toContain('print-columns print-columns-wide-left');
    expect(html).toMatch(/print-text-size-hero[^>]*>#124</);
    expect(html).toContain('10.11.2026<br>16:00');
    expect(html).toContain('<hr class="print-divider" />');
    expect(html).toMatch(/print-block-weight-bold[^>]*>Ноутбук DNS</);
    expect(html).toContain('>ЗП / сумка<');
    expect(html).toContain('>Сергій<');
    expect(html).toContain('>050-662-81-44<');
    expect(html.toLowerCase()).not.toContain('qr');
    expect(html).not.toContain('data-barcode-value');
  });

  it('adds a slim barcode encoding the full order number only to the with-bar variant', () => {
    const form = getDefault('new-barcode-with-bar');
    const html = renderPrintTemplate(form.content, labelData, form.contentFormat);
    expect(html).toContain('print-code-row print-code-row-slim');
    expect(html).toContain('data-barcode-value="r000124"');
    expect(html.toLowerCase()).not.toContain('qr');
  });

  it('leaves an empty kit paragraph empty so the label hides it', () => {
    const form = getDefault('new-barcode-without-bar');
    const html = renderPrintTemplate(form.content, { ...labelData, kit: '', kitLabel: '' }, form.contentFormat);
    expect(html).toMatch(/<p class="print-block-paragraph[^"]*"><\/p>/);
    expect(printLabelDocumentStyles).toContain('.print-label .print-block-paragraph:empty { display: none; }');
  });

  it('ships label CSS for hero text, wide-left columns, divider and slim barcode', () => {
    expect(printLabelDocumentStyles).toContain('.print-label .print-columns-wide-left { grid-template-columns: minmax(0, 1fr) auto; }');
    expect(printLabelDocumentStyles).toContain('print-text-size-hero { font-size: 7.5mm;');
    expect(printLabelDocumentStyles).toContain('border-top: 0.5mm solid #000');
    expect(printLabelDocumentStyles).toContain('.print-code-row-slim .print-barcode { display: block; width: 75%; max-width: 75%; height: 5mm;');
  });

  it('keeps the old Barcode template unchanged', () => {
    const barcode = getDefault('barcode');
    expect(barcode.title).toBe('Barcode');
    expect(barcode.printMenuVisibility).toBeUndefined();
    expect(barcode.content).toContain('{{labelCode}}');
    expect(barcode.content).not.toContain('print-code-row-slim');
    expect(barcode.contentMargins).toEqual({ topMm: 0.45, rightMm: 1.25, bottomMm: 0.45, leftMm: 1.25 });
  });

  it('does not re-add a deleted sibling once one New Barcode template is saved', () => {
    const saved = normalizePrintFormsForView(defaultPrintForms).filter(
      (form) => form.id !== 'new-barcode-without-bar',
    );
    const ids = normalizePrintFormsForView(saved).map((form) => form.id);
    expect(ids).toContain('new-barcode-with-bar');
    expect(ids).not.toContain('new-barcode-without-bar');
  });

  it('seeds both New Barcode templates for settings saved before the feature', () => {
    const legacy = normalizePrintFormsForView(defaultPrintForms).filter(
      (form) => !newBarcodePrintFormIds.includes(form.id),
    );
    const ids = normalizePrintFormsForView(legacy).map((form) => form.id);
    expect(ids).toEqual(expect.arrayContaining(newBarcodePrintFormIds));
  });
});

describe('builder additions', () => {
  it('keeps valid size/layout values and drops unknown ones', () => {
    const [heading, columns] = normalizePrintLayoutBlocks([
      { id: 'h', type: 'heading', level: 1, text: 'x', size: 'giant' as never },
      {
        id: 'c',
        type: 'columns',
        layout: 'wide-left',
        columns: [
          { id: 'l', blocks: [{ id: 'p', type: 'paragraph', level: 3, text: 'a', size: 'hero' }] },
          { id: 'r', blocks: [] },
        ],
      },
    ]);
    expect(heading).not.toHaveProperty('size');
    expect(columns).toMatchObject({ layout: 'wide-left' });
    expect(columns.type === 'columns' && columns.columns[0].blocks[0]).toMatchObject({ size: 'hero' });
  });

  it('emits explicit left alignment on labels only', () => {
    const blocks = [{ id: 'p', type: 'paragraph' as const, level: 3 as const, text: 'a', align: 'left' as const }];
    expect(renderPrintLayout(blocks, 'label')).toContain('print-align-left');
    expect(renderPrintLayout(blocks, 'document')).not.toContain('print-align-left');
  });
});

describe('print menu visibility', () => {
  const form = (patch: Partial<PrintForm>): PrintForm =>
    createLayoutPrintForm({
      id: 'custom',
      title: 'Custom',
      type: 'custom',
      content: '',
      contentFormat: 'html',
      pageSize: 'A4',
      orientation: 'portrait',
      isActive: true,
      sortOrder: 100,
      ...patch,
    });

  it('keeps legacy templates visible everywhere', () => {
    const legacy = form({});
    expect(isPrintFormVisibleFor(legacy, 'sale')).toBe(true);
    expect(isPrintFormVisibleFor(legacy, 'repair')).toBe(true);
    expect(isPrintFormVisibleFor(legacy, 'warehouse')).toBe(true);
  });

  it('respects explicit document types and hides templates with an empty list', () => {
    expect(isPrintFormVisibleFor(form({ printMenuVisibility: ['repair'] }), 'sale')).toBe(false);
    expect(isPrintFormVisibleFor(form({ printMenuVisibility: ['repair'] }), 'repair')).toBe(true);
    const hidden = form({ printMenuVisibility: [] });
    expect(isPrintFormVisibleFor(hidden, 'sale')).toBe(false);
    expect(isPrintFormVisibleFor(hidden, 'repair')).toBe(false);
  });

  it('filters the order print menu by document type and keeps hidden templates in settings', () => {
    const forms = [
      ...normalizePrintFormsForView(defaultPrintForms),
      form({ id: 'hidden', title: 'Hidden', printMenuVisibility: [] }),
      form({ id: 'sale-only', title: 'Sale only', printMenuVisibility: ['sale'] }),
    ];
    const repairIds = getPrintMenuForms(forms, 'repair').map((item) => item.id);
    const saleIds = getPrintMenuForms(forms, 'sale').map((item) => item.id);

    expect(repairIds).toEqual(expect.arrayContaining([...newBarcodePrintFormIds, 'barcode', 'receipt']));
    expect(repairIds).not.toContain('sale-only');
    expect(saleIds).not.toContain('new-barcode-with-bar');
    expect(saleIds).toContain('sale-only');
    expect(repairIds).not.toContain('hidden');
    expect(saleIds).not.toContain('hidden');
    expect(normalizePrintFormsForView(forms).map((item) => item.id)).toContain('hidden');
  });

  it('skips inactive templates even when visible', () => {
    const forms = [form({ id: 'off', isActive: false, printMenuVisibility: ['repair'] })];
    expect(getPrintMenuForms(forms, 'repair').map((item) => item.id)).not.toContain('off');
  });

  it('uses Product barcode for warehouse labels unless it is hidden there', () => {
    const defaults = normalizePrintFormsForView(defaultPrintForms);
    expect(getWarehouseBarcodePrintForm(defaults).id).toBe('warehouse-barcode');

    const custom = form({
      id: 'my-stock-label',
      pageSize: 'label',
      type: 'barcode',
      printMenuVisibility: ['warehouse'],
    });
    const withHiddenProductBarcode = defaults.map((item) =>
      item.id === 'warehouse-barcode' ? { ...item, printMenuVisibility: ['repair' as const] } : item,
    );
    expect(getWarehouseBarcodePrintForm([...withHiddenProductBarcode, custom]).id).toBe('my-stock-label');
    // New Barcode templates are repair-only and never picked for stock labels.
    expect(getWarehouseBarcodePrintForm(withHiddenProductBarcode).id).toBe('warehouse-barcode');
  });
});

describe('print phone format in templates', () => {
  it('formats phone variables even when the data source passes raw numbers', () => {
    const html = renderPrintTemplate(
      '<p>{{clientPhone}} | {{service_center_phone}} | {{warehouse_phone}} | {{labelContact}}</p>',
      {
        clientPhone: '+380974122235',
        service_center_phone: '380670000000',
        warehouse_phone: '+48123456789',
        labelContact: '0501234567',
      } as never,
      'html',
    );
    expect(html).toBe('<p>097-412-22-35 | 067-000-00-00 | +48123456789 | 0501234567</p>');
  });

  it('prints the New Barcode phone line in local format', () => {
    const form = getDefault('new-barcode-with-bar');
    const html = renderPrintTemplate(
      form.content,
      { ...labelData, clientPhone: '+380505567090' } as never,
      form.contentFormat,
    );
    expect(html).toContain('>050-556-70-90<');
    expect(html).not.toContain('+380505567090');
  });
});

describe('New Barcode kit separator', () => {
  it('default templates print the slash-joined kitLabel', () => {
    for (const id of newBarcodePrintFormIds) {
      const form = getDefault(id);
      expect(form.content).toContain('{{kitLabel}}');
      expect(form.content).not.toContain('{{kit}}');
      const html = renderPrintTemplate(form.content, { ...labelData, kitLabel: 'ЗП / сумка' } as never, form.contentFormat);
      expect(html).toContain('>ЗП / сумка<');
    }
  });

  it('migrates saved copies whose kit block still has the old default {{kit}}', () => {
    const saved = defaultPrintForms
      .filter((form) => newBarcodePrintFormIds.includes(form.id))
      .map((form) => ({
        ...form,
        layoutBlocks: getDefaultPrintLayoutBlocks(form.id).map((block) =>
          block.id === `${form.id}-kit` && block.type === 'paragraph' ? { ...block, text: '{{kit}}' } : block,
        ),
        content: 'stale',
      }));
    const normalized = normalizePrintFormsForView([...defaultPrintForms.filter((f) => !newBarcodePrintFormIds.includes(f.id)), ...saved]);
    for (const id of newBarcodePrintFormIds) {
      const form = normalized.find((item) => item.id === id)!;
      expect(form.content).toContain('{{kitLabel}}');
      expect(form.content).not.toContain('{{kit}}');
    }
  });

  it('keeps user-edited kit text and other templates untouched', () => {
    const edited = migrateNewBarcodeKitBlock({
      ...defaultPrintForms.find((form) => form.id === 'new-barcode-with-bar')!,
      layoutBlocks: [{ id: 'new-barcode-with-bar-kit', type: 'paragraph', level: 3, text: 'Комплект: {{kit}}' }],
    });
    expect(edited.layoutBlocks).toEqual([
      { id: 'new-barcode-with-bar-kit', type: 'paragraph', level: 3, text: 'Комплект: {{kit}}' },
    ]);
    const other = { ...defaultPrintForms[0], layoutBlocks: [{ id: 'x-kit', type: 'paragraph' as const, level: 3 as const, text: '{{kit}}' }] };
    expect(migrateNewBarcodeKitBlock(other)).toBe(other);
  });
});
