import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultPrintForms,
  normalizePrintFormsForView,
  printLabelDocumentStyles,
  renderPrintTemplate,
} from './printForms';
import {
  fitPrintLabelLayout,
  fitPrintLabelText,
  getPrintFitCharsClass,
  splitPrintLabelDateYear,
} from './printLabelFit';

const renderNewBarcode = (id: string, orderNumberShort: string) => {
  const form = normalizePrintFormsForView(defaultPrintForms).find(
    (item) => item.id === id,
  )!;
  const root = document.createElement('div');
  root.innerHTML = renderPrintTemplate(
    form.content,
    {
      orderNumber: 'r000124',
      orderNumberShort,
      acceptedDate: '18.11.2026',
      acceptedTime: '11:25',
      deviceName: 'Ноутбук',
      kit: '',
      clientName: 'Сергій',
      clientPhone: '050-662-81-44',
      barcode: 'r000124',
    } as never,
    form.contentFormat,
  );
  document.body.append(root);
  return root;
};

const getHero = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('.print-text-size-hero')!;

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('getPrintFitCharsClass', () => {
  it('keeps the full hero size up to 4 characters', () => {
    expect(getPrintFitCharsClass('#1')).toBe('');
    expect(getPrintFitCharsClass('#124')).toBe('');
  });

  it('steps down by character count and caps at 8', () => {
    expect(getPrintFitCharsClass('#1587')).toBe('print-fit-chars-5');
    expect(getPrintFitCharsClass('#15870')).toBe('print-fit-chars-6');
    expect(getPrintFitCharsClass('#124000')).toBe('print-fit-chars-7');
    expect(getPrintFitCharsClass('#12345678')).toBe('print-fit-chars-8');
  });
});

describe.each(['new-barcode-with-bar', 'new-barcode-without-bar'])(
  'New Barcode fit (%s)',
  (id) => {
    it('puts the year on its own line before the time', () => {
      const root = renderNewBarcode(id, '#124');
      splitPrintLabelDateYear(root);
      const right = root.querySelector(
        '.print-columns-wide-left > div:last-child p',
      )!;
      expect(right.innerHTML).toBe('18.11.<br>2026<br>11:25');
      splitPrintLabelDateYear(root);
      expect(right.innerHTML).toBe('18.11.<br>2026<br>11:25');
    });

    it('marks the order number as never truncated and keeps it whole', () => {
      const root = renderNewBarcode(id, '#124000');
      fitPrintLabelLayout(root);
      const hero = getHero(root);
      expect(hero.textContent).toBe('#124000');
      expect(hero.classList.contains('print-fit-text')).toBe(true);
      expect(hero.classList.contains('print-fit-chars-7')).toBe(true);
    });

    it('keeps the big size for short numbers', () => {
      const root = renderNewBarcode(id, '#124');
      fitPrintLabelLayout(root);
      expect(getHero(root).className).not.toMatch(/print-fit-chars-/);
    });
  },
);

describe('fitPrintLabelText measured', () => {
  const mockLayout = (root: HTMLElement, available: number, widthAt: (px: number) => number) => {
    const hero = getHero(root);
    Object.defineProperty(hero, 'clientWidth', { configurable: true, value: available });
    vi.spyOn(hero, 'getBoundingClientRect').mockReturnValue({ width: available } as DOMRect);
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      (element) => ({ fontSize: (element as HTMLElement).style.fontSize || '28px' }) as CSSStyleDeclaration,
    );
    const originalCreateRange = document.createRange.bind(document);
    vi.spyOn(document, 'createRange').mockImplementation(() => {
      const range = originalCreateRange();
      range.getBoundingClientRect = () => {
        const px = Number.parseFloat(hero.style.fontSize || '28');
        return { width: widthAt(px) } as DOMRect;
      };
      return range;
    });
    return hero;
  };

  it('shrinks a long number until it fits its column and drops the static step', () => {
    const root = renderNewBarcode('new-barcode-with-bar', '#124000');
    // ~0.7em per character: 7 chars at 28px = 137px, column is 80px.
    const hero = mockLayout(root, 80, (px) => 7 * 0.7 * px);
    fitPrintLabelText(root);
    const size = Number.parseFloat(hero.style.fontSize);
    expect(size).toBeGreaterThan(0);
    expect(7 * 0.7 * size).toBeLessThanOrEqual(80.5);
    expect(size).toBeGreaterThan(14);
    expect(hero.className).not.toMatch(/print-fit-chars-/);
  });

  it('does not touch a number that already fits', () => {
    const root = renderNewBarcode('new-barcode-with-bar', '#124');
    const hero = mockLayout(root, 80, (px) => 4 * 0.6 * px);
    fitPrintLabelText(root);
    expect(hero.style.fontSize).toBe('');
  });
});

describe('label fit styles', () => {
  it('disables ellipsis for fitted texts and narrows the date line height', () => {
    expect(printLabelDocumentStyles).toContain(
      '.print-label .print-block-paragraph.print-fit-text { white-space: nowrap; overflow: visible; text-overflow: clip; }',
    );
    expect(printLabelDocumentStyles).toContain('.print-text-size-hero.print-fit-chars-7');
    expect(printLabelDocumentStyles).toContain(
      '.print-label .print-columns-wide-left > div:last-child .print-block-paragraph { line-height: 0.95; }',
    );
  });
});
