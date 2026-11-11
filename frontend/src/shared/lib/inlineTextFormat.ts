/**
 * Pure helpers behind the print-builder B / I / U toolbar and Ctrl+B / Ctrl+I / Ctrl+U.
 *
 * `markup` syntax edits `**bold**`, `*italic*`, `__underline__` (rendered by
 * `renderPrintInlineMarkup`), wrapping each selected line separately.
 * `html` syntax wraps the selection in `<strong>`, `<em>` or `<u>` (legacy HTML templates).
 * Applying a format that is already present on the selection removes it (toggle).
 */

export type InlineTextFormat = 'bold' | 'italic' | 'underline';
export type InlineTextFormatSyntax = 'markup' | 'html';

export interface InlineTextFormatEdit {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

type FormatSet = Record<InlineTextFormat, boolean>;

interface SegmentAnalysis {
  regionStart: number;
  regionEnd: number;
  core: string;
  formats: FormatSet;
}

const isMarkerChar = (char: string | undefined) => char === '*' || char === '_';
const isWhitespace = (char: string | undefined) => char !== undefined && /\s/.test(char);

const shellPattern = /^\**(?:__)?\**$/;

const parseShell = (shell: string): FormatSet | null => {
  if (!shellPattern.test(shell)) return null;
  const stars = shell.replaceAll('_', '').length;
  if (stars > 3) return null;
  return {
    bold: stars >= 2,
    italic: stars % 2 === 1,
    underline: shell.includes('__'),
  };
};

const sameFormats = (first: FormatSet, second: FormatSet) =>
  first.bold === second.bold &&
  first.italic === second.italic &&
  first.underline === second.underline;

const buildShells = (formats: FormatSet) => {
  const stars = '*'.repeat((formats.bold ? 2 : 0) + (formats.italic ? 1 : 0));
  const underline = formats.underline ? '__' : '';
  return { left: `${underline}${stars}`, right: `${stars}${underline}` };
};

const emptyFormats = (): FormatSet => ({ bold: false, italic: false, underline: false });

const analyzeSegment = (
  value: string,
  segmentStart: number,
  segmentEnd: number,
  lineStart: number,
  lineEnd: number,
): SegmentAnalysis | null => {
  let start = segmentStart;
  let end = segmentEnd;
  while (start < end && isWhitespace(value[start])) start += 1;
  while (end > start && isWhitespace(value[end - 1])) end -= 1;
  if (start === end) return null;

  let coreStart = start;
  while (coreStart < end && isMarkerChar(value[coreStart])) coreStart += 1;
  let coreEnd = end;
  while (coreEnd > coreStart && isMarkerChar(value[coreEnd - 1])) coreEnd -= 1;

  if (coreStart === coreEnd) {
    return { regionStart: start, regionEnd: end, core: value.slice(start, end), formats: emptyFormats() };
  }

  let outerStart = start;
  while (outerStart > lineStart && isMarkerChar(value[outerStart - 1])) outerStart -= 1;
  let outerEnd = end;
  while (outerEnd < lineEnd && isMarkerChar(value[outerEnd])) outerEnd += 1;

  const candidates: Array<[number, number]> = [
    [outerStart, outerEnd],
    [start, end],
  ];
  for (const [regionStart, regionEnd] of candidates) {
    const left = parseShell(value.slice(regionStart, coreStart));
    const right = parseShell(value.slice(coreEnd, regionEnd));
    if (left && right && sameFormats(left, right)) {
      return { regionStart, regionEnd, core: value.slice(coreStart, coreEnd), formats: left };
    }
  }

  return { regionStart: start, regionEnd: end, core: value.slice(start, end), formats: emptyFormats() };
};

const getLineSegments = (value: string, start: number, end: number) => {
  const segments: Array<{ start: number; end: number; lineStart: number; lineEnd: number }> = [];
  let lineStart = value.lastIndexOf('\n', start - 1) + 1;
  while (lineStart <= end) {
    const newline = value.indexOf('\n', lineStart);
    const lineEnd = newline < 0 ? value.length : newline;
    segments.push({
      start: Math.max(start, lineStart),
      end: Math.min(end, lineEnd),
      lineStart,
      lineEnd,
    });
    if (newline < 0) break;
    lineStart = newline + 1;
  }
  return segments;
};

const toggleMarkupFormat = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  format: InlineTextFormat,
): InlineTextFormatEdit => {
  if (selectionStart === selectionEnd) {
    const formats = emptyFormats();
    formats[format] = true;
    const { left, right } = buildShells(formats);
    return {
      value: `${value.slice(0, selectionStart)}${left}${right}${value.slice(selectionStart)}`,
      selectionStart: selectionStart + left.length,
      selectionEnd: selectionStart + left.length,
    };
  }

  const analyses = getLineSegments(value, selectionStart, selectionEnd)
    .map((segment) => analyzeSegment(value, segment.start, segment.end, segment.lineStart, segment.lineEnd))
    .filter((analysis): analysis is SegmentAnalysis => analysis !== null);

  if (analyses.length === 0) {
    return { value, selectionStart, selectionEnd };
  }

  const shouldRemove = analyses.every((analysis) => analysis.formats[format]);
  let nextValue = '';
  let cursor = 0;
  let nextStart = 0;
  let nextEnd = 0;

  analyses.forEach((analysis, index) => {
    const formats = { ...analysis.formats, [format]: !shouldRemove };
    const { left, right } = buildShells(formats);
    nextValue += value.slice(cursor, analysis.regionStart);
    const regionStart = nextValue.length;
    nextValue += `${left}${analysis.core}${right}`;
    cursor = analysis.regionEnd;

    if (analyses.length === 1) {
      nextStart = regionStart + left.length;
      nextEnd = nextStart + analysis.core.length;
    } else {
      if (index === 0) nextStart = regionStart;
      nextEnd = nextValue.length;
    }
  });
  nextValue += value.slice(cursor);

  return { value: nextValue, selectionStart: nextStart, selectionEnd: nextEnd };
};

