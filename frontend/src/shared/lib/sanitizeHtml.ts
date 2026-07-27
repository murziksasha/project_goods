import DOMPurify from 'dompurify';

/** Allow print-form markup (tables, inline styles) while stripping scripts/event handlers. */
const PRINT_HTML_CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['target', 'style', 'class', 'id', 'colspan', 'rowspan'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
};

export const sanitizePrintHtml = (html: string): string => {
  if (!html) return '';
  return DOMPurify.sanitize(html, PRINT_HTML_CONFIG);
};
