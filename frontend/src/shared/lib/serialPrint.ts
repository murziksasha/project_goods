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
  title = 'Serial numbers',
) => {
  const printableItems = items.filter((item) => item.serialNumber.trim());
  if (printableItems.length === 0) return;

  const printWindow = window.open('', '_blank', 'width=720,height=760');
  if (!printWindow) return;

  const rows = printableItems
    .map(
      (item) => `
        <section class="serial-label">
          <strong>${escapeHtml(item.name || 'Product')}</strong>
          <span>${escapeHtml(item.article || '-')}</span>
          <code>${escapeHtml(item.serialNumber)}</code>
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
          @page { size: A4 portrait; margin: 10mm; }
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            color: #111827;
          }
          .serial-sheet {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8mm;
          }
          .serial-label {
            min-height: 34mm;
            border: 1px solid #111827;
            border-radius: 4px;
            padding: 5mm;
            display: grid;
            align-content: center;
            gap: 2mm;
            page-break-inside: avoid;
          }
          .serial-label strong {
            font-size: 13px;
          }
          .serial-label span {
            font-size: 11px;
            color: #4b5563;
          }
          .serial-label code {
            font-family: Consolas, monospace;
            font-size: 18px;
            font-weight: 800;
            letter-spacing: 0;
          }
        </style>
      </head>
      <body>
        <main class="serial-sheet">${rows}</main>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};
