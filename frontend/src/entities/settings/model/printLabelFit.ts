// Runtime fitting for label print HTML (print window, order print preview,
// builder preview). Runs from the app window on the already rendered DOM, so
// the print window itself needs no script (CSP-safe).

const fitTextSelector = [
  '.print-label .print-text-size-hero',
  '.print-label .print-text-size-xlarge',
  '.print-label .print-text-size-large',
].join(', ');

// Normal-size label paragraphs (for example the Product barcode title) shrink
// too, but keep their ellipsis as the last resort. Serial lines wrap instead.
const shrinkTextSelector =
  '.print-label .print-block-paragraph:not(.print-label-serial)';

const wideLeftRightColumnSelector =
  '.print-label .print-columns-wide-left > div:last-child';

const fitCharsClassPrefix = 'print-fit-chars-';
const fitTextClass = 'print-fit-text';
const fitEllipsisClass = 'print-fit-ellipsis';
const datePattern = /(\d{2}\.\d{2}\.)(\d{4})/g;
const minFitFontSizePx = 6;
const maxFitSteps = 60;
const showTextNodes = 4; // NodeFilter.SHOW_TEXT (cross-window safe)

type FitRoot = HTMLElement | Document;

const getDocument = (root: FitRoot): Document =>
  (root as HTMLElement).ownerDocument ?? (root as Document);

/**
 * Static size step for a hero text by character count. Used when the DOM is
 * not laid out (tests, hidden preview) so long numbers still fit on 40x25
 * with wide fallback fonts. Short values (up to 4 chars, e.g. `#124`) keep
 * the full hero size.
 */
export const getPrintFitCharsClass = (text: string) => {
  const length = Array.from(text.trim()).length;
  if (length <= 4) return '';
  return `${fitCharsClassPrefix}${Math.min(length, 8)}`;
};

/**
 * Puts the year of `dd.MM.yyyy` dates on its own line inside the right column
 * of label `wide-left` columns, so the column gets narrower and the left
 * (order number) column gets the space. Idempotent.
 */
export const splitPrintLabelDateYear = (root: FitRoot) => {
  const doc = getDocument(root);
  root
    .querySelectorAll<HTMLElement>(wideLeftRightColumnSelector)
    .forEach((column) => {
      const walker = doc.createTreeWalker(column, showTextNodes);
      const textNodes: Text[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        textNodes.push(node as Text);
      }
      textNodes.forEach((textNode) => {
        const text = textNode.data;
        datePattern.lastIndex = 0;
        if (!datePattern.test(text)) return;
        datePattern.lastIndex = 0;
        const fragment = doc.createDocumentFragment();
        let cursor = 0;
        for (const match of text.matchAll(datePattern)) {
          const index = match.index ?? 0;
          fragment.append(
            doc.createTextNode(text.slice(cursor, index) + match[1]),
            doc.createElement('br'),
          );
          cursor = index + match[1].length;
        }
        fragment.append(doc.createTextNode(text.slice(cursor)));
        textNode.replaceWith(fragment);
      });
    });
};

const measureContentWidth = (element: HTMLElement) => {
  const doc = element.ownerDocument;
  if (typeof doc.createRange === 'function') {
    const range = doc.createRange();
    range.selectNodeContents(element);
    if (typeof range.getBoundingClientRect === 'function') {
      const width = range.getBoundingClientRect().width;
      if (width > 0) return width;
    }
  }
  return element.scrollWidth;
};

const measureAvailableWidth = (element: HTMLElement) => {
  const rectWidth =
    typeof element.getBoundingClientRect === 'function'
      ? element.getBoundingClientRect().width
      : 0;
  return rectWidth > 0 ? rectWidth : element.clientWidth;
};

const removeFitCharsClasses = (element: HTMLElement) => {
  Array.from(element.classList)
    .filter((name) => name.startsWith(fitCharsClassPrefix))
    .forEach((name) => element.classList.remove(name));
};

const shrinkToFit = (element: HTMLElement, charsClass: string) => {
  const view = element.ownerDocument.defaultView;
  const available = measureAvailableWidth(element);
  if (!view || !(available > 0) || !(element.clientWidth > 0)) {
    if (charsClass) element.classList.add(charsClass);
    return;
  }

  // Laid out: measure from the full CSS size and shrink only as needed.
  let size = Number.parseFloat(view.getComputedStyle(element).fontSize);
  if (!Number.isFinite(size) || size <= 0) {
    if (charsClass) element.classList.add(charsClass);
    return;
  }
  let content = measureContentWidth(element);
  if (content > available + 0.5) {
    size = Math.max(minFitFontSizePx, size * (available / content) * 0.98);
    element.style.fontSize = `${size}px`;
    content = measureContentWidth(element);
  }
  for (
    let step = 0;
    step < maxFitSteps && content > available + 0.5 && size > minFitFontSizePx;
    step += 1
  ) {
    size = Math.max(minFitFontSizePx, size * 0.96);
    element.style.fontSize = `${size}px`;
    content = measureContentWidth(element);
  }
  // Still too wide at the minimum size: fall back to an ellipsis.
  if (content > available + 0.5) element.classList.add(fitEllipsisClass);
};

const resetFit = (element: HTMLElement) => {
  removeFitCharsClasses(element);
  element.classList.remove(fitEllipsisClass);
  element.style.removeProperty('font-size');
};

/**
 * Label texts shrink until they fit their column (minimum 6 px); only then an
 * ellipsis is used. Large texts (hero / xlarge / large) are single-line and
 * never truncated before the minimum; normal paragraphs shrink the same way.
 */
export const fitPrintLabelText = (root: FitRoot) => {
  const fitted = new Set<HTMLElement>();
  root.querySelectorAll<HTMLElement>(fitTextSelector).forEach((element) => {
    fitted.add(element);
    element.classList.add(fitTextClass);
    resetFit(element);

    const charsClass = element.classList.contains('print-text-size-hero')
      ? getPrintFitCharsClass(element.textContent ?? '')
      : '';
    shrinkToFit(element, charsClass);
  });

  root.querySelectorAll<HTMLElement>(shrinkTextSelector).forEach((element) => {
    if (fitted.has(element)) return;
    resetFit(element);
    shrinkToFit(element, '');
  });
};

/** Date-year split, then text fit. Safe to call repeatedly. */
export const fitPrintLabelLayout = (root: FitRoot) => {
  splitPrintLabelDateYear(root);
  fitPrintLabelText(root);
};
