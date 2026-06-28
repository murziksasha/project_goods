import type { ReactNode } from 'react';

export const ModalShell = ({
  title,
  children,
  onClose,
  onSubmit,
  submitLabel,
  canSubmit,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  canSubmit: boolean;
}) => (
  <div className='modal-backdrop' role='dialog' aria-modal='true'>
    <div className='catalog-edit-modal warehouse-settings-modal'>
      <header className='catalog-edit-header'>
        <h2>{title}</h2>
        <button
          type='button'
          className='ghost-button'
          onClick={onClose}
        >
          &times;
        </button>
      </header>
      <div className='catalog-edit-body warehouse-settings-modal-body'>
        {children}
      </div>
      <footer className='catalog-edit-footer warehouse-settings-modal-footer'>
        <button
          type='button'
          className='secondary-button'
          onClick={onClose}
        >
          cancel
        </button>
        <button
          type='button'
          className='primary-button'
          onClick={onSubmit}
          disabled={!canSubmit}
        >
          {submitLabel}
        </button>
      </footer>
    </div>
  </div>
);