const htmlTags: Record<InlineTextFormat, string> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
};

const toggleHtmlFormat = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  format: InlineTextFormat,
): InlineTextFormatEdit => {
  const open = `<${htmlTags[format]}>`;
  const close = `</${htmlTags[format]}>`;
  const selected = value.slice(selectionStart, selectionEnd);

  if (
    selected.length >= open.length + close.length &&
    selected.startsWith(open) &&
    selected.endsWith(close)
  ) {
    const inner = selected.slice(open.length, selected.length - close.length);
    return {
      value: `${value.slice(0, selectionStart)}${inner}${value.slice(selectionEnd)}`,
      selectionStart,
      selectionEnd: selectionStart + inner.length,
    };
  }

  if (
    value.slice(selectionStart - open.length, selectionStart) === open &&
    value.slice(selectionEnd, selectionEnd + close.length) === close
  ) {
    const start = selectionStart - open.length;
    return {
      value: `${value.slice(0, start)}${selected}${value.slice(selectionEnd + close.length)}`,
      selectionStart: start,
      selectionEnd: start + selected.length,
    };
  }

  return {
    value: `${value.slice(0, selectionStart)}${open}${selected}${close}${value.slice(selectionEnd)}`,
    selectionStart: selectionStart + open.length,
    selectionEnd: selectionStart + open.length + selected.length,
  };
};

export const toggleInlineTextFormat = (
  value: string,
  selectionStart: number,
  selectionEnd: number,
  format: InlineTextFormat,
  syntax: InlineTextFormatSyntax = 'markup',
): InlineTextFormatEdit => {
  const start = Math.max(0, Math.min(selectionStart, selectionEnd, value.length));
  const end = Math.min(value.length, Math.max(selectionStart, selectionEnd));
  return syntax === 'html'
    ? toggleHtmlFormat(value, start, end, format)
    : toggleMarkupFormat(value, start, end, format);
};

const shortcutCodes: Record<string, InlineTextFormat> = {
  KeyB: 'bold',
  KeyI: 'italic',
  KeyU: 'underline',
};

/** Maps Ctrl/Cmd + B / I / U to a format; uses `code` so it works on any keyboard layout. */
export const getInlineTextFormatShortcut = (event: {
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  code: string;
  key: string;
}): InlineTextFormat | null => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return null;
  const byCode = shortcutCodes[event.code];
  if (byCode) return byCode;
  const byKey = shortcutCodes[`Key${event.key.toUpperCase()}`];
  return byKey ?? null;
};
