/**
 * Lightweight inline markup for print-form text authored in the builder:
 * `**bold**`, `*italic*`, `__underline__`.
 *
 * Rules (see DOCUMENTATION/PRINT_FORMS_SPEC.md, "Inline text formatting"):
 * - Formatting is line-scoped: markers never pair across `\n`.
 * - `{{variable}}` tokens are opaque: they are emitted verbatim (and substituted
 *   later by `renderPrintTemplate` with escaped values), so variable values are
 *   never interpreted as markup.
 * - `\*` and `\_` produce literal characters.
 * - An opening marker must be followed by non-whitespace, a closing marker must be
 *   preceded by non-whitespace. Unclosed markers print literally.
 * - `_` only forms underline as an exact `__` run; longer runs such as
 *   `__________` (signature lines) stay literal. `*` runs longer than 3 stay literal.
 * - All authored text is HTML-escaped; only `<strong>`, `<em>` and `<u>` are emitted.
 */

const escapeText = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export const printInlineFormatClass = 'print-inline-format';

type TextNode = { kind: 'html'; html: string };
type DelimiterNode = {
  kind: 'delimiter';
  char: '*' | '_';
  count: number;
  canOpen: boolean;
  canClose: boolean;
};
type MarkupNode = TextNode | DelimiterNode;

const variablePattern = /^\{\{[a-zA-Z0-9_]+\}\}/;

const isWhitespace = (char: string | undefined) => char === undefined || /\s/.test(char);

const tokenizeLine = (line: string): MarkupNode[] => {
  const nodes: MarkupNode[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer) nodes.push({ kind: 'html', html: escapeText(buffer) });
    buffer = '';
  };

  let index = 0;
  while (index < line.length) {
    const char = line[index];
    if (char === '\\' && (line[index + 1] === '*' || line[index + 1] === '_')) {
      buffer += line[index + 1];
      index += 2;
      continue;
    }
    if (char === '{') {
      const match = variablePattern.exec(line.slice(index));
      if (match) {
        buffer += match[0];
        index += match[0].length;
        continue;
      }
    }
    if (char === '*' || char === '_') {
      let end = index;
      while (line[end] === char) end += 1;
      const count = end - index;
      const isValidRun = char === '*' ? count <= 3 : count === 2;
      if (!isValidRun) {
        buffer += line.slice(index, end);
        index = end;
        continue;
      }
      flush();
      nodes.push({
        kind: 'delimiter',
        char,
        count,
        canOpen: !isWhitespace(line[end]),
        canClose: !isWhitespace(line[index - 1]),
      });
      index = end;
      continue;
    }
    buffer += char;
    index += 1;
  }
  flush();
  return nodes;
};

const delimiterText = (node: DelimiterNode) => node.char.repeat(node.count);

const nodeHtml = (node: MarkupNode) => (node.kind === 'html' ? node.html : delimiterText(node));

const wrapHtml = (tag: 'strong' | 'em' | 'u', inner: string) =>
  `<${tag} class="${printInlineFormatClass}">${inner}</${tag}>`;

const resolveDelimiters = (nodes: MarkupNode[]): MarkupNode[] => {
  const result = [...nodes];
  let closerIndex = 0;

  while (closerIndex < result.length) {
    const closer = result[closerIndex];
    if (closer.kind !== 'delimiter' || !closer.canClose) {
      closerIndex += 1;
      continue;
    }

    let openerIndex = -1;
    for (let index = closerIndex - 1; index >= 0; index -= 1) {
      const candidate = result[index];
      if (
        candidate.kind === 'delimiter' &&
        candidate.canOpen &&
        candidate.char === closer.char
      ) {
        openerIndex = index;
        break;
      }
    }

    if (openerIndex < 0) {
      closerIndex += 1;
      continue;
    }

    const opener = result[openerIndex] as DelimiterNode;
    // Avoid empty elements such as `****`.
    if (openerIndex === closerIndex - 1) {
      closerIndex += 1;
      continue;
    }

    let used: number;
    let tag: 'strong' | 'em' | 'u';
    if (closer.char === '_') {
      used = 2;
      tag = 'u';
    } else if (opener.count >= 2 && closer.count >= 2) {
      used = 2;
      tag = 'strong';
    } else {
      used = 1;
      tag = 'em';
    }

    const inner = result
      .slice(openerIndex + 1, closerIndex)
      .map(nodeHtml)
      .join('');
    const element: TextNode = { kind: 'html', html: wrapHtml(tag, inner) };

    const nextOpener: DelimiterNode = { ...opener, count: opener.count - used };
    const nextCloser: DelimiterNode = { ...closer, count: closer.count - used };
    const replacement: MarkupNode[] = [
      ...(nextOpener.count > 0 ? [nextOpener] : []),
      element,
      ...(nextCloser.count > 0 ? [nextCloser] : []),
    ];
    result.splice(openerIndex, closerIndex - openerIndex + 1, ...replacement);
    // Re-check the same closer (if it still has markers) against earlier openers.
    closerIndex = openerIndex + (nextOpener.count > 0 ? 1 : 0) + 1;
  }

  return result;
};

/** Render one line of authored text to safe inline HTML. */
export const renderPrintInlineMarkupLine = (line: string) =>
  resolveDelimiters(tokenizeLine(line)).map(nodeHtml).join('');

/** Render authored text (may contain newlines) to safe inline HTML; lines are joined with `<br>`. */
export const renderPrintInlineMarkup = (value: string) =>
  value.split(/\r?\n/).map(renderPrintInlineMarkupLine).join('<br>');
