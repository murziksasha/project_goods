import { useTranslation } from 'react-i18next';

type CreateOrderDeviceModalProps = {
  name: string;
  isActive: boolean;
  isSaving: boolean;
  canSave: boolean;
  onNameChange: (value: string) => void;
  onIsActiveChange: (value: boolean) => void;
  onClose: () => void;
  onSave: () => void;
};

export const CreateOrderDeviceModal = ({
  name,
  isActive,
  isSaving,
  canSave,
  onNameChange,
  onIsActiveChange,
  onClose,
  onSave,
}: CreateOrderDeviceModalProps) => {
  const { t } = useTranslation();

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="catalog-edit-modal" role="dialog" aria-modal="true">
        <header className="catalog-edit-header">
          <div className="catalog-edit-title">
            <h2>{t('orders.create.deviceModal.title')}</h2>
          </div>
          <button
            type="button"
            className="create-order-close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            &times;
          </button>
        </header>
        <div className="catalog-edit-body">
          <label className="field">
            <span>{t('common.name')}</span>
            <input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder={t('orders.create.deviceModal.namePlaceholder')}
            />
          </label>
          <label className="create-inline-checkbox">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => onIsActiveChange(event.target.checked)}
            />
            <span>{t('orders.create.deviceModal.activity')}</span>
          </label>
        </div>
        <footer className="catalog-edit-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={isSaving || !canSave}
            onClick={onSave}
          >
            {isSaving ? t('orders.create.saving') : t('common.save')}
          </button>
        </footer>
      </section>
    </div>
  );
};