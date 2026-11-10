import { describe, expect, it } from 'vitest';
import { getInlineTextFormatShortcut, toggleInlineTextFormat } from './inlineTextFormat';

// `[` and `]` mark the selection in the readable fixtures below.
const parse = (marked: string) => {
  const start = marked.indexOf('[');
  const end = marked.indexOf(']') - 1;
  return { value: marked.replace('[', '').replace(']', ''), start, end };
};

const format = (marked: string) => {
  const { value, start, end } = parse(marked);
  return (kind: 'bold' | 'italic' | 'underline', syntax: 'markup' | 'html' = 'markup') => {
    const edit = toggleInlineTextFormat(value, start, end, kind, syntax);
    return `${edit.value.slice(0, edit.selectionStart)}[${edit.value.slice(edit.selectionStart, edit.selectionEnd)}]${edit.value.slice(edit.selectionEnd)}`;
  };
};

describe('toggleInlineTextFormat (markup)', () => {
  it('wraps the selection and keeps the word selected', () => {
    expect(format('Warranty [12 months] only')('bold')).toBe('Warranty **[12 months]** only');
    expect(format('a [word] b')('italic')).toBe('a *[word]* b');
    expect(format('a [word] b')('underline')).toBe('a __[word]__ b');
  });

  it('keeps surrounding whitespace outside the markers', () => {
    expect(format('a[ word ]b')('bold')).toBe('a **[word]** b');
  });

  it('removes the format when applied again (selection inside or including markers)', () => {
    expect(format('a **[word]** b')('bold')).toBe('a [word] b');
    expect(format('a [**word**] b')('bold')).toBe('a [word] b');
    expect(format('a *[word]* b')('italic')).toBe('a [word] b');
    expect(format('a __[word]__ b')('underline')).toBe('a [word] b');
  });

  it('combines formats on the same selection', () => {
    expect(format('**[word]**')('italic')).toBe('***[word]***');
    expect(format('***[word]***')('bold')).toBe('*[word]*');
    expect(format('***[word]***')('italic')).toBe('**[word]**');
    expect(format('**[word]**')('underline')).toBe('__**[word]**__');
    expect(format('**__[word]__**')('bold')).toBe('__[word]__');
    expect(format('__**[word]**__')('underline')).toBe('**[word]**');
  });

  it('wraps each line of a multi-line selection separately', () => {
    expect(format('[first\nsecond]')('bold')).toBe('[**first**\n**second**]');
    expect(format('[first\n\nthird]')('italic')).toBe('[*first*\n\n*third*]');
    expect(format('x [one\ntwo] y')('bold')).toBe('x [**one**\n**two**] y');
  });

  it('toggles off multi-line formatting only when every line has it', () => {
    expect(format('[**first**\n**second**]')('bold')).toBe('[first\nsecond]');
    expect(format('[**first**\nsecond]')('bold')).toBe('[**first**\n**second**]');
  });

  it('inserts an empty pair and places the caret inside for a collapsed selection', () => {
    expect(format('ab[]cd')('bold')).toBe('ab**[]**cd');
  });

  it('leaves whitespace-only selections unchanged', () => {
    expect(format('a[   ]b')('bold')).toBe('a[   ]b');
  });

  it('does not treat signature underscores as underline', () => {
    expect(format('[Client:] __________')('underline')).toBe('__[Client:]__ __________');
  });
});

describe('toggleInlineTextFormat (html)', () => {
  it('wraps and unwraps HTML tags', () => {
    expect(format('<p>[word]</p>')('bold', 'html')).toBe('<p><strong>[word]</strong></p>');
    expect(format('<p><strong>[word]</strong></p>')('bold', 'html')).toBe('<p>[word]</p>');
    expect(format('<p>[<em>word</em>]</p>')('italic', 'html')).toBe('<p>[word]</p>');
    expect(format('[a\nb]')('underline', 'html')).toBe('<u>[a\nb]</u>');
  });
});

describe('getInlineTextFormatShortcut', () => {
  const base = { ctrlKey: true, metaKey: false, altKey: false, shiftKey: false };

  it('maps Ctrl/Cmd + B / I / U on any keyboard layout', () => {
    expect(getInlineTextFormatShortcut({ ...base, code: 'KeyB', key: 'b' })).toBe('bold');
    expect(getInlineTextFormatShortcut({ ...base, code: 'KeyI', key: 'ш' })).toBe('italic');
    expect(getInlineTextFormatShortcut({ ...base, ctrlKey: false, metaKey: true, code: 'KeyU', key: 'u' })).toBe('underline');
  });

  it('ignores other combinations', () => {
    expect(getInlineTextFormatShortcut({ ...base, ctrlKey: false, code: 'KeyB', key: 'b' })).toBeNull();
    expect(getInlineTextFormatShortcut({ ...base, shiftKey: true, code: 'KeyB', key: 'B' })).toBeNull();
    expect(getInlineTextFormatShortcut({ ...base, altKey: true, code: 'KeyB', key: 'b' })).toBeNull();
    expect(getInlineTextFormatShortcut({ ...base, code: 'KeyC', key: 'c' })).toBeNull();
  });
});
