import { describe, expect, it } from 'vitest';
import { sanitizePrintHtml } from '../../../shared/lib/sanitizeHtml';
import { renderPrintLayout, renderPrintTemplate } from './printForms';
import { renderPrintInlineMarkup } from './printInlineMarkup';

const b = (inner: string) => `<strong class="print-inline-format">${inner}</strong>`;
const i = (inner: string) => `<em class="print-inline-format">${inner}</em>`;
const u = (inner: string) => `<u class="print-inline-format">${inner}</u>`;

describe('renderPrintInlineMarkup', () => {
  it('renders bold, italic and underline', () => {
    expect(renderPrintInlineMarkup('a **bold** b')).toBe(`a ${b('bold')} b`);
    expect(renderPrintInlineMarkup('a *italic* b')).toBe(`a ${i('italic')} b`);
    expect(renderPrintInlineMarkup('a __under__ b')).toBe(`a ${u('under')} b`);
    expect(renderPrintInlineMarkup('**Гарантія:** 12 міс.')).toBe(`${b('Гарантія:')} 12 міс.`);
  });

  it('keeps plain text unchanged apart from HTML escaping', () => {
    expect(renderPrintInlineMarkup('Plain text, no markers')).toBe('Plain text, no markers');
    expect(renderPrintInlineMarkup('A & B <c> "d"')).toBe('A &amp; B &lt;c&gt; &quot;d&quot;');
  });

  it('supports nesting', () => {
    expect(renderPrintInlineMarkup('***both***')).toBe(i(b('both')));
    expect(renderPrintInlineMarkup('**__x__**')).toBe(b(u('x')));
    expect(renderPrintInlineMarkup('__**x** y__')).toBe(u(`${b('x')} y`));
    expect(renderPrintInlineMarkup('**bold *and italic* text**')).toBe(
      b(`bold ${i('and italic')} text`),
    );
  });

  it('prints unclosed or unmatched markers literally', () => {
    expect(renderPrintInlineMarkup('**open')).toBe('**open');
    expect(renderPrintInlineMarkup('close**')).toBe('close**');
    expect(renderPrintInlineMarkup('a __b')).toBe('a __b');
    expect(renderPrintInlineMarkup('**a __b** c__')).toBe(`${b('a __b')} c__`);
  });

  it('requires markers to touch the text they format', () => {
    expect(renderPrintInlineMarkup('2 * 3 * 4')).toBe('2 * 3 * 4');
    expect(renderPrintInlineMarkup('** spaced **')).toBe('** spaced **');
    expect(renderPrintInlineMarkup('****')).toBe('****');
  });

  it('keeps signature lines and long marker runs literal', () => {
    expect(renderPrintInlineMarkup('Client: __________________')).toBe('Client: __________________');
    expect(renderPrintInlineMarkup('____x____')).toBe('____x____');
    expect(renderPrintInlineMarkup('*****')).toBe('*****');
  });

  it('is line-scoped: markers never pair across line breaks', () => {
    expect(renderPrintInlineMarkup('**first\nsecond**')).toBe('**first<br>second**');
    expect(renderPrintInlineMarkup('**one**\n*two*')).toBe(`${b('one')}<br>${i('two')}`);
    expect(renderPrintInlineMarkup('a\r\nb')).toBe('a<br>b');
  });

  it('turns backslash escapes into literal characters', () => {
    expect(renderPrintInlineMarkup('\\*not italic\\*')).toBe('*not italic*');
    expect(renderPrintInlineMarkup('\\_\\_x\\_\\_')).toBe('__x__');
    expect(renderPrintInlineMarkup('**a \\*star\\* b**')).toBe(b('a *star* b'));
    expect(renderPrintInlineMarkup('C:\\path')).toBe('C:\\path');
  });

  it('keeps variable tokens verbatim, also inside markup', () => {
    expect(renderPrintInlineMarkup('**{{clientName}}**')).toBe(b('{{clientName}}'));
    expect(renderPrintInlineMarkup('{{company_iban}}')).toBe('{{company_iban}}');
    expect(renderPrintInlineMarkup('*{{repair_order_reference}}*')).toBe(i('{{repair_order_reference}}'));
  });

  it('escapes HTML inside formatted text (XSS)', () => {
    const html = renderPrintInlineMarkup('**<img src=x onerror=alert(1)>**');
    expect(html).toBe(b('&lt;img src=x onerror=alert(1)&gt;'));
    expect(html).not.toContain('<img');
    expect(renderPrintInlineMarkup('__<script>alert(1)</script>__')).toBe(
      u('&lt;script&gt;alert(1)&lt;/script&gt;'),
    );
  });
});

describe('inline markup in rendered print layouts', () => {
  const render = (text: string, values: Record<string, string> = {}) =>
    renderPrintTemplate(
      renderPrintLayout([{ id: 'p', type: 'paragraph', level: 3, text }]),
      values,
      'html',
    );

  it('never interprets markup inside variable values', () => {
    const html = render('IBAN: **{{company_iban}}** {{note}}', {
      company_iban: 'UA**12**__34__',
      note: '*not italic* <b>x</b>',
    });
    expect(html).toContain(b('UA**12**__34__'));
    expect(html).toContain('*not italic* &lt;b&gt;x&lt;/b&gt;');
    expect(html).not.toContain('<em');
  });

  it('keeps inline tags and classes through DOMPurify', () => {
    const html = sanitizePrintHtml(render('**B** *I* __U__ **<img src=x onerror=alert(1)>**'));
    expect(html).toContain(b('B'));
    expect(html).toContain(i('I'));
    expect(html).toContain(u('U'));
    const container = document.createElement('div');
    container.innerHTML = html;
    expect(container.querySelector('img, [onerror]')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('formats headings, field grid labels, signatures and column text', () => {
    const html = renderPrintLayout([
      { id: 'h', type: 'heading', level: 1, text: 'Act **{{orderNumber}}**' },
      { id: 'f', type: 'fieldGrid', columns: 2, fields: [{ label: '*Client*', value: '__{{clientName}}__' }] },
      { id: 's', type: 'signatures', left: '**Manager:** {{managerName}}', right: 'Client: __________________' },
      {
        id: 'c',
        type: 'columns',
        columns: [{ id: 'c1', blocks: [{ id: 'c1-text', type: 'paragraph', level: 3, text: '**IBAN**' }] }],
      },
    ]);
    expect(html).toContain(`Act ${b('{{orderNumber}}')}`);
    expect(html).toContain(`<td>${i('Client')}</td>`);
    expect(html).toContain(`<td><strong>${u('{{clientName}}')}</strong></td>`);
    expect(html).toContain(`<span>${b('Manager:')} {{managerName}}</span>`);
    // Signature lines stay literal (the caption itself is translated to Ukrainian).
    expect(html).toContain('<span>Клієнт: __________________</span>');
    expect(html).toContain(b('IBAN'));
  });

  it('does not apply markup to barcode data values', () => {
    const html = renderPrintLayout([
      { id: 'bc', type: 'barcode', label: '**Code**', value: 'A**1**', showValue: true },
    ]);
    expect(html).toContain('data-barcode-value="A**1**"');
    expect(html).toContain('<strong class="print-code-value">A**1**</strong>');
    expect(html).toContain(`<span>${b('Code')}</span>`);
  });
});
