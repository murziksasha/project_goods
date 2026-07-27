import { describe, expect, it } from 'vitest';
import { sanitizePrintHtml } from './sanitizeHtml';

describe('sanitizePrintHtml', () => {
  it('keeps ordinary print markup', () => {
    const html = '<h1 class="title" style="color:red">Invoice</h1><table><tr><td>1</td></tr></table>';
    expect(sanitizePrintHtml(html)).toContain('Invoice');
    expect(sanitizePrintHtml(html)).toContain('<table>');
  });

  it('strips script tags and event handlers', () => {
    const dirty =
      '<p onclick="alert(1)">Safe</p><script>alert(2)</script><img src=x onerror="alert(3)">';
    const clean = sanitizePrintHtml(dirty);
    expect(clean).not.toContain('script');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('onerror');
    expect(clean).toContain('Safe');
  });
});
