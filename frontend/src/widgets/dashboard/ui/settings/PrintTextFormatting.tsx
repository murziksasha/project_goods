import type React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  getInlineTextFormatShortcut,
  toggleInlineTextFormat,
  type InlineTextFormat,
  type InlineTextFormatSyntax,
} from '../../../../shared/lib/inlineTextFormat';

type FormattableElement = HTMLInputElement | HTMLTextAreaElement;

interface FormatTarget {
  apply: (format: InlineTextFormat) => void;
}

interface FormatScopeValue {
  register: (id: string, target: FormatTarget) => () => void;
  activate: (id: string) => void;
}

const FormatScopeContext = createContext<FormatScopeValue | null>(null);

const formatOptions: InlineTextFormat[] = ['bold', 'italic', 'underline'];

const formatLabelKeys = {
  bold: { short: 'settings.printBuilder.formatBoldShort', title: 'settings.printBuilder.formatBold' },
  italic: { short: 'settings.printBuilder.formatItalicShort', title: 'settings.printBuilder.formatItalic' },
  underline: {
    short: 'settings.printBuilder.formatUnderlineShort',
    title: 'settings.printBuilder.formatUnderline',
  },
} as const;

const formatShortcutKeys: Record<InlineTextFormat, string> = {
  bold: 'B',
  italic: 'I',
  underline: 'U',
};

export interface PrintTextFormatScopeProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Renders a B / I / U toolbar that applies to the last focused formattable field
 * inside the scope (or the first one when none was focused yet).
 */
export const PrintTextFormatScope: React.FC<PrintTextFormatScopeProps> = ({
  children,
  className,
}) => {
  const { t } = useTranslation();
  const targetsRef = useRef(new Map<string, FormatTarget>());
  const activeIdRef = useRef<string | null>(null);

  const scope = useMemo<FormatScopeValue>(
    () => ({
      register: (id, target) => {
        targetsRef.current.set(id, target);
        return () => {
          targetsRef.current.delete(id);
          if (activeIdRef.current === id) activeIdRef.current = null;
        };
      },
      activate: (id) => {
        activeIdRef.current = id;
      },
    }),
    [],
  );

  const applyFormat = (format: InlineTextFormat) => {
    const targets = targetsRef.current;
    const target =
      (activeIdRef.current ? targets.get(activeIdRef.current) : undefined) ??
      targets.values().next().value;
    target?.apply(format);
  };

  return (
    <FormatScopeContext.Provider value={scope}>
      <div className={className ? `print-text-format-scope ${className}` : 'print-text-format-scope'}>
        <div
          className="print-text-format-toolbar"
          role="toolbar"
          aria-label={t('settings.printBuilder.formatToolbar')}
        >
          {formatOptions.map((format) => (
            <button
              key={format}
              type="button"
              className={`print-text-format-button print-text-format-button-${format}`}
              aria-label={t(formatLabelKeys[format].title)}
              title={`${t(formatLabelKeys[format].title)} (Ctrl+${formatShortcutKeys[format]})`}
              // Keep the field focused so its selection survives the click.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyFormat(format)}
            >
              {t(formatLabelKeys[format].short)}
            </button>
          ))}
        </div>
        {children}
      </div>
    </FormatScopeContext.Provider>
  );
};

interface UseFormattableFieldOptions<T extends FormattableElement> {
  ref: React.RefObject<T | null>;
  value: string;
  onChange: (value: string) => void;
  syntax: InlineTextFormatSyntax;
}

const useFormattableField = <T extends FormattableElement>({
  ref,
  value,
  onChange,
  syntax,
}: UseFormattableFieldOptions<T>) => {
  const scope = useContext(FormatScopeContext);
  const id = useId();
  const pendingSelectionRef = useRef<[number, number] | null>(null);
  const onChangeRef = useRef(onChange);

  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  });

  const apply = useCallback(
    (format: InlineTextFormat) => {
      const element = ref.current;
      if (!element) return;
      const edit = toggleInlineTextFormat(
        element.value,
        element.selectionStart ?? element.value.length,
        element.selectionEnd ?? element.value.length,
        format,
        syntax,
      );
      if (edit.value === element.value) return;
      pendingSelectionRef.current = [edit.selectionStart, edit.selectionEnd];
      onChangeRef.current(edit.value);
    },
    [ref, syntax],
  );

  useLayoutEffect(() => {
    if (!scope) return undefined;
    return scope.register(id, { apply });
  }, [apply, id, scope]);

  useLayoutEffect(() => {
    const element = ref.current;
    const pending = pendingSelectionRef.current;
    if (!element || !pending) return;
    pendingSelectionRef.current = null;
    element.focus();
    element.setSelectionRange(pending[0], pending[1]);
  }, [ref, value]);

  return {
    onFocus: () => scope?.activate(id),
    onKeyDown: (event: React.KeyboardEvent<T>) => {
      const format = getInlineTextFormatShortcut(event);
      if (!format) return;
      event.preventDefault();
      apply(format);
    },
  };
};

export interface FormattableInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
}

/** Single-line field with Ctrl+B / I / U; uses the toolbar of the enclosing scope. */
export const FormattableInput: React.FC<FormattableInputProps> = ({
  value,
  onChange,
  ...rest
}) => {
  const ref = useRef<HTMLInputElement | null>(null);
  const { onFocus, onKeyDown } = useFormattableField({ ref, value, onChange, syntax: 'markup' });

  return (
    <input
      {...rest}
      ref={ref}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
    />
  );
};

export interface FormattableTextAreaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  syntax?: InlineTextFormatSyntax;
}

/** Multi-line field with Ctrl+B / I / U; uses the toolbar of the enclosing scope. */
export const FormattableTextArea: React.FC<FormattableTextAreaProps> = ({
  value,
  onChange,
  syntax = 'markup',
  ...rest
}) => {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const { onFocus, onKeyDown } = useFormattableField({ ref, value, onChange, syntax });

  return (
    <textarea
      {...rest}
      ref={ref}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
    />
  );
};
