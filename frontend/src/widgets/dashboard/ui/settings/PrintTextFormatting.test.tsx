import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  createLayoutPrintForm,
  defaultPrintForms,
  type PrintForm,
} from '../../../../entities/settings';
import { PrintFormBuilder } from './PrintFormBuilder';
import { FormattableInput, FormattableTextArea, PrintTextFormatScope } from './PrintTextFormatting';

const Harness = ({ initial, onValue }: { initial: string; onValue?: (value: string) => void }) => {
  const [value, setValue] = useState(initial);
  return (
    <PrintTextFormatScope>
      <FormattableTextArea
        aria-label="Body"
        value={value}
        onChange={(next) => {
          setValue(next);
          onValue?.(next);
        }}
      />
    </PrintTextFormatScope>
  );
};

const select = (element: HTMLTextAreaElement | HTMLInputElement, start: number, end: number) => {
  element.focus();
  element.setSelectionRange(start, end);
};

describe('PrintTextFormatScope', () => {
  it('renders B / I / U buttons that wrap and unwrap the selection', () => {
    render(<Harness initial="Warranty 12 months" />);
    const field = screen.getByLabelText('Body') as HTMLTextAreaElement;

    select(field, 9, 18);
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(field.value).toBe('Warranty **12 months**');
    expect([field.selectionStart, field.selectionEnd]).toEqual([11, 20]);

    fireEvent.click(screen.getByRole('button', { name: 'Italic' }));
    expect(field.value).toBe('Warranty ***12 months***');

    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(field.value).toBe('Warranty *12 months*');

    fireEvent.click(screen.getByRole('button', { name: 'Underline' }));
    expect(field.value).toBe('Warranty __*12 months*__');
  });

  it('supports Ctrl+B / Ctrl+I / Ctrl+U shortcuts and multi-line selections', () => {
    const onValue = vi.fn();
    render(<Harness initial={'first\nsecond'} onValue={onValue} />);
    const field = screen.getByLabelText('Body') as HTMLTextAreaElement;

    select(field, 0, field.value.length);
    fireEvent.keyDown(field, { key: 'b', code: 'KeyB', ctrlKey: true });
    expect(field.value).toBe('**first**\n**second**');

    fireEvent.keyDown(field, { key: 'b', code: 'KeyB', ctrlKey: true });
    expect(field.value).toBe('first\nsecond');

    select(field, 0, 5);
    // Ukrainian layout: physical U key produces "г".
    fireEvent.keyDown(field, { key: 'г', code: 'KeyU', ctrlKey: true });
    expect(field.value).toBe('__first__\nsecond');

    fireEvent.keyDown(field, { key: 'x', code: 'KeyX', ctrlKey: true });
    expect(onValue).toHaveBeenCalledTimes(3);
  });

  it('applies the shared toolbar to the last focused field in the scope', () => {
    const Fields = () => {
      const [first, setFirst] = useState('one');
      const [second, setSecond] = useState('two');
      return (
        <PrintTextFormatScope>
          <FormattableInput aria-label="First" value={first} onChange={setFirst} />
          <FormattableInput aria-label="Second" value={second} onChange={setSecond} />
        </PrintTextFormatScope>
      );
    };
    render(<Fields />);
    const second = screen.getByLabelText('Second') as HTMLInputElement;
    select(second, 0, 3);
    fireEvent.focus(second);
    fireEvent.click(screen.getByRole('button', { name: 'Italic' }));
    expect(second.value).toBe('*two*');
    expect((screen.getByLabelText('First') as HTMLInputElement).value).toBe('one');
  });
});

describe('PrintFormBuilder inline formatting', () => {
  const buildForm = (): PrintForm => {
    const base = createLayoutPrintForm({ ...defaultPrintForms[0], id: 'custom-form', type: 'custom' });
    return {
      ...base,
      layoutBlocks: [
        { id: 'paragraph-1', type: 'paragraph', level: 3, text: 'Warranty 12 months', align: 'left', weight: 'normal' },
      ],
    };
  };

  const BuilderHarness = () => {
    const [form, setForm] = useState(buildForm);
    return (
      <PrintFormBuilder
        forms={[form]}
        selectedForm={form}
        previewValues={{}}
        onSelectForm={() => undefined}
        onUpdateForms={() => undefined}
        onUpdateForm={(_id, patch) => setForm((current) => ({ ...current, ...patch }))}
        onDeleteForm={() => undefined}
      />
    );
  };

  it('formats words in a Text block and shows them formatted in the preview', () => {
    const { container } = render(<BuilderHarness />);
    const field = screen.getByLabelText('Text') as HTMLTextAreaElement;
    expect(field.closest('.print-formatted-field')).not.toBeNull();

    select(field, 9, 11);
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(field.value).toBe('Warranty **12** months');

    const preview = container.querySelector('.settings-print-preview-page');
    expect(preview?.querySelector('strong.print-inline-format')?.textContent).toBe('12');
  });
});
