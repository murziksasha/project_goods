import type React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../../shared/ui/Modal';

export interface CreateFinanceCategoryModalProps {
  isOpen: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<unknown> | unknown;
};

export const CreateFinanceCategoryModal: React.FC<CreateFinanceCategoryModalProps> = ({
  isOpen,
  isSaving = false,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');

  useEffect(() => {
    if (!isOpen) setName('');
  }, [isOpen]);

  const canSubmit = name.trim().length >= 2 && !isSaving;

  return (
    <Modal
      isOpen={isOpen}
      title={t('accounting.financeSettings.addCategory')}
      onClose={onClose}
      closeLabel={t('common.close')}
      className='finance-category-create-modal'
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      showDefaultFooter
      cancelLabel={t('common.cancel')}
      submitLabel={
        isSaving
          ? t('accounting.cashboxes.saving')
          : t('accounting.financeSettings.addCategory')
      }
      canSubmit={canSubmit}
      onSubmit={() => {
        void onSubmit(name.trim());
      }}
      initialFocusSelector='input'
    >
      <label className='field'>
        <span>{t('accounting.financeSettings.categoryName')}</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          placeholder={t('accounting.financeSettings.categoryNamePlaceholder')}
        />
      </label>
    </Modal>
  );
};
