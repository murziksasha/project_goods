import {
  useEffect,
  useId,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { useModalBackgroundScrollLock } from '../lib/useModalBackgroundScrollLock';
import { Button } from './Button';

export type ModalProps = {
  isOpen: boolean;
  title: string;
  subtitle?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  closeLabel?: string;
  /** Extra classes merged onto the dialog shell. */
  className?: string;
  /** Overrides default shell classes (`catalog-edit-modal modal-dialog`). */
  shellClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  footer?: ReactNode;
  showDefaultFooter?: boolean;
  cancelLabel?: string;
  submitLabel?: string;
  onSubmit?: () => void;
  canSubmit?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  initialFocusSelector?: string;
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const MODAL_SCROLL_LOCK_SELECTORS = [
  '.catalog-edit-modal',
  '.modal-dialog',
  '.payment-modal',
  '.order-print-dialog',
  '.clients-card-modal',
  '.supplier-order-modal',
  '.serial-bind-modal',
  '.product-model-modal',
] as const;

const getFocusableElements = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute('disabled') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      element.tabIndex !== -1,
  );

export const Modal = ({
  isOpen,
  title,
  subtitle,
  headerActions,
  children,
  onClose,
  closeLabel = 'Close',
  className = '',
  shellClassName = 'catalog-edit-modal modal-dialog',
  headerClassName = '',
  bodyClassName = '',
  footerClassName = '',
  footer,
  showDefaultFooter = false,
  cancelLabel = 'Cancel',
  submitLabel = 'Save',
  onSubmit,
  canSubmit = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  initialFocusSelector,
}: ModalProps) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  // Keep latest onClose without re-running open/focus lifecycle when parent re-renders.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useModalBackgroundScrollLock(isOpen, {
    allowedSelectors: [...MODAL_SCROLL_LOCK_SELECTORS],
  });

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusInitial = () => {
      if (initialFocusSelector) {
        const preferred = dialog.querySelector<HTMLElement>(initialFocusSelector);
        if (preferred) {
          preferred.focus();
          return;
        }
      }

      const focusable = getFocusableElements(dialog);
      const firstContentFocusable = focusable.find(
        (element) => !element.classList.contains('modal-close-button'),
      );
      (firstContentFocusable ?? focusable[0] ?? dialog).focus();
    };

    const frameId = window.requestAnimationFrame(focusInitial);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener('keydown', handleKeyDown, true);
      const previous = previouslyFocusedRef.current;
      if (previous && document.contains(previous)) {
        previous.focus();
      }
    };
  }, [closeOnEscape, initialFocusSelector, isOpen]);

  if (!isOpen) return null;

  const handleBackdropMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!closeOnBackdrop) return;
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        ref={dialogRef}
        className={`${shellClassName} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header
          className={`catalog-edit-header ${headerClassName}`.trim()}
        >
          <div className="catalog-edit-title">
            {subtitle ? <span>{subtitle}</span> : null}
            <h2 id={titleId}>{title}</h2>
          </div>
          {headerActions}
          <Button
            variant="ghost"
            className="modal-close-button"
            onClick={onClose}
            aria-label={closeLabel}
          >
            &times;
          </Button>
        </header>
        <div className={`catalog-edit-body ${bodyClassName}`.trim()}>
          {children}
        </div>
        {footer ??
          (showDefaultFooter ? (
            <footer
              className={`catalog-edit-footer ${footerClassName}`.trim()}
            >
              <Button variant="secondary" onClick={onClose}>
                {cancelLabel}
              </Button>
              <Button
                variant="primary"
                onClick={onSubmit}
                disabled={!canSubmit}
              >
                {submitLabel}
              </Button>
            </footer>
          ) : null)}
      </div>
    </div>
  );
};
