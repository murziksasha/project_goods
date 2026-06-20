import JsBarcode from 'jsbarcode';
import i18n from '../i18n/config';

export type SerialPrintItem = {
  name: string;
  article?: string;
  serialNumber: string;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const printSerialNumbers = (
  items: SerialPrintItem[],
  title = i18n.t('warehouse.print.serialNumbersTitle'),
) => {
  const printableItems = items.filter((item) => item.serialNumber.trim());
  if (printableItems.length === 0) return;

  const printWindow = window.open('', '_blank', 'width=720,height=760');
  if (!printWindow) return;

  const rows = printableItems
    .map(
      (item, index) => `
        <section class="serial-label">
          <strong>${escapeHtml(item.name || i18n.t('warehouse.print.productFallback'))}</strong>
          <svg class="serial-barcode" data-serial-barcode="${escapeHtml(item.serialNumber)}" aria-label="${escapeHtml(i18n.t('warehouse.print.barcodeAriaLabel', { index: index + 1 }))}"></svg>
          <code>${escapeHtml(item.serialNumber)}</code>
          <span>${escapeHtml(item.article || '-')}</span>
        </section>
      `,
    )
    .join('');

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          @page { size: A4 portrait; margin: 8mm; }
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            color: #111827;
          }
          .serial-sheet {
            display: grid;
            grid-template-columns: repeat(4, 40mm);
            grid-auto-rows: 25mm;
            gap: 2mm;
            align-items: start;
            justify-content: start;
          }
          .serial-label {
            box-sizing: border-box;
            width: 40mm;
            height: 25mm;
            border: 1px solid #111827;
            padding: 1.6mm 1.8mm 1.2mm;
            display: grid;
            grid-template-rows: auto 10.5mm auto auto;
            align-content: center;
            justify-items: stretch;
            gap: 0.6mm;
            overflow: hidden;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .serial-label strong {
            min-width: 0;
            font-size: 5.8px;
            line-height: 1.1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .serial-barcode {
            width: 100%;
            height: 10.5mm;
          }
          .serial-label span {
            min-width: 0;
            font-size: 5.5px;
            line-height: 1;
            color: #4b5563;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .serial-label code {
            font-family: Consolas, monospace;
            font-size: 7px;
            line-height: 1;
            font-weight: 800;
            letter-spacing: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        </style>
      </head>
      <body>
        <main class="serial-sheet">${rows}</main>
      </body>
    </html>
  `);
  printWindow.document.close();

  printWindow.document
    .querySelectorAll<SVGSVGElement>('svg[data-serial-barcode]')
    .forEach((node) => {
      const value = node.dataset.serialBarcode ?? '';
      try {
        JsBarcode(node, value, {
          format: 'CODE128',
          displayValue: false,
          height: 36,
          margin: 0,
          width: 1.1,
        });
      } catch {
        node.replaceWith(printWindow.document.createTextNode(value));
      }
    });

  printWindow.focus();
  printWindow.print();
};