import { useTranslation } from 'react-i18next';
import { Modal } from '../../../../../shared/ui/Modal';
import { Button } from '../../../../../shared/ui/Button';

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
    <Modal
      isOpen
      title={t('orders.create.deviceModal.title')}
      onClose={onClose}
      closeLabel={t('common.close')}
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      footer={
        <footer className="catalog-edit-footer">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={isSaving || !canSave}
            onClick={onSave}
          >
            {isSaving ? t('orders.create.saving') : t('common.save')}
          </Button>
        </footer>
      }
    >
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
    </Modal>
  );
};
