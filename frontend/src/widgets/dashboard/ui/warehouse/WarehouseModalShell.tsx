import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../../shared/ui/Modal';

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
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen
      title={title}
      onClose={onClose}
      closeLabel={t('common.close')}
      className="warehouse-settings-modal"
      bodyClassName="warehouse-settings-modal-body"
      footerClassName="warehouse-settings-modal-footer"
      showDefaultFooter
      cancelLabel={t('common.cancel')}
      submitLabel={submitLabel}
      onSubmit={onSubmit}
      canSubmit={canSubmit}
    >
      {children}
    </Modal>
  );
};