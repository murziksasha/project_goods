import DOMPurify from 'dompurify';

/** Allow print-form markup (tables, inline styles, barcode SVGs) while stripping scripts/event handlers. */
const PRINT_HTML_CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
  USE_PROFILES: { html: true, svg: true },
  ADD_ATTR: [
    'target',
    'style',
    'class',
    'id',
    'colspan',
    'rowspan',
    // JsBarcode placeholder for print labels
    'data-barcode-value',
  ],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
};

export const sanitizePrintHtml = (html: string): string => {
  if (!html) return '';
  return DOMPurify.sanitize(html, PRINT_HTML_CONFIG);
};
