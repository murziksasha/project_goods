import { describe, expect, it } from 'vitest';
import { sanitizePrintHtml } from './sanitizeHtml';

describe('sanitizePrintHtml', () => {
  it('keeps ordinary print markup', () => {
    const html = '<h1 class="title" style="color:red">Invoice</h1><table><tr><td>1</td></tr></table>';
    expect(sanitizePrintHtml(html)).toContain('Invoice');
    expect(sanitizePrintHtml(html)).toContain('<table>');
  });

  it('keeps print barcode SVG placeholders for JsBarcode', () => {
    const html =
      '<div class="print-label-code"><svg class="print-barcode" data-barcode-value="S000448"></svg></div><strong class="print-label-serial">S000448</strong>';
    const clean = sanitizePrintHtml(html);
    expect(clean).toContain('<svg');
    expect(clean).toContain('class="print-barcode"');
    expect(clean).toContain('data-barcode-value="S000448"');
    expect(clean).toContain('S000448');
  });

  it('strips script tags and event handlers', () => {
    const dirty =
      '<p onclick="alert(1)">Safe</p><script>alert(2)</script><img src=x onerror="alert(3)"><svg class="print-barcode" data-barcode-value="SN" onclick="alert(9)"></svg>';
    const clean = sanitizePrintHtml(dirty);
    expect(clean).not.toContain('script');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('onerror');
    expect(clean).toContain('Safe');
    expect(clean).toContain('data-barcode-value="SN"');
  });
});
